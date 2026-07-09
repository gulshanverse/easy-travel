/**
 * PromptPipeline — orchestrates the full lifecycle from PromptRequested to
 * PromptCompleted. Each stage emits lifecycle events and is fully awaited
 * before the next stage runs (deterministic ordering).
 */
import { CancellationError, PromptError } from "./errors";
import type { PromptEventPublisher } from "./events";
import type { PromptMetrics } from "./metrics";
import { METRIC_NAMES } from "./metrics";
import type { PromptTelemetry } from "./telemetry";
import type { PromptBudgetManager } from "./budget";
import type { PromptCache } from "./cache";
import type { PromptContextAssembler } from "./context-assembler";
import type { PromptAssembler } from "./assembler";
import type { PromptCompiler } from "./compiler";
import type { PromptValidator } from "./validator";
import type { PromptRepairEngine } from "./repair";
import type { PromptRegistry } from "./registry";
import type { PromptExecutor } from "./executor";
import { newCorrelationId } from "./ids";
import type {
  CompiledPrompt,
  ExecutionResult,
  PromptRequest,
  PromptStage,
} from "./types";

export interface PipelineDependencies {
  registry: PromptRegistry;
  contextAssembler: PromptContextAssembler;
  assembler: PromptAssembler;
  compiler: PromptCompiler;
  validator: PromptValidator;
  repair: PromptRepairEngine;
  budget: PromptBudgetManager;
  cache: PromptCache;
  executor: PromptExecutor;
  publisher: PromptEventPublisher;
  telemetry: PromptTelemetry;
  metrics: PromptMetrics;
}

export class PromptPipeline {
  constructor(private readonly deps: PipelineDependencies) {}

