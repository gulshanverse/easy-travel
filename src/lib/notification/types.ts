/**
 * Notification & Communication Platform (P-1.3) — immutable domain models.
 *
 * Every model is frozen. Mutations always return a new object.
 * No provider, transport or vendor concept appears in this file.
 */

export type NotificationChannel = "in_app" | "email" | "push" | "sms";

export type NotificationCategory =
  | "security"
  | "account"
  | "booking"
  | "journey"
  | "workflow"
  | "delay"
  | "price"
  | "weather"
  | "reminder"
  | "agent"
  | "system"
  | "marketing";

export type NotificationPriority = "critical" | "high" | "normal" | "low";

export type NotificationLifecycleState =
  | "created"
  | "suppressed"
  | "scheduled"
  | "queued"
  | "sending"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "dead_lettered"
  | "cancelled";

export type DeliveryState =
  | "pending"
  | "sending"
  | "sent"
  | "delivered"
  | "failed"
  | "skipped"
  | "dead_lettered";

export type SuppressionReason =
  | "category_disabled"
  | "channel_disabled"
  | "frequency_never"
  | "quiet_hours"
  | "duplicate"
  | "rate_limited"
  | "unsubscribed"
  | "recipient_unknown"
  | "consent_missing";

export type FailureKind =
  | "transient"
  | "permanent"
  | "throttled"
  | "invalid_recipient"
  | "render_error"
  | "provider_error";

export interface NotificationRecipient {
  readonly userId: string;
  readonly locale: string;
  readonly timezone: string;
  readonly emailAddress: string | null;
  readonly phoneNumber: string | null;
  readonly pushTokens: readonly string[];
}

export interface NotificationAction {
  readonly id: string;
  readonly label: string;
  readonly href: string | null;
  readonly kind: "primary" | "secondary" | "dismiss";
}

export type TemplateVariables = Readonly<Record<string, string | number | boolean>>;

export interface NotificationSchedule {
  /** Epoch ms at which the notification becomes eligible for dispatch. */
  readonly notBefore: number;
  /** Epoch ms after which delivery is pointless; null = never expires. */
  readonly expiresAt: number | null;
  /** Digest bucket key when the recipient batches this category. */
  readonly digestKey: string | null;
}

export interface Notification {
  readonly id: string;
  readonly type: string;
  readonly category: NotificationCategory;
  readonly priority: NotificationPriority;
  readonly recipient: NotificationRecipient;
  readonly templateId: string;
  readonly variables: TemplateVariables;
  readonly actions: readonly NotificationAction[];
  readonly channels: readonly NotificationChannel[];
  readonly requestedChannels: readonly NotificationChannel[];
  readonly state: NotificationLifecycleState;
  readonly suppression: SuppressionReason | null;
  readonly schedule: NotificationSchedule;
  readonly dedupeKey: string | null;
  readonly idempotencyKey: string | null;
  readonly correlationId: string;
  readonly causationId: string | null;
  readonly groupKey: string | null;
  readonly readAt: number | null;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly metadata: Readonly<Record<string, string | number | boolean>>;
}

export interface DeliveryAttempt {
  readonly attempt: number;
  readonly at: number;
  readonly ok: boolean;
  readonly providerId: string | null;
  readonly failureKind: FailureKind | null;
  readonly detail: string | null;
  readonly durationMs: number;
}

export interface Delivery {
  readonly id: string;
  readonly notificationId: string;
  readonly userId: string;
  readonly channel: NotificationChannel;
  readonly state: DeliveryState;
  readonly attempts: readonly DeliveryAttempt[];
  readonly providerId: string | null;
  readonly providerMessageId: string | null;
  readonly nextAttemptAt: number | null;
  readonly suppression: SuppressionReason | null;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface RenderedMessage {
  readonly channel: NotificationChannel;
  readonly locale: string;
  readonly subject: string | null;
  readonly body: string;
  readonly summary: string;
  readonly actions: readonly NotificationAction[];
  readonly fingerprint: string;
}

export interface DeadLetter {
  readonly id: string;
  readonly notificationId: string;
  readonly deliveryId: string;
  readonly channel: NotificationChannel;
  readonly userId: string;
  readonly failureKind: FailureKind;
  readonly reason: string;
  readonly attempts: number;
  readonly at: number;
  readonly replayedAt: number | null;
}

export interface DigestBucket {
  readonly id: string;
  readonly userId: string;
  readonly key: string;
  readonly category: NotificationCategory;
  readonly notificationIds: readonly string[];
  readonly opensAt: number;
  readonly flushAt: number;
  readonly flushedAt: number | null;
}

export interface InAppItem {
  readonly id: string;
  readonly notificationId: string;
  readonly userId: string;
  readonly category: NotificationCategory;
  readonly priority: NotificationPriority;
  readonly title: string;
  readonly body: string;
  readonly actions: readonly NotificationAction[];
  readonly groupKey: string | null;
  readonly readAt: number | null;
  readonly archivedAt: number | null;
  readonly createdAt: number;
}

export interface NotificationSnapshot {
  readonly notifications: number;
  readonly deliveries: number;
  readonly inApp: number;
  readonly deadLetters: number;
  readonly digests: number;
  readonly templates: number;
  readonly at: number;
}

export const NOTIFICATION_CHANNELS: readonly NotificationChannel[] = Object.freeze([
  "in_app",
  "email",
  "push",
  "sms",
]);

export const NOTIFICATION_CATEGORIES: readonly NotificationCategory[] = Object.freeze([
  "security",
  "account",
  "booking",
  "journey",
  "workflow",
  "delay",
  "price",
  "weather",
  "reminder",
  "agent",
  "system",
  "marketing",
]);

export const NOTIFICATION_PRIORITIES: readonly NotificationPriority[] = Object.freeze([
  "critical",
  "high",
  "normal",
  "low",
]);
