/**
 * Provider Runtime — Execution pipeline.
 *
 * Request -> Provider Selection -> Model Selection -> Capability Validation
 * -> Budget Validation -> Execution (with retries) -> Streaming -> Validation
 * -> Response -> Metrics -> Completion. Every stage emits typed events.
 */
import type { AdapterContext } from "./adapter";
import { assertCapabilities, assertContextWindow as assertCtxCaps } from "./capabilities";
import type { ProviderConfiguration } from "./config";
import { assertBudget, assertUsageWithinContextWindow, computeCost, estimatePayloadTokens, UsageTracker } from "./cost";
import type { CredentialManager } from "./credentials";
import {
  ProviderCancellationError,
  ProviderCircuitOpenError,
  ProviderError,
  ProviderTimeoutError,
  ProviderUnavailableError,
} from "./errors";
import type { ProviderEventPublisher } from "./events";
import type { ProviderHealthManager } from "./health";
import { newExecutionId } from "./ids";
import type { ProviderMetrics } from "./metrics";
import type { ModelRegistry } from "./model-registry";
import type { ProviderRegistry } from "./registry";
import { withRetry } from "./retry";
import type { RoutingPlan, ProviderRouter } from "./router";
import type { SelectionCandidate } from "./selector";
import type { ProviderTelemetry } from "./telemetry";
import type {
  ExecutionRequest,
  ExecutionResult,
  ProviderId,
  TokenUsage,
} from "./types";

export interface PipelineDeps {
  config: ProviderConfiguration;
  registry: ProviderRegistry;
  models: ModelRegistry;
  router: ProviderRouter;
  health: ProviderHealthManager;
  credentials?: CredentialManager;
  publisher: ProviderEventPublisher;
  telemetry: ProviderTelemetry;
  metrics: ProviderMetrics;
  usage: UsageTracker;
}

export class ExecutionPipeline {
  constructor(private readonly deps: PipelineDeps) {}

