/** JSR — typed event bus. */
import { newStudioCausationId, newStudioCorrelationId, newStudioEventId } from "./ids";

export type StudioEventName =
  | "SessionCreated" | "SessionUpdated" | "SessionArchived" | "SessionEnded" | "SessionExpired"
  | "WorkspaceCreated" | "WorkspaceUpdated"
  | "CardAdded" | "CardRemoved" | "CardUpdated" | "CardsMerged" | "CardSplit"
  | "TimelineUpdated" | "TimelineCheckpointCreated" | "TimelineCheckpointRestored"
  | "RevisionCreated" | "RevisionRestored" | "VersionPromoted"
  | "DraftCreated" | "DraftPromoted" | "DraftDiscarded"
  | "ParticipantJoined" | "ParticipantLeft"
  | "SessionLocked" | "SessionUnlocked"
  | "ConflictDetected"
  | "PresentationApplied";

export interface StudioEvent<T = unknown> {
  readonly id: string;
  readonly name: StudioEventName;
  readonly version: number;
  readonly timestamp: number;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly sessionId?: string;
  readonly workspaceId?: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly data: T;
}

export type StudioEventListener = (e: StudioEvent) => void;

export class StudioEventBus {
  private readonly listeners = new Set<StudioEventListener>();
  private readonly all: StudioEvent[] = [];
  private historyLimit = 1024;

  on(l: StudioEventListener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
  emit<T>(input: {
    name: StudioEventName; data: T;
    correlationId?: string; causationId?: string;
    sessionId?: string; workspaceId?: string;
    metadata?: Record<string, unknown>;
  }): StudioEvent<T> {
    const evt: StudioEvent<T> = Object.freeze({
      id: newStudioEventId(),
      name: input.name,
      version: 1,
      timestamp: Date.now(),
      correlationId: input.correlationId ?? newStudioCorrelationId(),
      causationId: input.causationId ?? newStudioCausationId(),
      sessionId: input.sessionId,
      workspaceId: input.workspaceId,
      metadata: Object.freeze({ ...(input.metadata ?? {}) }),
      data: input.data,
    });
    this.all.push(evt);
    if (this.all.length > this.historyLimit) this.all.splice(0, this.all.length - this.historyLimit);
    for (const l of this.listeners) { try { l(evt); } catch { /* ignore */ } }
    return evt;
  }
  history(): readonly StudioEvent[] { return [...this.all]; }
  setHistoryLimit(n: number) { this.historyLimit = Math.max(1, n); }
  clear() { this.listeners.clear(); this.all.length = 0; }
}
