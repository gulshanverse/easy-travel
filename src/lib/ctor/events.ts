/** CTOR — typed event bus. */
import { newCausationId, newCorrelationId, newEventId } from "./ids";

export type CTOREventName =
  | "CapabilityRegistered" | "CapabilityUpdated" | "CapabilityRemoved"
  | "ToolRegistered" | "ToolUpdated" | "ToolRemoved" | "ToolInvoked"
  | "WorkflowRegistered" | "WorkflowStarted" | "WorkflowCheckpoint"
  | "WorkflowCompleted" | "WorkflowCancelled" | "WorkflowFailed"
  | "StepStarted" | "StepCompleted" | "StepFailed" | "StepSkipped"
  | "ExecutionRetried" | "ExecutionTimedOut" | "ExecutionCancelled"
  | "DependencyResolved";

export interface CTOREvent<T = unknown> {
  readonly id: string;
  readonly name: CTOREventName;
  readonly version: number;
  readonly timestamp: number;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly data: T;
}

export type CTOREventListener = (e: CTOREvent) => void;

export class CTOREventBus {
  private readonly listeners = new Set<CTOREventListener>();
  private readonly all: CTOREvent[] = [];
  private historyLimit = 1024;

  on(l: CTOREventListener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
  emit<T>(input: {
    name: CTOREventName; data: T;
    correlationId?: string; causationId?: string;
    metadata?: Record<string, unknown>;
  }): CTOREvent<T> {
    const evt: CTOREvent<T> = Object.freeze({
      id: newEventId(),
      name: input.name,
      version: 1,
      timestamp: Date.now(),
      correlationId: input.correlationId ?? newCorrelationId(),
      causationId: input.causationId ?? newCausationId(),
      metadata: Object.freeze({ ...(input.metadata ?? {}) }),
      data: input.data,
    });
    this.all.push(evt);
    if (this.all.length > this.historyLimit) this.all.splice(0, this.all.length - this.historyLimit);
    for (const l of this.listeners) { try { l(evt); } catch { /* ignore */ } }
    return evt;
  }
  history(): readonly CTOREvent[] { return [...this.all]; }
  clear(): void { this.listeners.clear(); this.all.length = 0; }
}
