/**
 * NCP persisted collections. Each aggregate maps to exactly one collection
 * in the Persistence Platform (P-1.1) — never two.
 */
export const NOTIFICATION_COLLECTIONS = Object.freeze({
  notifications: "ncp_notifications",
  deliveries: "ncp_deliveries",
  inApp: "ncp_inapp_items",
  deadLetters: "ncp_dead_letters",
  digests: "ncp_digests",
  dedupe: "ncp_dedupe_keys",
  idempotency: "ncp_idempotency_keys",
  rateWindows: "ncp_rate_windows",
  subscriptions: "ncp_subscriptions",
  templateVersions: "ncp_template_versions",
} as const);

export type NotificationCollection =
  (typeof NOTIFICATION_COLLECTIONS)[keyof typeof NOTIFICATION_COLLECTIONS];

export const ALL_NOTIFICATION_COLLECTIONS: readonly NotificationCollection[] = Object.freeze(
  Object.values(NOTIFICATION_COLLECTIONS),
);
