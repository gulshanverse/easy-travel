/** IPCF — runtime configuration. */
export interface IntegrationConfig {
  readonly maxConnectors: number;
  readonly defaultRequestTimeoutMs: number;
  readonly defaultRetryMaxAttempts: number;
  readonly defaultRetryBaseDelayMs: number;
  readonly defaultRetryMaxDelayMs: number;
  readonly defaultRateLimitPerMinute: number;
  readonly defaultConcurrency: number;
  readonly circuitFailureThreshold: number;
  readonly circuitOpenCooldownMs: number;
  readonly dlqMaxEntries: number;
  readonly eventHistoryLimit: number;
  readonly pollingMinIntervalMs: number;
  readonly webhookMaxDeliveries: number;
}
export const DEFAULT_INTEGRATION_CONFIG: IntegrationConfig = Object.freeze({
  maxConnectors: 512,
  defaultRequestTimeoutMs: 15_000,
  defaultRetryMaxAttempts: 3,
  defaultRetryBaseDelayMs: 100,
  defaultRetryMaxDelayMs: 5_000,
  defaultRateLimitPerMinute: 600,
  defaultConcurrency: 8,
  circuitFailureThreshold: 5,
  circuitOpenCooldownMs: 30_000,
  dlqMaxEntries: 1024,
  eventHistoryLimit: 2048,
  pollingMinIntervalMs: 250,
  webhookMaxDeliveries: 512,
});
export function mergeIntegrationConfig(p?: Partial<IntegrationConfig>): IntegrationConfig {
  return Object.freeze({ ...DEFAULT_INTEGRATION_CONFIG, ...(p ?? {}) });
}
