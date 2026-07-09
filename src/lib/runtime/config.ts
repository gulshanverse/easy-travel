/**
 * Runtime Core — Centralized configuration.
 *
 * Configuration is loaded once at startup and frozen. Mutating a live config
 * throws (deep-frozen). Use `withConfig` for scoped overrides in tests.
 */

import { ConfigurationError } from "./errors";

export type RuntimeEnvironment = "development" | "test" | "preview" | "production";

export interface RuntimePolicies {
  /** Max concurrent capability executions per registry. */
  maxConcurrentCapabilities: number;
  /** Default capability timeout in ms. */
  defaultCapabilityTimeoutMs: number;
  /** Max event handlers retained per event type (backpressure guard). */
  maxHandlersPerEvent: number;
  /** Max events retained for replay. */
  maxReplayBufferSize: number;
  /** Max retries for retryable event handlers. */
  maxEventRetries: number;
  /** Delay (ms) between event retry attempts. */
  eventRetryBackoffMs: number;
}

export interface SafetyFlags {
  /** Block writes when memory pressure is detected. */
  blockOnBackpressure: boolean;
  /** Reject events that fail schema validation. */
  strictEventValidation: boolean;
  /** Enforce capability contract validation before execution. */
  strictCapabilityValidation: boolean;
}

export interface RuntimeConfiguration {
  environment: RuntimeEnvironment;
  debug: boolean;
  featureFlags: Readonly<Record<string, boolean>>;
  capabilityToggles: Readonly<Record<string, boolean>>;
  policies: RuntimePolicies;
  safety: SafetyFlags;
  serviceMetadata: Readonly<Record<string, string>>;
}

export const DEFAULT_RUNTIME_POLICIES: RuntimePolicies = {
  maxConcurrentCapabilities: 32,
  defaultCapabilityTimeoutMs: 15_000,
  maxHandlersPerEvent: 128,
  maxReplayBufferSize: 512,
  maxEventRetries: 3,
  eventRetryBackoffMs: 50,
};

export const DEFAULT_SAFETY_FLAGS: SafetyFlags = {
  blockOnBackpressure: true,
  strictEventValidation: true,
  strictCapabilityValidation: true,
};

export const DEFAULT_RUNTIME_CONFIGURATION: RuntimeConfiguration = deepFreeze({
  environment: "production",
  debug: false,
  featureFlags: {},
  capabilityToggles: {},
  policies: DEFAULT_RUNTIME_POLICIES,
  safety: DEFAULT_SAFETY_FLAGS,
  serviceMetadata: {},
});

export interface RuntimeConfigurationOverride {
  environment?: RuntimeEnvironment;
  debug?: boolean;
  featureFlags?: Record<string, boolean>;
  capabilityToggles?: Record<string, boolean>;
  policies?: Partial<RuntimePolicies>;
  safety?: Partial<SafetyFlags>;
  serviceMetadata?: Record<string, string>;
}

export function loadRuntimeConfiguration(
  override: RuntimeConfigurationOverride = {},
): RuntimeConfiguration {
  const cfg: RuntimeConfiguration = {
    environment: override.environment ?? DEFAULT_RUNTIME_CONFIGURATION.environment,
    debug: override.debug ?? DEFAULT_RUNTIME_CONFIGURATION.debug,
    featureFlags: { ...DEFAULT_RUNTIME_CONFIGURATION.featureFlags, ...(override.featureFlags ?? {}) },
    capabilityToggles: {
      ...DEFAULT_RUNTIME_CONFIGURATION.capabilityToggles,
      ...(override.capabilityToggles ?? {}),
    },
    policies: { ...DEFAULT_RUNTIME_POLICIES, ...(override.policies ?? {}) },
    safety: { ...DEFAULT_SAFETY_FLAGS, ...(override.safety ?? {}) },
    serviceMetadata: {
      ...DEFAULT_RUNTIME_CONFIGURATION.serviceMetadata,
      ...(override.serviceMetadata ?? {}),
    },
  };
  validateRuntimeConfiguration(cfg);
  return deepFreeze(cfg);
}

export function validateRuntimeConfiguration(cfg: RuntimeConfiguration): void {
  const p = cfg.policies;
  if (p.maxConcurrentCapabilities <= 0) {
    throw new ConfigurationError("policies.maxConcurrentCapabilities must be > 0");
  }
  if (p.defaultCapabilityTimeoutMs <= 0) {
    throw new ConfigurationError("policies.defaultCapabilityTimeoutMs must be > 0");
  }
  if (p.maxHandlersPerEvent <= 0) {
    throw new ConfigurationError("policies.maxHandlersPerEvent must be > 0");
  }
  if (p.maxReplayBufferSize < 0) {
    throw new ConfigurationError("policies.maxReplayBufferSize must be >= 0");
  }
  if (p.maxEventRetries < 0) throw new ConfigurationError("policies.maxEventRetries must be >= 0");
  if (p.eventRetryBackoffMs < 0) {
    throw new ConfigurationError("policies.eventRetryBackoffMs must be >= 0");
  }
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  Object.values(value as Record<string, unknown>).forEach((v) => deepFreeze(v));
  return Object.freeze(value);
}
