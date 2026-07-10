/**
 * Provider Runtime — Configuration + Policies.
 * Immutable, environment-driven, no hardcoded provider values.
 */
import { ProviderConfigurationError } from "./errors";

export type Environment = "development" | "staging" | "production" | "test";

export interface RetryPolicy {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  multiplier: number;
  jitter: boolean;
  retryBudgetMs: number;
}

export interface CircuitBreakerPolicy {
  failureThreshold: number;
  successThreshold: number;
  openCooldownMs: number;
  halfOpenProbes: number;
}

export interface HealthPolicy {
  heartbeatIntervalMs: number;
  latencyDegradedMs: number;
  latencyUnavailableMs: number;
  recoveryProbeSuccesses: number;
}

export interface FallbackPolicy {
  enabled: boolean;
  maxFallbacks: number;
  gracefulDegradation: boolean;
}

export interface BudgetPolicy {
  defaultMaxCost?: number;
  hardCostCeiling?: number;
  hardTokenCeiling?: number;
}

export interface ExecutionPolicy {
  defaultTimeoutMs: number;
  streamingTimeoutMs: number;
  maxConcurrent: number;
  backpressureQueueSize: number;
}

export interface ProviderConfiguration {
  readonly env: Environment;
  readonly retry: RetryPolicy;
  readonly circuitBreaker: CircuitBreakerPolicy;
  readonly health: HealthPolicy;
  readonly fallback: FallbackPolicy;
  readonly budget: BudgetPolicy;
  readonly execution: ExecutionPolicy;
  readonly featureFlags: Readonly<Record<string, boolean>>;
}

const DEFAULTS: ProviderConfiguration = Object.freeze({
  env: "production",
  retry: Object.freeze({
    maxAttempts: 3,
    initialDelayMs: 100,
    maxDelayMs: 5_000,
    multiplier: 2,
    jitter: true,
    retryBudgetMs: 15_000,
  }),
  circuitBreaker: Object.freeze({
    failureThreshold: 5,
    successThreshold: 2,
    openCooldownMs: 30_000,
    halfOpenProbes: 1,
  }),
  health: Object.freeze({
    heartbeatIntervalMs: 30_000,
    latencyDegradedMs: 2_000,
    latencyUnavailableMs: 10_000,
    recoveryProbeSuccesses: 2,
  }),
  fallback: Object.freeze({
    enabled: true,
    maxFallbacks: 2,
    gracefulDegradation: true,
  }),
  budget: Object.freeze({}),
  execution: Object.freeze({
    defaultTimeoutMs: 30_000,
    streamingTimeoutMs: 120_000,
    maxConcurrent: 64,
    backpressureQueueSize: 256,
  }),
  featureFlags: Object.freeze({}),
});

function deepFreeze<T>(v: T): T {
  if (v && typeof v === "object" && !Object.isFrozen(v)) {
    for (const k of Object.keys(v as object)) deepFreeze((v as Record<string, unknown>)[k]);
    Object.freeze(v);
  }
  return v;
}

export function loadProviderConfiguration(
  overrides: Partial<ProviderConfiguration> = {},
): ProviderConfiguration {
  const merged: ProviderConfiguration = {
    ...DEFAULTS,
    ...overrides,
    retry: { ...DEFAULTS.retry, ...(overrides.retry ?? {}) },
    circuitBreaker: { ...DEFAULTS.circuitBreaker, ...(overrides.circuitBreaker ?? {}) },
    health: { ...DEFAULTS.health, ...(overrides.health ?? {}) },
    fallback: { ...DEFAULTS.fallback, ...(overrides.fallback ?? {}) },
    budget: { ...DEFAULTS.budget, ...(overrides.budget ?? {}) },
    execution: { ...DEFAULTS.execution, ...(overrides.execution ?? {}) },
    featureFlags: { ...DEFAULTS.featureFlags, ...(overrides.featureFlags ?? {}) },
  };
  validateConfiguration(merged);
  return deepFreeze(merged);
}

export function validateConfiguration(cfg: ProviderConfiguration): void {
  if (cfg.retry.maxAttempts < 1) throw new ProviderConfigurationError("retry.maxAttempts must be >= 1");
  if (cfg.retry.multiplier < 1) throw new ProviderConfigurationError("retry.multiplier must be >= 1");
  if (cfg.circuitBreaker.failureThreshold < 1) {
    throw new ProviderConfigurationError("circuitBreaker.failureThreshold must be >= 1");
  }
  if (cfg.execution.defaultTimeoutMs < 1) {
    throw new ProviderConfigurationError("execution.defaultTimeoutMs must be > 0");
  }
  if (cfg.execution.maxConcurrent < 1) {
    throw new ProviderConfigurationError("execution.maxConcurrent must be >= 1");
  }
}
