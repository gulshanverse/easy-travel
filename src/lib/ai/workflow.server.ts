/**
 * AI Core — Workflow Engine.
 * Orchestrates multiple agent calls with sequential, parallel, conditional,
 * retry, timeout, and cancellation semantics. Backend-agnostic: any step
 * can call an agent, a tool, or arbitrary async logic.
 */
import { runAgent } from "./agents.server";
import { emitAIEvent } from "./events";
import type { AIRequestContext } from "./types";

export type WorkflowStepStatus = "pending" | "running" | "succeeded" | "failed" | "skipped";

export interface WorkflowStepResult {
  id: string;
  status: WorkflowStepStatus;
  output?: unknown;
  error?: { code: string; message: string };
  startedAt: number;
  endedAt: number;
}

export type StepExecutor = (
  state: WorkflowState,
  ctx: AIRequestContext,
  signal: AbortSignal,
) => Promise<unknown>;

export interface WorkflowStep {
  id: string;
  /** Skip this step when the predicate returns false. */
  when?: (state: WorkflowState) => boolean;
  execute: StepExecutor;
  retries?: number;
  timeoutMs?: number;
  /** When true, failure fails the whole workflow. Default true. */
  required?: boolean;
}

export interface WorkflowDefinition {
  id: string;
  description?: string;
  /** Groups run sequentially. Steps inside a group run in parallel. */
  groups: WorkflowStep[][];
}

export interface WorkflowState {
  workflowId: string;
  requestId: string;
  outputs: Record<string, unknown>;
  results: Record<string, WorkflowStepResult>;
}

export interface WorkflowRunResult {
  ok: boolean;
  state: WorkflowState;
  failedStep?: string;
  error?: { code: string; message: string };
  durationMs: number;
}

function newRequestId(prefix = "wf") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function withTimeout<T>(p: Promise<T>, ms: number, signal: AbortSignal): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, reject) => {
      const t = setTimeout(() => reject(new Error(`Step timed out after ${ms}ms`)), ms);
      signal.addEventListener("abort", () => {
        clearTimeout(t);
        reject(new Error("Cancelled"));
      });
    }),
  ]);
}

async function runStep(
  step: WorkflowStep,
  state: WorkflowState,
  ctx: AIRequestContext,
  parentSignal: AbortSignal,
): Promise<WorkflowStepResult> {
  const startedAt = Date.now();

  if (step.when && !step.when(state)) {
    return { id: step.id, status: "skipped", startedAt, endedAt: Date.now() };
  }

  const attempts = Math.max(1, (step.retries ?? 0) + 1);
  const timeoutMs = step.timeoutMs ?? 60_000;
  let lastErr: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (parentSignal.aborted) break;
    emitAIEvent({
      name: "WORKFLOW_STEP_STARTED",
      requestId: state.requestId,
      data: { workflowId: state.workflowId, step: step.id, attempt },
    });
    try {
      const output = await withTimeout(step.execute(state, ctx, parentSignal), timeoutMs, parentSignal);
      const result: WorkflowStepResult = {
        id: step.id,
        status: "succeeded",
        output,
        startedAt,
        endedAt: Date.now(),
      };
      emitAIEvent({
        name: "WORKFLOW_STEP_COMPLETED",
        requestId: state.requestId,
        data: { workflowId: state.workflowId, step: step.id, durationMs: result.endedAt - startedAt },
      });
      return result;
    } catch (err) {
      lastErr = err;
      if (parentSignal.aborted) break;
    }
  }

  const message = lastErr instanceof Error ? lastErr.message : String(lastErr);
  const result: WorkflowStepResult = {
    id: step.id,
    status: "failed",
    error: { code: "step_failed", message },
    startedAt,
    endedAt: Date.now(),
  };
  emitAIEvent({
    name: "WORKFLOW_STEP_FAILED",
    requestId: state.requestId,
    data: { workflowId: state.workflowId, step: step.id, message },
  });
  return result;
}

export interface RunWorkflowOptions {
  ctx: AIRequestContext;
  input?: Record<string, unknown>;
  signal?: AbortSignal;
}

export async function runWorkflow(
  workflow: WorkflowDefinition,
  options: RunWorkflowOptions,
): Promise<WorkflowRunResult> {
  const startedAt = Date.now();
  const state: WorkflowState = {
    workflowId: workflow.id,
    requestId: newRequestId(),
    outputs: { ...(options.input ?? {}) },
    results: {},
  };
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  options.signal?.addEventListener("abort", onAbort);

  try {
    for (const group of workflow.groups) {
      if (controller.signal.aborted) break;
      const stepResults = await Promise.all(
        group.map((step) => runStep(step, state, options.ctx, controller.signal)),
      );
      for (let i = 0; i < stepResults.length; i++) {
        const r = stepResults[i];
        const step = group[i];
        state.results[r.id] = r;
        if (r.status === "succeeded") state.outputs[r.id] = r.output;
        if (r.status === "failed" && (step.required ?? true)) {
          controller.abort();
          emitAIEvent({
            name: "WORKFLOW_FAILED",
            requestId: state.requestId,
            data: { workflowId: workflow.id, failedStep: r.id, message: r.error?.message },
          });
          return {
            ok: false,
            state,
            failedStep: r.id,
            error: r.error,
            durationMs: Date.now() - startedAt,
          };
        }
      }
    }
    emitAIEvent({
      name: "WORKFLOW_COMPLETED",
      requestId: state.requestId,
      data: { workflowId: workflow.id, durationMs: Date.now() - startedAt },
    });
    return { ok: true, state, durationMs: Date.now() - startedAt };
  } finally {
    options.signal?.removeEventListener("abort", onAbort);
  }
}

// -------------------- Convenience step builders --------------------

/** Run a registered agent as a workflow step. Output stored under step.id. */
export function agentStep(
  id: string,
  agentName: string,
  buildInput: (state: WorkflowState) => unknown,
  opts?: Omit<WorkflowStep, "id" | "execute">,
): WorkflowStep {
  return {
    id,
    ...opts,
    execute: async (state, ctx) => {
      const input = buildInput(state);
      const result = await runAgent(agentName, input, { ...ctx, agent: agentName });
      return { output: result.output, model: result.model, usage: result.usage };
    },
  };
}

/** Wrap an arbitrary async function as a workflow step. */
export function taskStep(
  id: string,
  fn: StepExecutor,
  opts?: Omit<WorkflowStep, "id" | "execute">,
): WorkflowStep {
  return { id, ...opts, execute: fn };
}