  async run<T = unknown>(request: PromptRequest): Promise<ExecutionResult<T>> {
    const correlationId = request.correlationId ?? newCorrelationId();
    const req: PromptRequest = { ...request, correlationId };
    const ctx = {
      correlationId,
      causationId: req.causationId,
      traceId: req.traceId,
      promptId: req.promptId,
      version: req.version,
    };

    const publish = <P>(type: Parameters<PromptEventPublisher["publish"]>[0], payload: P, stage?: PromptStage) =>
      this.deps.publisher.publish(type, payload, { ...ctx, stage });

    publish("PromptRequested", { promptId: req.promptId }, "requested");
    try {
      throwIfAborted(req.signal);
      // 1. Resolve prompt.
      const entry = this.deps.registry.resolve(req.promptId, req.version);
      const versionedCtx = { ...ctx, version: entry.version };
      publish("PromptStageEntered", { stage: "context_collection" }, "context_collection");

      // 2. Context assembly (also covers memory retrieval via the port).
      const contextCacheKey = `${req.promptId}@${entry.version}:${req.correlationId}`;
      const context = await this.deps.contextAssembler.assemble({ request: req });
      this.deps.validator.validateContext(context);
      this.deps.cache.context.set(contextCacheKey, context);
      publish("PromptContextBuilt", { keys: Object.keys(context) }, "context_assembly");

      // 3. Assembly (registry + context → IR).
      const { ir } = this.deps.assembler.assemble(entry, context, req);
      this.deps.validator.validateIR(ir);

      // 4. Budget enforcement.
      const plan = this.deps.budget.enforce(ir.fragments, req.budget);
      const budgetedIR = { ...ir, fragments: plan.fragments };
      publish("PromptBudgetChecked", {
        totalTokens: plan.totalTokens,
        droppedIds: plan.droppedIds,
        compressedIds: plan.compressedIds,
      }, "budget_enforcement");

      // 5. Compile (and consult compiled cache).
      throwIfAborted(req.signal);
      const compiled = await this.compileWithCache(budgetedIR, plan.budget, publish);
      this.deps.validator.validateCompiled(compiled);
      publish("PromptValidated", { fingerprint: compiled.fingerprint }, "validation");

      // 6. Semantic cache probe.
      const semanticKey = this.deps.cache.compiledKey(entry.promptId, entry.version, compiled.fingerprint);
      const cachedResp = this.deps.cache.semantic.get(semanticKey);
      if (cachedResp) {
        this.deps.metrics.counter(METRIC_NAMES.cacheHits).inc(1, { kind: "semantic" });
        publish("PromptCacheHit", { kind: "semantic" });
        const result: ExecutionResult<T> = {
          correlationId,
          promptId: entry.promptId,
          version: entry.version,
          fingerprint: compiled.fingerprint,
          content: cachedResp.content,
          parsed: cachedResp.parsed as T | undefined,
          usage: { inputTokens: compiled.estimatedTokens, outputTokens: 0, totalTokens: compiled.estimatedTokens },
          cached: true,
          durationMs: 0,
          finishReason: "stop",
        };
        publish("PromptCompleted", { cached: true }, "completed");
        return result;
      }
      this.deps.metrics.counter(METRIC_NAMES.cacheMisses).inc(1, { kind: "semantic" });
      publish("PromptCacheMiss", { kind: "semantic" });

      // 7. Provider preparation → execution.
      publish("PromptStageEntered", { stage: "execution" }, "execution");
      const execResult = await this.deps.executor.execute(compiled, {
        signal: req.signal,
        stream: false,
      });
      publish("PromptExecuted", {
        usage: execResult.usage,
        durationMs: execResult.durationMs,
        cached: false,
      }, "execution");

      // 8. Output validation / structured parsing.
      let parsed: unknown;
      if (compiled.outputSchema) {
        try {
          parsed = this.deps.validator.validateStructured(execResult.content, compiled.outputSchema);
        } catch (err) {
          const repair = this.deps.repair.repair(execResult.content, compiled.outputSchema);
          parsed = repair.value;
        }
      }

      // 9. Cache the response.
      this.deps.cache.semantic.set(semanticKey, {
        content: execResult.content,
        parsed,
        cachedAt: Date.now(),
      });
      publish("PromptCached", { key: semanticKey });

      const final: ExecutionResult<T> = { ...execResult, parsed: parsed as T | undefined };
      publish("PromptCompleted", { durationMs: execResult.durationMs }, "completed");
      // Silence unused-var lint on versionedCtx (kept for future span attrs).
      void versionedCtx;
      return final;
    } catch (err) {
      const isCancel = err instanceof CancellationError || (err as Error)?.name === "AbortError";
      if (isCancel) {
        this.deps.metrics.counter(METRIC_NAMES.runsCancelled).inc();
        publish("PromptCancelled", { reason: (err as Error).message });
        throw err;
      }
      const pe = err instanceof PromptError ? err : new PromptError((err as Error).message, {
        code: "PROMPT_UNEXPECTED_ERROR",
        cause: err,
      });
      this.deps.metrics.counter(METRIC_NAMES.runsFailed).inc();
      publish("PromptFailed", {
        code: pe.code,
        message: pe.message,
        stage: pe.stage,
        recoverable: pe.recoverable,
      }, pe.stage);
      throw pe;
    }
  }

  private async compileWithCache(
    ir: ReturnType<PromptAssembler["assemble"]>["ir"],
    budget: CompiledPrompt["budget"],
    publish: <P>(type: Parameters<PromptEventPublisher["publish"]>[0], payload: P, stage?: PromptStage) => unknown,
  ): Promise<CompiledPrompt> {
    const started = Date.now();
    // Speculative fingerprint for pre-compile cache lookup requires compilation,
    // so we always compile once and then check for a cache entry by fingerprint.
    const compiled = this.deps.compiler.compile(ir, { budget });
    this.deps.metrics.histogram(METRIC_NAMES.compileMs).observe(Date.now() - started);
    const key = this.deps.cache.compiledKey(ir.promptId, ir.version, compiled.fingerprint);
    const cached = this.deps.cache.compiled.get(key);
    if (cached) {
      this.deps.metrics.counter(METRIC_NAMES.cacheHits).inc(1, { kind: "compiled" });
      publish("PromptCacheHit", { kind: "compiled" }, "compilation");
      return cached;
    }
    this.deps.cache.compiled.set(key, compiled);
    this.deps.metrics.counter(METRIC_NAMES.cacheMisses).inc(1, { kind: "compiled" });
    publish("PromptCompiled", { fingerprint: compiled.fingerprint, tokens: compiled.estimatedTokens }, "compilation");
    return compiled;
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new CancellationError();
}
