/** Provider Gateway (P-1.4) — default policies and configuration. */
import type {
  ProviderCachePolicy,
  ProviderCircuitPolicy,
  ProviderLimits,
  ProviderPolicy,
  ProviderRetryPolicy,
} from "./types";

export const DEFAULT_RETRY_POLICY: ProviderRetryPolicy = Object.freeze({
  maxAttempts: 3,
  baseDelayMs: 50,
  maxDelayMs: 2_000,
  jitter: true,
  retryBudget: 100,
  retryNonIdempotent: false,
});

export const DEFAULT_CIRCUIT_POLICY: ProviderCircuitPolicy = Object.freeze({
  failureThreshold: 5,
  successThreshold: 2,
  openDurationMs: 30_000,
});

export const DEFAULT_CACHE_POLICY: ProviderCachePolicy = Object.freeze({
  enabled: true,
  ttlMs: 60_000,
  staleWhileRevalidateMs: 30_000,
});

export const DEFAULT_PROVIDER_LIMITS: ProviderLimits = Object.freeze({
  requestsPerMinute: 600,
  concurrency: 32,
  maxRequestBytes: 256 * 1024,
  maxResponseBytes: 2 * 1024 * 1024,
  requestTimeoutMs: 5_000,
  connectionTimeoutMs: 2_000,
  totalDeadlineMs: 15_000,
});

export const DEFAULT_PROVIDER_POLICY: ProviderPolicy = Object.freeze({
  retry: DEFAULT_RETRY_POLICY,
  circuit: DEFAULT_CIRCUIT_POLICY,
  cache: DEFAULT_CACHE_POLICY,
  budget: Object.freeze({}),
  priority: 0,
  failoverAllowed: true,
  allowNonIdempotentFailover: false,
});

export function mergeProviderPolicy(p?: Partial<ProviderPolicy>): ProviderPolicy {
  return Object.freeze({
    ...DEFAULT_PROVIDER_POLICY,
    ...(p ?? {}),
    retry: Object.freeze({ ...DEFAULT_RETRY_POLICY, ...(p?.retry ?? {}) }),
    circuit: Object.freeze({ ...DEFAULT_CIRCUIT_POLICY, ...(p?.circuit ?? {}) }),
    cache: Object.freeze({ ...DEFAULT_CACHE_POLICY, ...(p?.cache ?? {}) }),
    budget: Object.freeze({ ...(p?.budget ?? {}) }),
  });
}

export function mergeProviderLimits(l?: Partial<ProviderLimits>): ProviderLimits {
  return Object.freeze({ ...DEFAULT_PROVIDER_LIMITS, ...(l ?? {}) });
}

export interface GatewayConfiguration {
  readonly environment: "test" | "sandbox" | "staging" | "production";
  readonly sandboxOnly: boolean;
  readonly enforceAllowlist: boolean;
  readonly enforceRateLimits: boolean;
  readonly enforceConcurrency: boolean;
  readonly enforceBudget: boolean;
  readonly enforceIdempotency: boolean;
  readonly enforceCaching: boolean;
  readonly enforceCircuitBreaker: boolean;
  readonly enforceDataMinimization: boolean;
  readonly maxRequestBytes: number;
  readonly maxResponseBytes: number;
  readonly defaultDeadlineMs: number;
}

export const DEFAULT_GATEWAY_CONFIGURATION: GatewayConfiguration = Object.freeze({
  environment: "test",
  sandboxOnly: true,
  enforceAllowlist: true,
  enforceRateLimits: true,
  enforceConcurrency: true,
  enforceBudget: true,
  enforceIdempotency: true,
  enforceCaching: true,
  enforceCircuitBreaker: true,
  enforceDataMinimization: true,
  maxRequestBytes: 256 * 1024,
  maxResponseBytes: 2 * 1024 * 1024,
  defaultDeadlineMs: 15_000,
});

export function loadGatewayConfiguration(
  overrides?: Partial<GatewayConfiguration>,
): GatewayConfiguration {
  return Object.freeze({ ...DEFAULT_GATEWAY_CONFIGURATION, ...(overrides ?? {}) });
}
