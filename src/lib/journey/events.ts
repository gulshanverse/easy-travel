/**
 * Journey events — typed, correlated, versioned.
 * A minimal in-process bus is provided; the composition root can bridge it
 * onto any external transport without changing the runtime.
 */

import type { JourneyState } from "./types";
import { newCorrelationId, newEventId } from "./ids";

export type JourneyEventName =
  | "JourneyCreated"
  | "JourneyUpdated"
  | "JourneyDeleted"
  | "JourneyStarted"
  | "JourneyPaused"
  | "JourneyCompleted"
  | "JourneyArchived"
  | "JourneyIntentChanged"
  | "JourneyConstraintAdded"
  | "JourneyConstraintRemoved"
  | "JourneyContextUpdated"
  | "JourneyStageChanged"
  | "JourneyTimelineUpdated"
  | "JourneySnapshotCaptured"
  | "JourneyStateChanged";

export interface JourneyEventEnvelope<TPayload = Record<string, unknown>> {
  readonly id: string;
  readonly name: JourneyEventName;
  readonly journeyId: string;
  readonly ownerId: string;
  readonly namespace: string;
  readonly version: number;
  readonly at: string; // ISO
  readonly correlationId: string;
  readonly causationId?: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly payload: TPayload;
}

export interface JourneyStateChangedPayload {
  readonly from: JourneyState;
  readonly to: JourneyState;
}

export type JourneyEventListener = (e: JourneyEventEnvelope) => void;

export class JourneyEventBus {
  private listeners = new Set<JourneyEventListener>();
  private globalListeners = new Set<JourneyEventListener>();
  private byName = new Map<JourneyEventName, Set<JourneyEventListener>>();

  on(name: JourneyEventName, listener: JourneyEventListener): () => void {
    const set = this.byName.get(name) ?? new Set();
    set.add(listener);
    this.byName.set(name, set);
    return () => set.delete(listener);
  }
  onAny(listener: JourneyEventListener): () => void {
    this.globalListeners.add(listener);
    return () => this.globalListeners.delete(listener);
  }
  publish(e: JourneyEventEnvelope): void {
    this.byName.get(e.name)?.forEach((l) => this.safe(l, e));
    this.globalListeners.forEach((l) => this.safe(l, e));
    this.listeners.forEach((l) => this.safe(l, e));
  }
  private safe(l: JourneyEventListener, e: JourneyEventEnvelope): void {
    try { l(e); } catch { /* isolated */ }
  }
  clear(): void {
    this.listeners.clear();
    this.globalListeners.clear();
    this.byName.clear();
  }
}

export function makeEvent<T extends Record<string, unknown>>(input: {
  name: JourneyEventName;
  journeyId: string;
  ownerId: string;
  namespace: string;
  version: number;
  payload: T;
  correlationId?: string;
  causationId?: string;
  metadata?: Record<string, unknown>;
}): JourneyEventEnvelope<T> {
  return Object.freeze({
    id: newEventId(),
    name: input.name,
    journeyId: input.journeyId,
    ownerId: input.ownerId,
    namespace: input.namespace,
    version: input.version,
    at: new Date().toISOString(),
    correlationId: input.correlationId ?? newCorrelationId(),
    causationId: input.causationId,
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
    payload: Object.freeze({ ...input.payload }),
  }) as JourneyEventEnvelope<T>;
}
