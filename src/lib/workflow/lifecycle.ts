/** WAR — lifecycle state machine (validated transitions). */
import { WorkflowTransitionError } from "./errors";
import type { WorkflowInstance, WorkflowLifecycleState, WorkflowTransition } from "./types";

export const WORKFLOW_LIFECYCLE_STATES: readonly WorkflowLifecycleState[] = Object.freeze([
  "draft",
  "registered",
  "scheduled",
  "running",
  "waiting",
  "paused",
  "retrying",
  "compensating",
  "completed",
  "cancelled",
  "failed",
  "archived",
]);

export const WORKFLOW_TRANSITIONS: Readonly<
  Record<WorkflowLifecycleState, readonly WorkflowLifecycleState[]>
> = Object.freeze({
  draft: ["registered", "archived"],
  registered: ["scheduled", "running", "cancelled", "archived"],
  scheduled: ["running", "cancelled", "paused", "archived"],
  running: ["waiting", "paused", "retrying", "compensating", "completed", "cancelled", "failed"],
  waiting: ["running", "paused", "cancelled", "failed", "compensating"],
  paused: ["running", "waiting", "cancelled", "archived"],
  retrying: ["running", "failed", "cancelled", "compensating"],
  compensating: ["failed", "cancelled", "completed"],
  completed: ["archived"],
  cancelled: ["archived"],
  failed: ["archived", "retrying"],
  archived: [],
});

export function canTransition(from: WorkflowLifecycleState, to: WorkflowLifecycleState): boolean {
  return (WORKFLOW_TRANSITIONS[from] ?? []).includes(to);
}

export function assertTransition(from: WorkflowLifecycleState, to: WorkflowLifecycleState): void {
  if (!canTransition(from, to)) throw new WorkflowTransitionError(from, to);
}

export function isTerminal(state: WorkflowLifecycleState): boolean {
  return (
    state === "completed" || state === "cancelled" || state === "failed" || state === "archived"
  );
}

export function transitionInstance(
  instance: WorkflowInstance,
  to: WorkflowLifecycleState,
  at: number,
  reason?: string,
): WorkflowInstance {
  const from = instance.state.status;
  if (from === to) return instance;
  assertTransition(from, to);
  const t: WorkflowTransition = Object.freeze({ from, to, at, reason });
  return Object.freeze({
    ...instance,
    state: Object.freeze({ ...instance.state, status: to }),
    transitions: Object.freeze([...instance.transitions, t]),
    updatedAt: at,
    startedAt: to === "running" && !instance.startedAt ? at : instance.startedAt,
    endedAt: isTerminal(to) ? at : instance.endedAt,
  });
}
