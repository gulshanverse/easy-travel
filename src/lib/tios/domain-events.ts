/**
 * TIOS Strongly-Typed Domain Events (Milestone 5.3).
 * Discriminated union of every platform-level domain event. Every event
 * carries tracing/correlation metadata so downstream sinks can stitch
 * distributed traces.
 */
import { emitTIOSEvent } from "./events";
import type { ExecutionContext } from "./execution-context";
import type { CapabilityId } from "./types";

export interface DomainEventMeta {
  requestId: string;
  correlationId: string;
  traceId: string;
  spanId: string;
  userId?: string | null;
  timestamp: number;
  environment: string;
}

interface WithMeta<Name extends string, Payload> {
  name: Name;
  meta: DomainEventMeta;
  payload: Payload;
}

export type DomainEvent =
  | WithMeta<"JourneyCreated", { journeyId: string; title: string }>
  | WithMeta<"JourneyUpdated", { journeyId: string; changed: string[] }>
  | WithMeta<"JourneyArchived", { journeyId: string; reason?: string }>
  | WithMeta<"ActivityAdded", { journeyId: string; activityId: string }>
  | WithMeta<"ActivityMoved", { journeyId: string; activityId: string; fromDay: number; toDay: number }>
  | WithMeta<"BudgetExceeded", { journeyId: string; over: number; currency: string }>
  | WithMeta<"RecommendationGenerated", { capability: CapabilityId; count: number }>
  | WithMeta<"CapabilityExecuted", { capability: CapabilityId; latencyMs: number; ok: boolean }>
  | WithMeta<"WorkflowStarted", { workflowId: string; steps: number }>
  | WithMeta<"WorkflowCompleted", { workflowId: string; durationMs: number }>
  | WithMeta<"WorkflowFailed", { workflowId: string; error: string }>
  | WithMeta<"ProviderSelected", { capability: CapabilityId; providerId: string }>
  | WithMeta<"ProviderFailed", { capability: CapabilityId; providerId: string; error: string }>
  | WithMeta<"BookingLinked", { journeyId: string; bookingId: string; provider: string }>;

export type DomainEventName = DomainEvent["name"];

type Listener<E extends DomainEvent = DomainEvent> = (event: E) => void | Promise<void>;

const listeners = new Map<DomainEventName | "*", Set<Listener>>();

export function onDomainEvent<Name extends DomainEventName>(
  name: Name | "*",
  listener: Listener<Extract<DomainEvent, { name: Name }>>,
): () => void {
  if (!listeners.has(name)) listeners.set(name, new Set());
  listeners.get(name)!.add(listener as Listener);
  return () => listeners.get(name)?.delete(listener as Listener);
}

function metaFromCtx(ctx: ExecutionContext): DomainEventMeta {
  return {
    requestId: ctx.requestId,
    correlationId: ctx.correlationId,
    traceId: ctx.tracing.traceId,
    spanId: ctx.tracing.spanId,
    userId: ctx.userId,
    timestamp: Date.now(),
    environment: ctx.environment,
  };
}

/** Emit a typed domain event. Also mirrors into the generic TIOS event bus. */
export function emitDomainEvent<E extends DomainEvent>(
  ctx: ExecutionContext,
  name: E["name"],
  payload: E["payload"],
): void {
  const event = { name, meta: metaFromCtx(ctx), payload } as unknown as DomainEvent;
  const buckets = [listeners.get(event.name), listeners.get("*")];
  for (const bucket of buckets) {
    if (!bucket) continue;
    for (const l of bucket) {
      try {
        const r = (l as Listener)(event);
        if (r && typeof (r as Promise<unknown>).then === "function") {
          (r as Promise<unknown>).catch(() => void 0);
        }
      } catch { /* instrumentation must never throw */ }
    }
  }
  // Bridge to generic bus for observability listeners already registered.
  emitTIOSEvent({
    name: "DECISION_CREATED",
    requestId: ctx.requestId,
    timestamp: event.meta.timestamp,
    userId: ctx.userId ?? null,
    data: { domain: event.name, ...(event.payload as object) },
  });
}
