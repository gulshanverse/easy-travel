/** CTOR — WorkflowRuntime, builder, executor, scheduler. */
import { ExecutionCancelledError, ExecutionTimeoutError, WorkflowExecutionError } from "./errors";
import { computeBackoffMs, resolveStepPolicy, type CTORPolicies } from "./policies";
import { computeLayers, topologicalSort } from "./dependency";
import { childContext, snapshotContext, withVariables } from "./context";
import type {
  ExecutionContext, StepResult, StepStatus, WorkflowDefinition, WorkflowRunResult, WorkflowStep,
} from "./types";
import type { CTOREventBus } from "./events";
import type { CTORMetrics } from "./metrics";
import type { CTORTelemetrySink } from "./telemetry";

export interface WorkflowBuilderOptions {
  id?: string; name: string; version: string; metadata?: Record<string, string>;
}
export class WorkflowBuilder {
  private steps: WorkflowStep[] = [];
  constructor(private readonly opts: WorkflowBuilderOptions) {}
  add(s: WorkflowStep): this { this.steps.push(Object.freeze({ ...s, dependsOn: Object.freeze([...s.dependsOn]) })); return this; }
  build(): WorkflowDefinition {
    // Local import avoids circular via factories
    const { makeWorkflow } = require("./factories") as typeof import("./factories");
    return makeWorkflow({ ...this.opts, steps: this.steps });
  }
}

export interface ExecuteWorkflowOptions {
  readonly context: ExecutionContext;
  readonly policies: CTORPolicies;
  readonly events: CTOREventBus;
  readonly metrics: CTORMetrics;
  readonly telemetry: CTORTelemetrySink;
  readonly signal?: AbortSignal;
  readonly now?: () => number;
}

async function runOne(
  step: WorkflowStep,
  ctx: ExecutionContext,
  inputs: Record<string, unknown>,
  opts: ExecuteWorkflowOptions,
): Promise<StepResult> {
  const now = opts.now ?? Date.now;
  const resolved = resolveStepPolicy(step.policy, opts.policies);
  const startedAt = now();
  if (step.when && !step.when(ctx, inputs)) {
    opts.events.emit({ name: "StepSkipped", correlationId: ctx.correlation.correlationId, data: { stepId: step.id } });
    return { id: step.id, status: "skipped", attempts: 0, startedAt, endedAt: now() };
  }
  const maxAttempts = Math.max(1, resolved.retry.maxAttempts);
  let attempts = 0; let lastErr: unknown;
  while (attempts < maxAttempts) {
    if (ctx.signal.aborted) throw new ExecutionCancelledError();
    attempts++;
    opts.events.emit({ name: "StepStarted", correlationId: ctx.correlation.correlationId, data: { stepId: step.id, attempt: attempts } });
    try {
      if (!step.execute) throw new WorkflowExecutionError(`Step ${step.id} has no executor`, step.id);
      const timeoutMs = resolved.timeoutMs;
      const p = Promise.resolve(step.execute(ctx, inputs));
      const output = await Promise.race([
        p,
        new Promise<never>((_, rej) => {
          const t = setTimeout(() => rej(new ExecutionTimeoutError(timeoutMs)), timeoutMs);
          ctx.signal.addEventListener("abort", () => { clearTimeout(t); rej(new ExecutionCancelledError()); });
        }),
      ]);
      const endedAt = now();
      opts.events.emit({ name: "StepCompleted", correlationId: ctx.correlation.correlationId, data: { stepId: step.id, ms: endedAt - startedAt } });
      opts.telemetry.record({ kind: "trace", level: "info", message: `step:${step.id}`, timestamp: endedAt, attributes: { attempts, ms: endedAt - startedAt } });
      return { id: step.id, status: "succeeded", output, attempts, startedAt, endedAt };
    } catch (err) {
      lastErr = err;
      if (err instanceof ExecutionTimeoutError) opts.metrics.timeout();
      if (attempts < maxAttempts) {
        opts.metrics.retry();
        opts.events.emit({ name: "ExecutionRetried", correlationId: ctx.correlation.correlationId, data: { stepId: step.id, attempt: attempts } });
        const wait = computeBackoffMs(attempts + 1, resolved.retry);
        if (wait > 0) await new Promise(r => setTimeout(r, wait));
      }
    }
  }
  const endedAt = now();
  const message = lastErr instanceof Error ? lastErr.message : String(lastErr);
  opts.events.emit({ name: "StepFailed", correlationId: ctx.correlation.correlationId, data: { stepId: step.id, message } });
  return { id: step.id, status: "failed", error: message, attempts, startedAt, endedAt };
}

