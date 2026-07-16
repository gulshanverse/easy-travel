/**
 * Trust & Evidence Engine — typed event bus.
 * Fully in-process; correlation ids let callers stitch causation chains.
 */
export type TrustEventName =
  | "EvidenceAdded" | "EvidenceUpdated" | "EvidenceRejected"
  | "ConflictDetected" | "ConflictResolved"
  | "TrustCalculated" | "TrustUpdated"
  | "SourceRegistered" | "SourceInvalidated"
  | "ConfidenceCalculated" | "DecisionMade";

export interface TrustEvent {
  readonly name: TrustEventName;
  readonly at: number;
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly subject?: string;
  readonly data: Readonly<Record<string, unknown>>;
}

export type TrustEventListener = (event: TrustEvent) => void;

export class TrustEventBus {
  private readonly listeners = new Set<TrustEventListener>();
  emit(event: TrustEvent): void {
    for (const l of this.listeners) {
      try { l(event); } catch { /* isolate listener failures */ }
    }
  }
  on(listener: TrustEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  clear(): void { this.listeners.clear(); }
  get size(): number { return this.listeners.size; }
}
