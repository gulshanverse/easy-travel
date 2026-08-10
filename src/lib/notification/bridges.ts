/**
 * NCP — integration bridges (ports only, no direct subsystem imports).
 *
 * These adapters translate *structural* shapes from the Identity Platform,
 * the IAM Platform (P-1.2) and the Workflow Runtime into NCP inputs.
 * Nothing here imports another subsystem: every input is a plain shape,
 * so the bridges stay compile-time independent and testable.
 */
import type { NotifyInput } from "./manager";
import type {
  NotificationIdentityPort,
  NotificationPreferenceRecord,
  NotificationRecipientRecord,
  NotificationWorkflowPort,
} from "./ports";
import { makeTemplate, type NotificationTemplate } from "./templates";
import type { NotificationCategory, NotificationChannel } from "./types";

/* ------------------------------------------------------------------ */
/* Identity Platform bridge                                            */
/* ------------------------------------------------------------------ */

/** Structural mirror of the frozen Identity Platform notification settings. */
export interface IdentityNotificationSettingsLike {
  readonly email: boolean;
  readonly sms: boolean;
  readonly push: boolean;
  readonly inApp: boolean;
  readonly reminders: boolean;
  readonly workflowAlerts: boolean;
  readonly delayAlerts: boolean;
  readonly priceAlerts: boolean;
  readonly weatherAlerts: boolean;
  readonly frequency: "instant" | "hourly" | "daily" | "weekly" | "never";
  readonly quietHours: { readonly startHour: number; readonly endHour: number } | null;
}

export function preferencesFromIdentitySettings(
  settings: IdentityNotificationSettingsLike,
): NotificationPreferenceRecord {
  const channels: NotificationChannel[] = [];
  if (settings.inApp) channels.push("in_app");
  if (settings.email) channels.push("email");
  if (settings.push) channels.push("push");
  if (settings.sms) channels.push("sms");
  const categories: Partial<Record<NotificationCategory, boolean>> = {
    security: true,
    account: true,
    booking: true,
    journey: true,
    system: true,
    agent: true,
    marketing: false,
    reminder: settings.reminders,
    workflow: settings.workflowAlerts,
    delay: settings.delayAlerts,
    price: settings.priceAlerts,
    weather: settings.weatherAlerts,
  };
  return Object.freeze({
    channels: Object.freeze(channels),
    categories: Object.freeze(categories),
    quietHours: settings.quietHours,
    frequency: settings.frequency,
  });
}

export interface IdentityBridgeSources {
  recipient(userId: string): Promise<NotificationRecipientRecord | null>;
  settings(userId: string): Promise<IdentityNotificationSettingsLike | null>;
  marketingSuppressed?(userId: string): Promise<boolean>;
}

/** Builds an identity port from Identity Platform readers. */
export function identityPortFromIdentity(
  sources: IdentityBridgeSources,
): NotificationIdentityPort {
  return {
    recipient: (userId) => sources.recipient(userId),
    async preferences(userId) {
      const settings = await sources.settings(userId);
      return settings ? preferencesFromIdentitySettings(settings) : null;
    },
    marketingSuppressed: sources.marketingSuppressed
      ? (userId) => sources.marketingSuppressed!(userId)
      : undefined,
  };
}

/* ------------------------------------------------------------------ */
/* IAM security bridge                                                 */
/* ------------------------------------------------------------------ */

export interface IamEventLike {
  readonly kind: string;
  readonly at: number;
  readonly subjectId: string | null;
  readonly payload?: Readonly<Record<string, unknown>>;
}

export interface SecurityNotificationMapping {
  readonly type: string;
  readonly templateId: string;
  readonly priority: "critical" | "high" | "normal" | "low";
  readonly title: string;
}

/** Security events that are *always* delivered — they bypass preferences. */
export const IAM_SECURITY_NOTIFICATIONS: Readonly<
  Record<string, SecurityNotificationMapping>