export async function executeWorkflow(
  workflow: WorkflowDefinition,
  opts: ExecuteWorkflowOptions,
): Promise<WorkflowRunResult> {
  const now = opts.now ?? Date.now;
  const startedAt = now();
  const events = opts.events;
  const layers = computeLayers(workflow.steps);
  const outputs: Record<string, unknown> = {};
  const statuses: Record<string, StepStatus> = {};
  const stepResults: StepResult[] = [];
  const controller = new AbortController();
  const parentSignal = opts.signal ?? opts.context.signal;
  const onAbort = () => controller.abort();
  parentSignal.addEventListener("abort", onAbort);
  let ctx: ExecutionContext = childContext({ ...opts.context, signal: controller.signal }, `workflow:${workflow.id}`, controller.signal);
  ctx = { ...ctx, workflowId: workflow.id } as ExecutionContext;

  events.emit({ name: "WorkflowStarted", correlationId: ctx.correlation.correlationId, data: { workflowId: workflow.id } });
  opts.metrics.workflowStarted();

  let failedStep: string | undefined; let failedError: string | undefined;
  const concurrency = Math.max(1, opts.policies.maxConcurrency);

  try {
    for (const layer of layers) {
      if (controller.signal.aborted) break;
      // Bounded concurrency
      for (let i = 0; i < layer.length; i += concurrency) {
        const chunk = layer.slice(i, i + concurrency);
        const results = await Promise.all(chunk.map(step => runOne(step, ctx, outputs, opts)));
        for (const r of results) {
          statuses[r.id] = r.status;
          stepResults.push(r);
          const step = layer.find(s => s.id === r.id)!;
          if (r.status === "succeeded") {
            outputs[r.id] = r.output;
            ctx = withVariables(ctx, { [r.id]: r.output });
            if (step.checkpoint) {
              events.emit({ name: "WorkflowCheckpoint", correlationId: ctx.correlation.correlationId, data: { workflowId: workflow.id, stepId: r.id, snapshot: snapshotContext(ctx, statuses) } });
            }
          } else if (r.status === "failed") {
            const required = resolveStepPolicy(step.policy, opts.policies).required;
            if (required && opts.policies.failurePolicy === "fail-fast") {
              failedStep = r.id; failedError = r.error;
              controller.abort();
              break;
            }
          }
        }
        if (failedStep) break;
      }
      if (failedStep) break;
    }
  } finally {
    parentSignal.removeEventListener("abort", onAbort);
  }

  const durationMs = now() - startedAt;
  if (controller.signal.aborted && !failedStep && parentSignal.aborted) {
    opts.metrics.workflowCancelled();
    events.emit({ name: "WorkflowCancelled", correlationId: ctx.correlation.correlationId, data: { workflowId: workflow.id } });
    return { workflowId: workflow.id, executionId: ctx.executionId, status: "cancelled", outputs, steps: stepResults, durationMs };
  }
  if (failedStep) {
    opts.metrics.workflowFailed(durationMs);
    events.emit({ name: "WorkflowFailed", correlationId: ctx.correlation.correlationId, data: { workflowId: workflow.id, failedStep, error: failedError } });
    return { workflowId: workflow.id, executionId: ctx.executionId, status: "failed", outputs, steps: stepResults, durationMs, failedStep, error: failedError };
  }
  opts.metrics.workflowCompleted(durationMs);
  events.emit({ name: "WorkflowCompleted", correlationId: ctx.correlation.correlationId, data: { workflowId: workflow.id, ms: durationMs } });
  return { workflowId: workflow.id, executionId: ctx.executionId, status: "completed", outputs, steps: stepResults, durationMs };
}

export class WorkflowValidator {
  static validate(w: WorkflowDefinition): void { topologicalSort(w.steps); }
}

export class WorkflowScheduler {
  private queue: Array<{ workflow: WorkflowDefinition; run: () => Promise<WorkflowRunResult> }> = [];
  private running = 0;
  constructor(private readonly maxConcurrency: number = 4) {}
  schedule(workflow: WorkflowDefinition, run: () => Promise<WorkflowRunResult>): Promise<WorkflowRunResult> {
    return new Promise((resolve, reject) => {
      const task = async () => {
        this.running++;
        try { resolve(await run()); } catch (e) { reject(e); }
        finally { this.running--; this.drain(); }
      };
      if (this.running < this.maxConcurrency) task();
      else this.queue.push({ workflow, run: task as unknown as () => Promise<WorkflowRunResult> });
    });
  }
  private drain(): void {
    while (this.running < this.maxConcurrency && this.queue.length) {
      const next = this.queue.shift()!;
      (next.run as unknown as () => void)();
    }
  }
  pending(): number { return this.queue.length; }
  inFlight(): number { return this.running; }
}

export class WorkflowPlanner {
  static plan(workflow: WorkflowDefinition): readonly (readonly WorkflowStep[])[] {
    return computeLayers(workflow.steps);
  }
}
