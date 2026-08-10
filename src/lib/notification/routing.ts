/**
 * NCP — routing & preference evaluation.
 *
 * Deterministic: the same (preferences, notification, hour) always produce
 * the same routing decision. NCP never overrides an explicit user choice
 * except for `critical` security notifications (ADR-031).
 */
import type { NotificationPreferenceRecord } from "./ports";
import type {
  NotificationCategory,
  NotificationChannel,
  NotificationPriority,
  SuppressionReason,
} from "./types";
import { NOTIFICATION_CHANNELS } from "./types";

export interface RoutingDecision {
  readonly allowed: boolean;
  readonly channels: readonly NotificationChannel[];
  readonly suppression: SuppressionReason | null;
  readonly digest: boolean;
  readonly reason: string;
}

export const DEFAULT_PREFERENCES: NotificationPreferenceRecord = Object.freeze({
  channels: Object.freeze<NotificationChannel[]>(["in_app", "email", "push"]),
  categories: Object.freeze({}),
  quietHours: null,
  frequency: "instant",
  unsubscribedCategories: Object.freeze([]),
});

/** Categories that can never be disabled by preference. */
export const MANDATORY_CATEGORIES: readonly NotificationCategory[] = Object.freeze([
  "security",
  "account",
]);

/** Channels a category may legitimately use, in fallback order. */
export const CATEGORY_CHANNEL_ORDER: Readonly<
  Record<NotificationCategory, readonly NotificationChannel[]>
> = Object.freeze({
  security: Object.freeze<NotificationChannel[]>(["in_app", "email", "push", "sms"]),
  account: Object.freeze<NotificationChannel[]>(["in_app", "email"]),
  booking: Object.freeze<NotificationChannel[]>(["in_app", "email", "push"]),
  journey: Object.freeze<NotificationChannel[]>(["in_app", "push", "email"]),
  workflow: Object.freeze<NotificationChannel[]>(["in_app", "push"]),
  delay: Object.freeze<NotificationChannel[]>(["push", "in_app", "sms"]),
  price: Object.freeze<NotificationChannel[]>(["in_app", "push", "email"]),
  weather: Object.freeze<NotificationChannel[]>(["in_app", "push"]),
  reminder: Object.freeze<NotificationChannel[]>(["push", "in_app", "email"]),
  agent: Object.freeze<NotificationChannel[]>(["in_app", "push"]),
  system: Object.freeze<NotificationChannel[]>(["in_app", "email"]),
  marketing: Object.freeze<NotificationChannel[]>(["email"]),
});

export function isMandatory(category: NotificationCategory): boolean {
  return MANDATORY_CATEGORIES.includes(category);
}

export function categoryEnabled(
  prefs: NotificationPreferenceRecord,
  category: NotificationCategory,
): boolean {
  if (isMandatory(category)) return true;
  if ((prefs.unsubscribedCategories ?? []).includes(category)) return false;
  return prefs.categories[category] ?? category !== "marketing";
}

export function inQuietHours(
  quietHours: { readonly startHour: number; readonly endHour: number } | null,
  hour: number,
): boolean {
  if (!quietHours) return false;
  const { startHour, endHour } = quietHours;
  if (startHour === endHour) return false;
  return startHour < endHour
    ? hour >= startHour && hour < endHour
    : hour >= startHour || hour < endHour;
}

/** Local hour for a recipient timezone, computed without external libraries. */
export function localHour(at: number, timezone: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      hour12: false,
    }).formatToParts(new Date(at));
    const hour = parts.find((p) => p.type === "hour")?.value;
    return hour ? Number(hour) % 24 : new Date(at).getUTCHours();
  } catch {
    return new Date(at).getUTCHours();
  }
}

export interface RouteInput {
  readonly preferences: NotificationPreferenceRecord;
  readonly category: NotificationCategory;
  readonly priority: NotificationPriority;
  readonly requestedChannels: readonly NotificationChannel[];
  readonly enabledChannels: readonly NotificationChannel[];
  readonly availableChannels: readonly NotificationChannel[];
  readonly quietHoursBypass: readonly NotificationPriority[];
  readonly hour: number;
  readonly marketingSuppressed?: boolean;
}

function orderChannels(
  category: NotificationCategory,
  channels: readonly NotificationChannel[],
): readonly NotificationChannel[] {
  const order = CATEGORY_CHANNEL_ORDER[category];
  return Object.freeze(
    [...new Set(channels)].sort((a, b) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      return (
        (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) ||
        NOTIFICATION_CHANNELS.indexOf(a) - NOTIFICATION_CHANNELS.indexOf(b)
      );
    }),
  );
}

export function route(input: RouteInput): RoutingDecision {
  const { preferences: prefs, category, priority } = input;
  const critical = priority === "critical";

  if (category === "marketing" && input.marketingSuppressed) {
    return decision(false, [], "unsubscribed", false, "marketing consent withdrawn");
  }
  if (!categoryEnabled(prefs, category)) {
    return decision(false, [], "category_disabled", false, `category ${category} disabled`);
  }
  if (prefs.frequency === "never" && !critical) {
    return decision(false, [], "frequency_never", false, "frequency set to never");
  }

  const requested = input.requestedChannels.length
    ? input.requestedChannels
    : CATEGORY_CHANNEL_ORDER[category];

  let channels = requested.filter(
    (c) =>
      input.enabledChannels.includes(c) &&
      input.availableChannels.includes(c) &&
      CATEGORY_CHANNEL_ORDER[category].includes(c) &&
      (critical || prefs.channels.includes(c) || c === "in_app"),
  );

  if (channels.length === 0) {
    return decision(false, [], "channel_disabled", false, "no eligible channel");
  }

  const quiet =
    inQuietHours(prefs.quietHours, input.hour) && !input.quietHoursBypass.includes(priority);
  if (quiet) {
    const inApp = channels.filter((c) => c === "in_app");
    if (inApp.length === 0) {
      return decision(false, [], "quiet_hours", true, "quiet hours — deferred to digest");
    }
    return decision(true, orderChannels(category, inApp), null, true, "quiet hours — in-app only");
  }

  const digest = !critical && prefs.frequency !== "instant";
  channels = [...orderChannels(category, channels)];
  return decision(true, Object.freeze(channels), null, digest, digest ? "batched" : "instant");
}

function decision(
  allowed: boolean,
  channels: readonly NotificationChannel[],
  suppression: SuppressionReason | null,
  digest: boolean,
  reason: string,
): RoutingDecision {
  return Object.freeze({
    allowed,
    channels: Object.freeze([...channels]),
    suppression,
    digest,
    reason,
  });
}

/** Digest bucket length implied by the recipient frequency preference. */
export function digestWindowMs(
  frequency: NotificationPreferenceRecord["frequency"],
  fallback: number,
): number {
  switch (frequency) {
    case "hourly":
      return 60 * 60_000;
    case "daily":
      return 24 * 60 * 60_000;
    case "weekly":
      return 7 * 24 * 60 * 60_000;
    default:
      return fallback;
  }
}
