/**
 * Memory Engine — Typed events + event bus (EDS-001 v2.0 §13).
 *
 * Isomorphic in-worker pub/sub. Listener failures are swallowed so
 * instrumentation never breaks a memory operation. All events carry
 * correlation & causation ids and are versioned by payload.
 */
import type { MemoryClass } from "./types";
import { newCorrelationId } from "./ids";

export type MemoryEventName =
  | "MemoryCreated"
  | "MemoryUpdated"
  | "MemoryDeleted"
  | "MemoryMerged"
  | "MemoryArchived"
  | "MemoryRetrieved"
  | "MemoryForgotten"
  | "MemoryPromoted"
  | "MemoryCompressed";

export interface MemoryEventEnvelope<T = unknown> {
  eventId: string;
  eventName: MemoryEventName;
  eventVersion: number;
  correlationId: string;
  causationId: string | null;
  timestamp: number;
  ownerId: string | null;
  tenantId: string | null;
  payload: T;
  meta?: Record<string, unknown>;
}

// ─── Payload contracts (v1) ─────────────────────────────────────────────────
export interface MemoryCreatedPayload {
  memoryId: string;
  class: MemoryClass;
  kind: string;
  ownerId: string;
  tenantId: string | null;
  scope: string;
  visibility: string;
  confidence: number;
  sourceKind: string;
  evidenceCount: number;
  contentHash: string;
}
export interface MemoryUpdatedPayload {
  memoryId: string;
  changedFields: string[];
  priorVersion: number;
  newVersion: number;
}
export interface MemoryDeletedPayload {
  memoryId: string;
  reason: string;
  actorId: string;
  recoverableUntil: string | null;
}
export interface MemoryMergedPayload {
  mergedIds: string[];
  resultingId: string;
  strategy: string;
}
export interface MemoryArchivedPayload {
  memoryId: string;
  reason: string;
  archivedAt: string;
}
export interface MemoryRetrievedPayload {
  queryHash: string;
  ownerId: string;
  purpose: string;
  itemCount: number;
  degraded: boolean;
  traceHash: string;
}
export interface MemoryForgottenPayload {
  memoryId: string;
  tombstoneHash: string;
  reason: string;
  completedAt: string;
}
export interface MemoryPromotedPayload {
  sourceId: string;
  targetId: string;
  fromClass: MemoryClass;
  toClass: MemoryClass;
  trigger: string;
}
export interface MemoryCompressedPayload {
  sourceIds: string[];
  summaryId: string;
  ratio: number;
}

type PayloadMap = {
  MemoryCreated: MemoryCreatedPayload;
  MemoryUpdated: MemoryUpdatedPayload;
  MemoryDeleted: MemoryDeletedPayload;
  MemoryMerged: MemoryMergedPayload;
  MemoryArchived: MemoryArchivedPayload;
  MemoryRetrieved: MemoryRetrievedPayload;
  MemoryForgotten: MemoryForgottenPayload;
  MemoryPromoted: MemoryPromotedPayload;
  MemoryCompressed: MemoryCompressedPayload;
};

type Listener<N extends MemoryEventName = MemoryEventName> = (
  e: MemoryEventEnvelope<PayloadMap[N]>,
) => void | Promise<void>;

/**
 * MemoryEventPublisher — event bus + transactional-outbox simulation.
 * Listeners are registered once at boot; publish() is fire-and-forget.
 */
export class MemoryEventPublisher {
  private listeners = new Map<MemoryEventName | "*", Set<Listener>>();
  private outbox: MemoryEventEnvelope[] = [];

  on<N extends MemoryEventName>(name: N | "*", listener: Listener<N>): () => void {
    const set = this.listeners.get(name) ?? new Set<Listener>();
    set.add(listener as Listener);
    this.listeners.set(name, set);
    return () => set.delete(listener as Listener);
  }

  publish<N extends MemoryEventName>(
    name: N,
    payload: PayloadMap[N],
    opts: {
      ownerId?: string | null;
      tenantId?: string | null;
      correlationId?: string;
      causationId?: string | null;
      meta?: Record<string, unknown>;
    } = {},
  ): MemoryEventEnvelope<PayloadMap[N]> {
    const env: MemoryEventEnvelope<PayloadMap[N]> = {
      eventId: newCorrelationId("evt"),
      eventName: name,
      eventVersion: 1,
      correlationId: opts.correlationId ?? newCorrelationId("cor"),
      causationId: opts.causationId ?? null,
      timestamp: Date.now(),
      ownerId: opts.ownerId ?? null,
      tenantId: opts.tenantId ?? null,
      payload,
      meta: opts.meta,
    };
    this.outbox.push(env as MemoryEventEnvelope);
    const scoped = this.listeners.get(name);
    const all = this.listeners.get("*");
    const run = (l: Listener) => {
      try {
        const r = l(env as never);
        if (r && typeof (r as Promise<unknown>).catch === "function") {
          (r as Promise<unknown>).catch(() => void 0);
        }
      } catch {
        // instrumentation must never throw
      }
    };
    scoped?.forEach(run);
    all?.forEach(run);
    return env;
  }

  drainOutbox(): MemoryEventEnvelope[] {
    const out = this.outbox;
    this.outbox = [];
    return out;
  }

  peekOutbox(): ReadonlyArray<MemoryEventEnvelope> {
    return this.outbox;
  }
}

/** Module-level singleton used by MemoryManager when no explicit bus is passed. */
export const defaultMemoryEventPublisher = new MemoryEventPublisher();
