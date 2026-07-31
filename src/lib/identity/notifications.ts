/**
 * Identity Platform — Notification preference engine.
 * Deterministic rule evaluation. No transport, no delivery, no providers.
 */
import { deepFreeze } from "./factories";
import type {
  NotificationCategory, NotificationChannel, NotificationSettings,
} from "./types";
import { validateNotificationSettings } from "./validation";

export interface NotificationRule {
  readonly category: NotificationCategory;
  readonly enabled: boolean;
  readonly channels: readonly NotificationChannel[];
}

export interface NotificationDecision {
  readonly category: NotificationCategory;
  readonly allowed: boolean;
  readonly channels: readonly NotificationChannel[];
  readonly reason: string;
}

export function updateNotificationSettings(
  current: NotificationSettings,
  patch: Partial<Omit<NotificationSettings, "userId">>,
  at: number,
): NotificationSettings {
  return validateNotificationSettings(deepFreeze({
    ...current,
    ...patch,
    quietHours: patch.quietHours === undefined ? current.quietHours : patch.quietHours,
    updatedAt: at,
  }));
}

export function enabledChannels(s: NotificationSettings): readonly NotificationChannel[] {
  const channels: NotificationChannel[] = [];
  if (s.email) channels.push("email");
  if (s.sms) channels.push("sms");
  if (s.push) channels.push("push");
  if (s.inApp) channels.push("in_app");
  return Object.freeze(channels);
}

function categoryEnabled(s: NotificationSettings, category: NotificationCategory): boolean {
  switch (category) {
    case "reminder": return s.reminders;
    case "workflow": return s.workflowAlerts;
    case "delay": return s.delayAlerts;
    case "price": return s.priceAlerts;
    case "weather": return s.weatherAlerts;
    case "marketing": return false;
    case "security": return true;
  }
}

export function notificationRules(s: NotificationSettings): readonly NotificationRule[] {
  const channels = enabledChannels(s);
  const categories: NotificationCategory[] = [
    "reminder", "workflow", "delay", "price", "weather", "marketing", "security",
  ];
  return Object.freeze(categories.map((category) => Object.freeze({
    category,
    enabled: categoryEnabled(s, category),
    channels: categoryEnabled(s, category) ? channels : Object.freeze([]),
  })));
}

export function inQuietHours(s: NotificationSettings, hour: number): boolean {
  if (!s.quietHours) return false;
  const { startHour, endHour } = s.quietHours;
  if (startHour === endHour) return false;
  return startHour < endHour
    ? hour >= startHour && hour < endHour
    : hour >= startHour || hour < endHour;
}

export function evaluateNotification(
  s: NotificationSettings,
  input: { category: NotificationCategory; hour?: number },
): NotificationDecision {
  const channels = enabledChannels(s);
  if (!categoryEnabled(s, input.category)) {
    return deepFreeze({
      category: input.category, allowed: false, channels: [], reason: "category_disabled",
    });
  }
  if (channels.length === 0) {
    return deepFreeze({
      category: input.category, allowed: false, channels: [], reason: "no_channels",
    });
  }
  if (s.frequency === "never") {
    return deepFreeze({
      category: input.category, allowed: false, channels: [], reason: "frequency_never",
    });
  }
  if (input.hour !== undefined && inQuietHours(s, input.hour) && input.category !== "security") {
    return deepFreeze({
      category: input.category,
      allowed: false,
      channels: Object.freeze(channels.filter((c) => c === "in_app")),
      reason: "quiet_hours",
    });
  }
  return deepFreeze({
    category: input.category, allowed: true, channels, reason: "allowed",
  });
}

/** Monitoring workflow definition ids requested when an alert rule is on. */
export const NOTIFICATION_WORKFLOW_MAP: Readonly<Record<string, string>> = Object.freeze({
  delay: "workflow.multimodal.flight_monitoring",
  price: "workflow.multimodal.hotel_price_monitoring",
  weather: "workflow.multimodal.weather_monitoring",
});

export function requiredWorkflows(s: NotificationSettings): readonly string[] {
  const out: string[] = [];
  if (s.delayAlerts) out.push(NOTIFICATION_WORKFLOW_MAP.delay);
  if (s.priceAlerts) out.push(NOTIFICATION_WORKFLOW_MAP.price);
  if (s.weatherAlerts) out.push(NOTIFICATION_WORKFLOW_MAP.weather);
  return Object.freeze(out);
}
