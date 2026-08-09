/**
 * NCP — deterministic event bus. Events are facts, never commands.
 */
import { newNotificationEventId } from "./ids";
import type { NotificationChannel } from "./types";

export type NotificationEventKind =
  | "NotificationCreated"
  | "NotificationSuppressed"
  | "NotificationDeduplicated"
  | "NotificationRateLimited"
  | "NotificationScheduled"
  | "NotificationQueued"
  | "NotificationRendered"
  | "NotificationSent"
  | "NotificationDelivered"
  | "NotificationFailed"
  | "NotificationRetryScheduled"
  | "NotificationDeadLettered"
  | "NotificationRead"
  | "NotificationArchived"
  | "NotificationCancelled"
  | "DigestOpened"
  | "DigestFlushed"
  | "ChannelRegistered"
  | "TemplateRegistered"
  | "SubscriptionChanged";

export interface NotificationEvent {
  readonly id: string;
  readonly kind: NotificationEventKind;
  readonly at: number;
  readonly userId: string | null;
  readonly notificationId: string | null;
  readonly channel: NotificationChannel | null;
  readonly correlationId: string;
  readonly causationId: string | null;
  readonly version: number;
  readonly payload: Readonly<Record<string, unknown>>;
}

export const NOTIFICATION_EVENT_VERSION = 1;

export type NotificationEventListener = (event: NotificationEvent) => void;

export interface EmitNotificationEvent {
  readonly kind: NotificationEventKind;
  readonly at: number;
  readonly userId?: string | null;
  readonly notificationId?: string | null;
  readonly channel?: NotificationChannel | null;
  readonly correlationId?: string;
  readonly causationId?: string | null;
  readonly payload?: Readonly<Record<string, unknown>>;
}

export class NotificationEventBus {
  private readonly listeners = new Set<NotificationEventListener>();
  private readonly log: NotificationEvent[] = [];

  on(listener: NotificationEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(input: EmitNotificationEvent): NotificationEvent {
    const event: NotificationEvent = Object.freeze({
      id: newNotificationEventId(),
      kind: input.kind,
      at: input.at,
      userId: input.userId ?? null,
      notificationId: input.notificationId ?? null,
      channel: input.channel ?? null,
      correlationId: input.correlationId ?? input.notificationId ?? "ncp",
      causationId: input.causationId ?? null,
      version: NOTIFICATION_EVENT_VERSION,
      payload: Object.freeze({ ...(input.payload ?? {}) }),
    });
    this.log.push(event);
    for (const listener of this.listeners) listener(event);
    return event;
  }

  history(): readonly NotificationEvent[] {
    return Object.freeze([...this.log]);
  }

  clear(): void {
    this.log.length = 0;
  }
}
