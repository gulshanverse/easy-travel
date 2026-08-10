/**
 * NCP — notification lifecycle state machine. Deterministic and replayable.
 */
import { InvalidLifecycleTransitionError } from "./errors";
import type { DeliveryState, NotificationLifecycleState } from "./types";

const TRANSITIONS: Readonly<
  Record<NotificationLifecycleState, readonly NotificationLifecycleState[]>
> = Object.freeze({
  created: Object.freeze(["scheduled", "queued", "suppressed", "cancelled"]),
  suppressed: Object.freeze([]),
  scheduled: Object.freeze(["queued", "cancelled", "suppressed"]),
  queued: Object.freeze(["sending", "cancelled", "failed"]),
  sending: Object.freeze(["sent", "failed", "queued"]),
  sent: Object.freeze(["delivered", "read", "failed"]),
  delivered: Object.freeze(["read"]),
  read: Object.freeze([]),
  failed: Object.freeze(["queued", "dead_lettered", "cancelled"]),
  dead_lettered: Object.freeze(["queued"]),
  cancelled: Object.freeze([]),
} as Record<NotificationLifecycleState, readonly NotificationLifecycleState[]>);

export const TERMINAL_STATES: readonly NotificationLifecycleState[] = Object.freeze([
  "suppressed",
  "read",
  "cancelled",
]);

export function canTransition(
  from: NotificationLifecycleState,
  to: NotificationLifecycleState,
): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(
  from: NotificationLifecycleState,
  to: NotificationLifecycleState,
): void {
  if (!canTransition(from, to)) throw new InvalidLifecycleTransitionError(from, to);
}

export function isTerminal(state: NotificationLifecycleState): boolean {
  return TERMINAL_STATES.includes(state);
}

const DELIVERY_TRANSITIONS: Readonly<Record<DeliveryState, readonly DeliveryState[]>> =
  Object.freeze({
    pending: Object.freeze(["sending", "skipped", "failed"]),
    sending: Object.freeze(["sent", "failed"]),
    sent: Object.freeze(["delivered", "failed"]),
    delivered: Object.freeze([]),
    failed: Object.freeze(["pending", "dead_lettered"]),
    skipped: Object.freeze([]),
    dead_lettered: Object.freeze(["pending"]),
  } as Record<DeliveryState, readonly DeliveryState[]>);

export function canDeliveryTransition(from: DeliveryState, to: DeliveryState): boolean {
  return DELIVERY_TRANSITIONS[from].includes(to);
}

export function assertDeliveryTransition(from: DeliveryState, to: DeliveryState): void {
  if (!canDeliveryTransition(from, to)) throw new InvalidLifecycleTransitionError(from, to);
}

/** Roll-up of per-channel delivery states into the notification state. */
export function aggregateState(
  current: NotificationLifecycleState,
  deliveries: readonly DeliveryState[],
): NotificationLifecycleState {
  if (deliveries.length === 0) return current;
  if (deliveries.some((d) => d === "delivered")) return "delivered";
  if (deliveries.some((d) => d === "sent")) return "sent";
  if (deliveries.every((d) => d === "dead_lettered")) return "dead_lettered";
  if (deliveries.every((d) => d === "failed" || d === "dead_lettered")) return "failed";
  if (deliveries.some((d) => d === "sending")) return "sending";
  return current;
}
