/** CTOR — ExecutionContext utilities. */
import { newCorrelationId, newExecutionId } from "./ids";
import type { ExecutionContext, ExecutionSnapshot, ExecutionVariables, StepStatus } from "./types";

let spanCounter = 0;
const nextSpan = (): string => `span_${(spanCounter = (spanCounter + 1) >>> 0).toString(36)}`;

export interface CreateExecutionContextInput {
  executionId?: string;
  workflowId?: string;
  correlationId?: string;
  causationId?: string;
  traceId?: string;
  parentSpanId?: string;
  scopeName?: string;
  variables?: ExecutionVariables;
  labels?: Record<string, string>;
  signal?: AbortSignal;
  deadline?: number;
  now?: number;
}

export function createExecutionContext(i: CreateExecutionContextInput = {}): ExecutionContext {
  const executionId = i.executionId ?? newExecutionId();
  const correlationId = i.correlationId ?? newCorrelationId();
  const now = i.now ?? Date.now();
  return Object.freeze({
    executionId,
    workflowId: i.workflowId,
    scope: Object.freeze({ name: i.scopeName ?? "root", depth: 0 }),
    variables: Object.freeze({ ...(i.variables ?? {}) }),
    metadata: Object.freeze({
      correlationId, causationId: i.causationId, startedAt: now,
      labels: Object.freeze({ ...(i.labels ?? {}) }),
    }),
    correlation: Object.freeze({
      correlationId, causationId: i.causationId, parentSpanId: i.parentSpanId,
      spanId: nextSpan(), traceId: i.traceId ?? correlationId,
    }),
    signal: i.signal ?? new AbortController().signal,
    deadline: i.deadline,
  });
}

/** Return a new immutable context with merged variables. */
export function withVariables(ctx: ExecutionContext, patch: ExecutionVariables): ExecutionContext {
  return Object.freeze({ ...ctx, variables: Object.freeze({ ...ctx.variables, ...patch }) });
}

/** Derive a child context (scope depth +1, parent span linkage). */
export function childContext(parent: ExecutionContext, scopeName: string, signal?: AbortSignal): ExecutionContext {
  return Object.freeze({
    ...parent,
    scope: Object.freeze({ name: scopeName, depth: parent.scope.depth + 1 }),
    correlation: Object.freeze({
      correlationId: parent.correlation.correlationId,
      causationId: parent.correlation.spanId,
      parentSpanId: parent.correlation.spanId,
      spanId: nextSpan(),
      traceId: parent.correlation.traceId,
    }),
    signal: signal ?? parent.signal,
  });
}

export function snapshotContext(ctx: ExecutionContext, statuses: Record<string, StepStatus>): ExecutionSnapshot {
  return Object.freeze({
    executionId: ctx.executionId,
    takenAt: Date.now(),
    variables: Object.freeze({ ...ctx.variables }),
    stepStatuses: Object.freeze({ ...statuses }),
  });
}

export function validateContext(ctx: ExecutionContext): void {
  if (!ctx.executionId) throw new Error("ExecutionContext.executionId required");
  if (!ctx.correlation?.correlationId) throw new Error("ExecutionContext.correlation.correlationId required");
}
