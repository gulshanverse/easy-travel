/**
 * Capability-scoped event helpers. Thin wrapper on top of the TIOS event bus
 * so services never touch the bus directly.
 */
import { emitTIOSEvent, makeRequestId, onTIOSEvent, type TIOSEventName } from "@/lib/tios/events";
import type { CapabilityId } from "@/lib/tios/types";

export type CapabilityEventName =
  | "PlannerGenerated"
  | "BudgetCalculated"
  | "RecommendationCreated"
  | "WeatherAnalyzed"
  | "SearchCompleted"
  | "MapResolved"
  | "JourneyUpdated";

export interface CapabilityEvent<T = unknown> {
  name: CapabilityEventName;
  capability: CapabilityId;
  requestId: string;
  timestamp: number;
  userId?: string | null;
  data?: T;
}

const listeners = new Map<CapabilityEventName | "*", Set<(e: CapabilityEvent) => void>>();

export function onCapabilityEvent(
  name: CapabilityEventName | "*",
  l: (e: CapabilityEvent) => void,
): () => void {
  if (!listeners.has(name)) listeners.set(name, new Set());
  listeners.get(name)!.add(l);
  return () => listeners.get(name)?.delete(l);
}

export function emitCapabilityEvent<T>(e: CapabilityEvent<T>): void {
  for (const bucket of [listeners.get(e.name), listeners.get("*")]) {
    if (!bucket) continue;
    for (const fn of bucket) {
      try { fn(e as CapabilityEvent); } catch { /* noop */ }
    }
  }
  // Mirror into TIOS event bus for observability.
  emitTIOSEvent({
    name: "DECISION_CREATED" satisfies TIOSEventName,
    requestId: e.requestId,
    timestamp: e.timestamp,
    capability: e.capability,
    userId: e.userId ?? null,
    data: { capabilityEvent: e.name, ...(e.data as object | undefined) },
  });
}

export const capabilityRequestId = (prefix = "cap") => makeRequestId(prefix);
