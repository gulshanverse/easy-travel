/** WAR — typed event bus with deterministic routing. */
import { newWorkflowEventId } from "./ids";

export type WorkflowEventName =
  | "WorkflowCreated" | "WorkflowRegistered" | "WorkflowScheduled" | "WorkflowStarted"
  | "WorkflowPaused" | "WorkflowResumed" | "WorkflowCompleted" | "WorkflowCancelled"
  | "WorkflowFailed" | "WorkflowRetried" | "WorkflowArchived"
  | "CheckpointCreated" | "TimeoutOccurred"
  | "CompensationStarted" | "CompensationCompleted"
  | "StepStarted" | "StepCompleted" | "StepFailed" | "StepSkipped" | "StepWaiting"
  | "SignalReceived" | "TimerFired" | "ConnectorEvent" | "AgentEvent" | "InternalEvent"
  | "ScheduledEvent";

export interface WorkflowEvent {
  readonly id: string;
  readonly name: WorkflowEventName;
  readonly at: number;
  readonly definitionId?: string;
  readonly instanceId?: string;
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly data?: Readonly<Record<string, unknown>>;
}

export type WorkflowEventListener = (e: WorkflowEvent) => void;

export class WorkflowEventBus {
  private readonly all: WorkflowEventListener[] = [];
  private readonly byName = new Map<WorkflowEventName, WorkflowEventListener[]>();
  private readonly log: WorkflowEvent[] = [];

  on(l: WorkflowEventListener): () => void {
    this.all.push(l);
    return () => { const i = this.all.indexOf(l); if (i >= 0) this.all.splice(i, 1); };
  }
  onEvent(name: WorkflowEventName, l: WorkflowEventListener): () => void {
    const list = this.byName.get(name) ?? [];
    list.push(l);
    this.byName.set(name, list);
    return () => { const i = list.indexOf(l); if (i >= 0) list.splice(i, 1); };
  }
  emit(e: Omit<WorkflowEvent, "id" | "at"> & { at?: number }): WorkflowEvent {
    const full: WorkflowEvent = Object.freeze({ id: newWorkflowEventId(), at: e.at ?? Date.now(), ...e });
    this.log.push(full);
    // Deterministic routing: named listeners first (registration order), then global.
    for (const l of this.byName.get(full.name) ?? []) l(full);
    for (const l of this.all) l(full);
    return full;
  }
  history(): readonly WorkflowEvent[] { return [...this.log]; }
  clear(): void { this.all.length = 0; this.byName.clear(); this.log.length = 0; }
}
