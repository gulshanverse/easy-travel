/**
 * TIE — Domain Event Bus.
 * Piggybacks on the AI event bus infrastructure so tracing and observability
 * unify. TIE events use a distinct namespace and never collide with AI ones.
 */

import { emitAIEvent, onAIEvent, type AIEvent } from "@/lib/ai/events";

export type TIEEventName =
  | "TRIP_CREATED"
  | "TRIP_UPDATED"
  | "TRIP_STATE_CHANGED"
  | "TRIP_DELETED"
  | "DAY_ADDED"
  | "DAY_UPDATED"
  | "DAY_REMOVED"
  | "ACTIVITY_ADDED"
  | "ACTIVITY_UPDATED"
  | "ACTIVITY_MOVED"
  | "ACTIVITY_REMOVED"
  | "BUDGET_CHANGED"
  | "BUDGET_WARNING"
  | "AI_RECOMMENDATION_CREATED"
  | "AI_RECOMMENDATION_APPLIED"
  | "TIMELINE_UPDATED"
  | "COLLABORATOR_ADDED"
  | "COLLABORATOR_REMOVED"
  | "COLLABORATOR_ROLE_CHANGED"
  | "VERSION_CREATED"
  | "VERSION_ROLLED_BACK"
  | "EXPORT_CREATED"
  | "BOOKING_LINKED"
  | "BOOKING_UNLINKED";

const TIE_PREFIX = "TIE:" as const;
type NamespacedName = `${typeof TIE_PREFIX}${TIEEventName}`;

export interface TIEEvent<T = unknown> {
  name: TIEEventName;
  tripId: string | null;
  userId: string | null;
  actorId?: string | null;
  requestId?: string;
  timestamp: number;
  data?: T;
}

export function emitTIEEvent<T>(evt: Omit<TIEEvent<T>, "timestamp"> & { timestamp?: number }): void {
  const full: TIEEvent<T> = { timestamp: Date.now(), ...evt };
  // Bridge onto AI event bus so a single instrumentation stack sees both.
  emitAIEvent<TIEEvent<T>>({
    name: (TIE_PREFIX + full.name) as unknown as AIEvent["name"],
    requestId: full.requestId ?? cryptoRandom(),
    userId: full.userId ?? undefined,
    data: full,
  });
}

export function onTIEEvent(
  name: TIEEventName | "*",
  listener: (evt: TIEEvent) => void | Promise<void>,
): () => void {
  const target: NamespacedName | "*" =
    name === "*" ? "*" : (TIE_PREFIX + name as NamespacedName);
  return onAIEvent(target as unknown as AIEvent["name"], (aiEvt) => {
    // For "*" we still want to filter to TIE-namespaced events only.
    if (name === "*" && !String(aiEvt.name).startsWith(TIE_PREFIX)) return;
    listener(aiEvt.data as TIEEvent);
  });
}

function cryptoRandom(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `tie-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
