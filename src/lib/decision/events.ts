/**
 * Decision events — typed, correlated, versioned.
 * In-process bus; adapters bridge to external transports.
 */

import { newCorrelationId, newEventId } from "./ids";
import type { DecisionState } from "./types";

export type DecisionEventName =
  | "DecisionCreated"
  | "DecisionUpdated"
  | "DecisionDeleted"
  | "DecisionContextCollected"
  | "DecisionOptionsGenerated"
  | "DecisionScored"
  | "DecisionConstraintsApplied"
  | "DecisionRanked"
  | "DecisionTradeoffsComputed"
  | "DecisionExplained"
  | "DecisionValidated"
  | "DecisionApproved"
  | "DecisionArchived"
  | "DecisionFailed"
  | "DecisionSnapshotCaptured"
  | "DecisionStateChanged";

export interface DecisionEventEnvelope<TPayload = Record<string, unknown>> {
  readonly id: string;
  readonly name: DecisionEventName;
  readonly decisionId: string;
  readonly ownerId: string;
  readonly namespace: string;
  readonly version: number;
  readonly at: string; // ISO
  readonly correlationId: string;
  readonly causationId?: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly payload: TPayload;
}

export interface DecisionStateChangedPayload {
  readonly from: DecisionState;
  readonly to: DecisionState;
}

export type DecisionEventListener = (e: DecisionEventEnvelope) => void;

export class DecisionEventBus {
  private globalListeners = new Set<DecisionEventListener>();
  private byName = new Map<DecisionEventName, Set<DecisionEventListener>>();

  on(name: DecisionEventName, l: DecisionEventListener): () => void {
    const set = this.byName.get(name) ?? new Set();
    set.add(l);
    this.byName.set(name, set);
    return () => set.delete(l);
  }
  onAny(l: DecisionEventListener): () => void {
    this.globalListeners.add(l);
    return () => this.globalListeners.delete(l);
  }
  publish(e: DecisionEventEnvelope): void {
    this.byName.get(e.name)?.forEach((l) => this.safe(l, e));
    this.globalListeners.forEach((l) => this.safe(l, e));
  }
  private safe(l: DecisionEventListener, e: DecisionEventEnvelope): void {
    try { l(e); } catch { /* isolated */ }
  }
  clear(): void {
    this.globalListeners.clear();
    this.byName.clear();
  }
}

export function makeEvent<T extends Record<string, unknown>>(input: {
  name: DecisionEventName;
  decisionId: string;
  ownerId: string;
  namespace: string;
  version: number;
  payload: T;
  correlationId?: string;
  causationId?: string;
  metadata?: Record<string, unknown>;
}): DecisionEventEnvelope<T> {
  return Object.freeze({
    id: newEventId(),
    name: input.name,
    decisionId: input.decisionId,
    ownerId: input.ownerId,
    namespace: input.namespace,
    version: input.version,
    at: new Date().toISOString(),
    correlationId: input.correlationId ?? newCorrelationId(),
    causationId: input.causationId,
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
    payload: Object.freeze({ ...input.payload }),
  }) as DecisionEventEnvelope<T>;
}
