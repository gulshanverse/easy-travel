/** WAR — execution history + deterministic replay (ADR-015). */
import type {
  WorkflowDefinition,
  WorkflowHistoryRecord,
  WorkflowInstance,
  WorkflowLifecycleState,
  WorkflowState,
  WorkflowStepStatus,
} from "./types";

export function appendHistory(
  instance: WorkflowInstance,
  record: Omit<WorkflowHistoryRecord, "seq">,
  maxRecords = 2_000,
): WorkflowInstance {
  const next: WorkflowHistoryRecord = Object.freeze({ seq: instance.history.length, ...record });
  const history = [...instance.history, next];
  while (history.length > maxRecords) history.shift();
  return Object.freeze({ ...instance, history: Object.freeze(history), updatedAt: record.at });
}

export interface ReplayResult {
  readonly status: WorkflowLifecycleState;
  readonly steps: Readonly<Record<string, WorkflowStepStatus>>;
  readonly outputs: Readonly<Record<string, unknown>>;
  readonly records: number;
}

/** Deterministically rebuilds terminal workflow state from history alone. */
export function replayWorkflow(
  def: WorkflowDefinition,
  history: readonly WorkflowHistoryRecord[],
): ReplayResult {
  const steps: Record<string, WorkflowStepStatus> = {};
  for (const s of def.steps) steps[s.id] = "pending";
  const outputs: Record<string, unknown> = {};
  let status: WorkflowLifecycleState = "registered";

  for (const r of [...history].sort((a, b) => a.seq - b.seq)) {
    switch (r.kind) {
      case "started":
        status = "running";
        break;
      case "paused":
        status = "paused";
        break;
      case "resumed":
        status = "running";
        break;
      case "step-started":
        if (r.stepId) steps[r.stepId] = "running";
        break;
      case "step-waiting":
        if (r.stepId) steps[r.stepId] = "waiting";
        status = "waiting";
        break;
      case "step-succeeded":
        if (r.stepId) {
          steps[r.stepId] = "succeeded";
          outputs[r.stepId] = r.data?.output;
        }
        if (status === "waiting") status = "running";
        break;
      case "step-failed":
        if (r.stepId) steps[r.stepId] = "failed";
        break;
      case "step-skipped":
        if (r.stepId) steps[r.stepId] = "skipped";
        break;
      case "compensation-started":
        status = "compensating";
        break;
      case "compensation-step":
        if (r.stepId) steps[r.stepId] = "compensated";
        break;
      case "completed":
        status = "completed";
        break;
      case "cancelled":
        status = "cancelled";
        break;
      case "failed":
        status = "failed";
        break;
      case "archived":
        status = "archived";
        break;
      default:
        break;
    }
  }
  return Object.freeze({
    status,
    steps: Object.freeze(steps),
    outputs: Object.freeze(outputs),
    records: history.length,
  });
}

export function replayMatchesState(replay: ReplayResult, state: WorkflowState): boolean {
  if (replay.status !== state.status) return false;
  const keys = new Set([...Object.keys(replay.steps), ...Object.keys(state.steps)]);
  for (const k of keys) if (replay.steps[k] !== state.steps[k]) return false;
  return true;
}