  async run<T = unknown>(request: ExecutionRequest): Promise<ExecutionResult<T>> {
    const { config, publisher, metrics, telemetry, health, usage, models, router } = this.deps;
    const executionId = newExecutionId();
    const started = Date.now();
    let attempts = 0;
    let fallbacks = 0;
    const excluded: ProviderId[] = [];

    await publisher.publish({
      name: "ExecutionStarted",
      correlationId: request.correlationId,
      causationId: request.causationId,
      data: { executionId, requestId: request.requestId },
    });

    return telemetry.span("provider.pipeline.run", async () => {
      let lastError: unknown;
      const maxAttempts = 1 + (config.fallback.enabled ? config.fallback.maxFallbacks : 0);

      for (let round = 0; round < maxAttempts; round++) {
        let plan: RoutingPlan;
        try {
          plan = router.plan(request, excluded);
        } catch (err) {
          lastError = err;
          break;
        }
        const candidate = plan.primary;
        const entry = this.deps.registry.require(candidate.providerId);

        if (!health.isAvailable(candidate.providerId)) {
          excluded.push(candidate.providerId);
          continue;
        }

        assertCapabilities(candidate.model, request.requires);
        assertCtxCaps(candidate.model, request.minContextWindow);

        const estimated = entry.adapter.estimateUsage(candidate.model, request.payload);
        const normalized: TokenUsage = normalizeUsage(estimated, request.payload);
        assertContextWindow(candidate.model, normalized);
        assertBudget(candidate.model, normalized, request.budget);

        await publisher.publish({
          name: "ProviderSelected",
          correlationId: request.correlationId,
          data: { providerId: candidate.providerId, score: candidate.score },
        });
        await publisher.publish({
          name: "ModelSelected",
          correlationId: request.correlationId,
          data: { modelId: candidate.model.id, providerId: candidate.providerId },
        });

        try {
          const ctx: AdapterContext = {
            signal: request.signal,
            timeoutMs: config.execution.defaultTimeoutMs,
            credential: this.deps.credentials && entry.config.credentials
              ? await this.deps.credentials.get(entry.config.credentials)
              : undefined,
          };

          const outcome = await withRetry(
            async ({ attempt }) => {
              attempts += 1;
              if (attempt > 1) {
                await publisher.publish({
                  name: "RetryStarted",
                  correlationId: request.correlationId,
                  data: { attempt, providerId: candidate.providerId },
                });
              }
              const rStarted = Date.now();
              try {
                const result = await withTimeout(
                  entry.adapter.execute<T>(candidate.model, request, ctx),
                  config.execution.defaultTimeoutMs,
                  request.signal,
                );
                await health.recordSuccess(candidate.providerId, Date.now() - rStarted);
                return result;
              } catch (err) {
                await health.recordFailure(candidate.providerId, (err as Error).message, Date.now() - rStarted);
                throw err;
              }
            },
            {
              policy: config.retry,
              signal: request.signal,
              isRetryable: (err) => {
                if (err instanceof ProviderCancellationError) return false;
                if (err instanceof ProviderCircuitOpenError) return false;
                if (err instanceof ProviderError) return err.retryable;
                return false;
              },
              onRetry: async (_err, ctxR) => {
                metrics.incr("provider.retry", 1, { providerId: candidate.providerId });
                await publisher.publish({
                  name: "RetryCompleted",
                  correlationId: request.correlationId,
                  data: { attempt: ctxR.attempt, providerId: candidate.providerId },
                });
              },
            },
          );

          const finalUsage = normalizeUsage(outcome.value.usage ?? normalized, request.payload);
          const cost = computeCost(candidate.model, finalUsage);
          if (cost != null) finalUsage.costEstimate = cost;
          usage.record(candidate.providerId, candidate.model.id, finalUsage);

          await publisher.publish({
            name: "CostCalculated",
            correlationId: request.correlationId,
            data: { modelId: candidate.model.id, cost, usage: finalUsage },
          });

          const latencyMs = Date.now() - started;
          metrics.observe("provider.latency_ms", latencyMs, { providerId: candidate.providerId, modelId: candidate.model.id });
          metrics.incr("provider.execution", 1, { providerId: candidate.providerId, ok: "true" });

          const result: ExecutionResult<T> = {
            ...outcome.value,
            executionId,
            usage: finalUsage,
            latencyMs,
            attempts,
            fallbacks,
            requestId: request.requestId,
            correlationId: request.correlationId,
            providerId: candidate.providerId,
            modelId: candidate.model.id,
            streamed: outcome.value.streamed ?? false,
          };

          await publisher.publish({
            name: "ExecutionCompleted",
            correlationId: request.correlationId,
            data: {
              executionId,
              providerId: candidate.providerId,
              modelId: candidate.model.id,
              usage: finalUsage,
              latencyMs,
              attempts,
              fallbacks,
              streamed: result.streamed,
            },
          });
          return result;
        } catch (err) {
          lastError = err;
          metrics.incr("provider.execution", 1, { providerId: candidate.providerId, ok: "false" });

          if (err instanceof ProviderCancellationError) {
            await publisher.publish({
              name: "ExecutionCancelled",
              correlationId: request.correlationId,
              data: { executionId, providerId: candidate.providerId },
            });
            throw err;
          }

          const failoverEligible =
            config.fallback.enabled &&
            (err instanceof ProviderUnavailableError ||
              err instanceof ProviderTimeoutError ||
              err instanceof ProviderCircuitOpenError ||
              (err instanceof ProviderError && err.retryable));

          if (!failoverEligible || round + 1 >= maxAttempts) {
            await publisher.publish({
              name: "ExecutionFailed",
              correlationId: request.correlationId,
              data: {
                executionId,
                providerId: candidate.providerId,
                error: (err as Error).message,
                attempts,
                fallbacks,
              },
            });
            throw err;
          }

          excluded.push(candidate.providerId);
          fallbacks += 1;
          await publisher.publish({
            name: "FallbackStarted",
            correlationId: request.correlationId,
            data: {
              from: candidate.providerId,
              reason: (err as Error).message,
              attempt: fallbacks,
            },
          });
        }
      }

      await publisher.publish({
        name: "ExecutionFailed",
        correlationId: request.correlationId,
        data: { executionId, error: (lastError as Error)?.message ?? "no candidate", attempts, fallbacks },
      });
      throw lastError instanceof Error
        ? lastError
        : new ProviderUnavailableError("Execution exhausted all providers");
    }, { correlationId: request.correlationId });
  }
}

function normalizeUsage(u: Partial<TokenUsage> | undefined, payload: unknown): TokenUsage {
  const input = u?.inputTokens ?? estimatePayloadTokens(payload);
  const output = u?.outputTokens ?? 0;
  const total = u?.totalTokens ?? input + output;
  return { inputTokens: input, outputTokens: output, totalTokens: total, costEstimate: u?.costEstimate };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, signal?: AbortSignal): Promise<T> {
  if (signal?.aborted) throw new ProviderCancellationError();
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new ProviderTimeoutError(`Execution timed out after ${timeoutMs}ms`)), timeoutMs);
    const onAbort = () => { clearTimeout(t); reject(new ProviderCancellationError()); };
    if (signal) signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (v) => { clearTimeout(t); signal?.removeEventListener("abort", onAbort); resolve(v); },
      (e) => { clearTimeout(t); signal?.removeEventListener("abort", onAbort); reject(e); },
    );
  });
}

export type { SelectionCandidate };
