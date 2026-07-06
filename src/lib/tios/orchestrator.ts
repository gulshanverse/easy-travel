/**
 * TIOS Orchestration Engine.
 * Coordinates capabilities, workflows, and events with retries, parallel
 * execution, cancellation, and per-step compensation.
 */
import { emitTIOSEvent, makeRequestId } from "./events";
import type { DecisionContext } from "./types";

export interface WorkflowStep<TIn = unknown, TOut = unknown> {
  id: string;
  run: (input: TIn, ctx: DecisionContext, signal?: AbortSignal) => Promise<TOut>;
  compensate?: (output: TOut, ctx: DecisionContext) => Promise<void>;
  retries?: number;         // default 0
  timeoutMs?: number;       // default 30_000
  optional?: boolean;       // failure doesn't fail the workflow
}

export interface WorkflowGroup {
  id: string;
  mode: "sequential" | "parallel";
  steps: WorkflowStep[];
}

export interface WorkflowDefinition {
  id: string;
  groups: WorkflowGroup[];
}

export interface WorkflowResult {
  workflowId: string;
  outputs: Record<string, unknown>;
  errors: Record<string, string>;
  durationMs: number;
  cancelled: boolean;
}

async function runStep(
  step: WorkflowStep,
  input: unknown,
  ctx: DecisionContext,
  signal: AbortSignal,
): Promise<unknown> {
  const attempts = (step.retries ?? 0) + 1;
  const timeout = step.timeoutMs ?? 30_000;
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    if (signal.aborted) throw new Error("workflow cancelled");
    try {
      return await Promise.race([
        step.run(input, ctx, signal),
        new Promise((_, rej) => setTimeout(() => rej(new Error("step timeout")), timeout)),
      ]);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function runWorkflow(
  def: WorkflowDefinition,
  initialInput: unknown,
  ctx: DecisionContext,
  signal: AbortSignal = new AbortController().signal,
): Promise<WorkflowResult> {
  const start = Date.now();
  const outputs: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  const completed: Array<{ step: WorkflowStep; output: unknown }> = [];

  emitTIOSEvent({
    name: "WORKFLOW_STARTED",
    requestId: ctx.requestId,
    timestamp: Date.now(),
    data: { workflowId: def.id },
  });

  try {
    for (const group of def.groups) {
      if (signal.aborted) break;
      if (group.mode === "parallel") {
        const settled = await Promise.allSettled(
          group.steps.map((s) => runStep(s, initialInput, ctx, signal)),
        );
        settled.forEach((r, i) => {
          const s = group.steps[i];
          if (r.status === "fulfilled") {
            outputs[s.id] = r.value;
            completed.push({ step: s, output: r.value });
          } else if (!s.optional) {
            errors[s.id] = r.reason instanceof Error ? r.reason.message : String(r.reason);
          }
        });
      } else {
        for (const step of group.steps) {
          if (signal.aborted) break;
          try {
            const out = await runStep(step, initialInput, ctx, signal);
            outputs[step.id] = out;
            completed.push({ step, output: out });
          } catch (err) {
            if (!step.optional) {
              errors[step.id] = err instanceof Error ? err.message : String(err);
              throw err;
            }
          }
        }
      }
    }

    emitTIOSEvent({
      name: "WORKFLOW_COMPLETED",
      requestId: ctx.requestId,
      timestamp: Date.now(),
      data: { workflowId: def.id, steps: completed.length },
    });
  } catch (err) {
    // Compensate in reverse order.
    for (const { step, output } of completed.reverse()) {
      try { await step.compensate?.(output, ctx); } catch { /* ignore */ }
    }
    emitTIOSEvent({
      name: "WORKFLOW_FAILED",
      requestId: ctx.requestId,
      timestamp: Date.now(),
      data: { workflowId: def.id, error: err instanceof Error ? err.message : String(err) },
    });
  }

  return {
    workflowId: def.id,
    outputs,
    errors,
    durationMs: Date.now() - start,
    cancelled: signal.aborted,
  };
}

/** Convenience: turn a plain function into a workflow step. */
export function step<TIn, TOut>(
  id: string,
  fn: WorkflowStep<TIn, TOut>["run"],
  opts?: Partial<Omit<WorkflowStep<TIn, TOut>, "id" | "run">>,
): WorkflowStep<TIn, TOut> {
  return { id, run: fn, ...(opts ?? {}) };
}

export { makeRequestId };
