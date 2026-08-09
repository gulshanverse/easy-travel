/**
 * NCP — configuration. Deterministic defaults; production assertions.
 */
import { NotificationConfigError } from "./errors";
import type { NotificationChannel, NotificationPriority } from "./types";

export interface RetryConfig {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly factor: number;
  /** Deterministic jitter ratio in [0,1); applied from a stable hash, not Math.random. */
  readonly jitterRatio: number;
}

export interface RateLimitConfig {
  readonly windowMs: number;
  readonly maxPerWindow: number;
  readonly maxPerChannelPerWindow: number;
}

export interface NotificationConfig {
  readonly environment: "development" | "test" | "production";
  readonly defaultLocale: string;
  readonly fallbackLocale: string;
  readonly defaultTimezone: string;
  readonly channels: readonly NotificationChannel[];
  readonly retry: RetryConfig;
  readonly rateLimit: RateLimitConfig;
  readonly dedupeWindowMs: number;
  readonly digestWindowMs: number;
  readonly quietHoursBypass: readonly NotificationPriority[];
  readonly maxBatchSize: number;
  readonly maxBodyLength: number;
  readonly retentionMs: number;
  readonly deadLetterEnabled: boolean;
  readonly auditEnabled: boolean;
}

export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = Object.freeze({
  environment: "development",
  defaultLocale: "en",
  fallbackLocale: "en",
  defaultTimezone: "UTC",
  channels: Object.freeze<NotificationChannel[]>(["in_app", "email", "push", "sms"]),
  retry: Object.freeze({
    maxAttempts: 5,
    baseDelayMs: 1_000,
    maxDelayMs: 300_000,
    factor: 2,
    jitterRatio: 0.2,
  }),
  rateLimit: Object.freeze({
    windowMs: 60_000,
    maxPerWindow: 60,
    maxPerChannelPerWindow: 30,
  }),
  dedupeWindowMs: 5 * 60_000,
  digestWindowMs: 60 * 60_000,
  quietHoursBypass: Object.freeze<NotificationPriority[]>(["critical"]),
  maxBatchSize: 100,
  maxBodyLength: 4_000,
  retentionMs: 90 * 24 * 60 * 60_000,
  deadLetterEnabled: true,
  auditEnabled: true,
});

export function createNotificationConfig(
  patch: Partial<NotificationConfig> = {},
): NotificationConfig {
  const config: NotificationConfig = Object.freeze({
    ...DEFAULT_NOTIFICATION_CONFIG,
    ...patch,
    retry: Object.freeze({ ...DEFAULT_NOTIFICATION_CONFIG.retry, ...(patch.retry ?? {}) }),
    rateLimit: Object.freeze({ ...DEFAULT_NOTIFICATION_CONFIG.rateLimit, ...(patch.rateLimit ?? {}) }),
    channels: Object.freeze([...(patch.channels ?? DEFAULT_NOTIFICATION_CONFIG.channels)]),
    quietHoursBypass: Object.freeze([
      ...(patch.quietHoursBypass ?? DEFAULT_NOTIFICATION_CONFIG.quietHoursBypass),
    ]),
  });
  validateNotificationConfig(config);
  return config;
}

export function validateNotificationConfig(config: NotificationConfig): void {
  if (config.retry.maxAttempts < 1) {
    throw new NotificationConfigError("retry.maxAttempts must be >= 1");
  }
  if (config.retry.factor < 1) throw new NotificationConfigError("retry.factor must be >= 1");
  if (config.retry.jitterRatio < 0 || config.retry.jitterRatio >= 1) {
    throw new NotificationConfigError("retry.jitterRatio must be in [0,1)");
  }
  if (config.rateLimit.windowMs <= 0) {
    throw new NotificationConfigError("rateLimit.windowMs must be > 0");
  }
  if (config.channels.length === 0) {
    throw new NotificationConfigError("at least one channel must be enabled");
  }
  if (config.maxBatchSize < 1) throw new NotificationConfigError("maxBatchSize must be >= 1");
}

/** Production hardening gate — mirrors the P-1.1/P-1.2 assertion style. */
export function assertProductionNotificationConfig(config: NotificationConfig): void {
  if (config.environment !== "production") return;
  if (!config.deadLetterEnabled) {
    throw new NotificationConfigError("dead-letter queue is mandatory in production");
  }
  if (!config.auditEnabled) {
    throw new NotificationConfigError("audit logging is mandatory in production");
  }
  if (config.retry.maxAttempts < 3) {
    throw new NotificationConfigError("production requires retry.maxAttempts >= 3");
  }
  if (config.retentionMs <= 0) {
    throw new NotificationConfigError("production requires a positive retention window");
  }
}