> = Object.freeze({
  AccountLocked: {
    type: "security.account_locked",
    templateId: "security.account_alert",
    priority: "critical",
    title: "Your account was locked",
  },
  AccountUnlocked: {
    type: "security.account_unlocked",
    templateId: "security.account_alert",
    priority: "high",
    title: "Your account was unlocked",
  },
  PasswordChanged: {
    type: "security.password_changed",
    templateId: "security.account_alert",
    priority: "high",
    title: "Your password was changed",
  },
  PasswordResetRequested: {
    type: "security.password_reset",
    templateId: "security.account_alert",
    priority: "high",
    title: "A password reset was requested",
  },
  TokenReuseDetected: {
    type: "security.token_reuse",
    templateId: "security.account_alert",
    priority: "critical",
    title: "Suspicious session activity detected",
  },
  SuspiciousLoginDetected: {
    type: "security.suspicious_login",
    templateId: "security.account_alert",
    priority: "critical",
    title: "Suspicious sign-in blocked",
  },
  SecurityRiskDetected: {
    type: "security.risk",
    templateId: "security.account_alert",
    priority: "high",
    title: "Unusual activity on your account",
  },
  DeviceRegistered: {
    type: "security.device_registered",
    templateId: "security.account_alert",
    priority: "normal",
    title: "A new device was added",
  },
  MfaEnrolled: {
    type: "security.mfa_enrolled",
    templateId: "security.account_alert",
    priority: "normal",
    title: "Two-factor authentication enabled",
  },
});

/** Template used by every IAM security bridge notification. */
export const SECURITY_BRIDGE_TEMPLATES: readonly NotificationTemplate[] = Object.freeze([
  makeTemplate({
    id: "security.account_alert",
    category: "security",
    requiredVariables: ["title", "detail"],
    channels: {
      in_app: { subject: "{{title}}", body: "{{detail}}", summary: "{{title}}" },
      email: { subject: "{{title}}", body: "{{detail}}" },
      push: { body: "{{title}}" },
      sms: { body: "Easy Trip: {{title}}" },
    },
  }),
]);

/** Maps an IAM event onto a notify input, or null when it is not notifiable. */
export function securityNotifyInput(event: IamEventLike): NotifyInput | null {
  const mapping = IAM_SECURITY_NOTIFICATIONS[event.kind];
  if (!mapping || !event.subjectId) return null;
  const detail =
    typeof event.payload?.["detail"] === "string"
      ? (event.payload["detail"] as string)
      : `${mapping.title}. If this wasn't you, secure your account now.`;
  return {
    userId: event.subjectId,
    type: mapping.type,
    category: "security",
    templateId: mapping.templateId,
    priority: mapping.priority,
    variables: { title: mapping.title, detail },
    idempotencyKey: `iam:${event.kind}:${event.subjectId}:${event.at}`,
    correlationId: `iam:${event.kind}`,
    metadata: { source: "iam", kind: event.kind },
  };
}

export interface SecurityBridgeTarget {
  notify(input: NotifyInput): Promise<unknown>;
}

/**
 * Subscribes NCP to an IAM event source. Returns the unsubscribe function
 * produced by the source so callers own the lifetime.
 */
export function bridgeIamSecurityEvents(
  source: { on(listener: (event: IamEventLike) => void): () => void },
  target: SecurityBridgeTarget,
  onError: (error: unknown) => void = () => {},
): () => void {
  return source.on((event) => {
    const input = securityNotifyInput(event);
    if (!input) return;
    void Promise.resolve(target.notify(input)).catch(onError);
  });
}

/* ------------------------------------------------------------------ */
/* Workflow bridge                                                     */
/* ------------------------------------------------------------------ */

/** Emits workflow signals for terminal notification outcomes. */
export function workflowSignalBridge(
  workflow: NotificationWorkflowPort,
  events: { on(listener: (event: { kind: string; userId: string | null; notificationId: string | null }) => void): () => void },
  kinds: readonly string[] = [
    "NotificationSent",
    "NotificationDelivered",
    "NotificationDeadLettered",
  ],
): () => void {
  const wanted = new Set(kinds);
  return events.on((event) => {
    if (!wanted.has(event.kind)) return;
    void workflow.signal(`ncp.${event.kind}`, {
      userId: event.userId,
      notificationId: event.notificationId,
    });
  });
}
