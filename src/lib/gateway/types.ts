/**
 * Provider Gateway (P-1.4) — immutable, provider-independent domain models.
 *
 * NO vendor name, SDK type, wire format or secret value may appear here.
 * The gateway owns transport governance only — never travel business logic.
 */

export type ProviderId = string;
export type ProviderCapabilityId = string;

export type ProviderCategory =
  | "RAILWAY"
  | "FLIGHT"
  | "HOTEL"
  | "MAPS"
  | "WEATHER"
  | "CURRENCY"
  | "TIMEZONE"
  | "TRANSIT"
  | "PAYMENT"
  | "NOTIFICATION"
  | "GENERAL";

export type ProviderType = "mock" | "sandbox" | "live" | "internal";

export type ProviderEnvironment = "test" | "sandbox" | "staging" | "production";

export type ProviderStatus =
  | "registered"
  | "enabled"
  | "disabled"
  | "degraded"
  | "failed"
  | "retired";

export type ProviderAuthKind =
  | "none"
  | "api-key"
  | "oauth2"
  | "oidc"
  | "bearer"
  | "hmac"
  | "mtls"
  | "basic";

export type CircuitState = "closed" | "open" | "half-open";

export type ProviderAvailability = "available" | "limited" | "unavailable" | "unknown";

export interface ProviderVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}

export interface ProviderEndpoint {
  /** Absolute https URL, explicitly registered. Never user-supplied. */
  readonly url: string;
  readonly method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  readonly timeoutMs?: number;
}

/** Opaque reference to a secret. NEVER a secret value. */
export interface ProviderCredentialReference {
  readonly ref: string;
  readonly kind: ProviderAuthKind;
  readonly scopes?: readonly string[];
  readonly rotationHook?: string;
}

export type CredentialStatus = "active" | "expiring" | "expired" | "revoked" | "missing";

export interface SecretMetadata {
  readonly ref: string;
  readonly kind: ProviderAuthKind;
  readonly status: CredentialStatus;
  readonly scope?: string;
  readonly expiresAt?: number;
  readonly rotatedAt?: number;
}

export interface ProviderLimits {
  readonly requestsPerMinute: number;
  readonly concurrency: number;
  readonly maxRequestBytes: number;
  readonly maxResponseBytes: number;
  readonly requestTimeoutMs: number;
  readonly connectionTimeoutMs: number;
  readonly totalDeadlineMs: number;
}

export interface ProviderPricing {
  /** Cost units per request; deterministic, no currency conversion here. */
  readonly costPerRequest: number;
  readonly currency: string;
}

export interface ProviderQuota {
  readonly dailyRequests?: number;
  readonly monthlyRequests?: number;
}

export interface ProviderMetadata {
  readonly tags: readonly string[];
  readonly labels: Readonly<Record<string, string>>;
  readonly region?: string;
  readonly owner?: string;
  readonly description?: string;
}

export interface ProviderLatency {
  readonly p50: number;
  readonly p95: number;
  readonly p99: number;
  readonly samples: number;
}

export interface ProviderHealth {
  readonly status: "healthy" | "degraded" | "unhealthy" | "unknown";
  readonly availability: ProviderAvailability;
  readonly circuit: CircuitState;
  readonly failureStreak: number;
  readonly successStreak: number;
  readonly circuitOpenedAt?: number;
  readonly lastCheckedAt: number;
  readonly reason?: string;
}

export interface ProviderRetryPolicy {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly jitter: boolean;
  readonly retryBudget: number;
  readonly retryNonIdempotent: boolean;
}

export interface ProviderCircuitPolicy {
  readonly failureThreshold: number;
  readonly successThreshold: number;
  readonly openDurationMs: number;
}

export interface ProviderCachePolicy {
  readonly enabled: boolean;
  readonly ttlMs: number;
  readonly staleWhileRevalidateMs: number;
}

export interface ProviderBudgetPolicy {
  readonly dailyBudget?: number;
  readonly monthlyBudget?: number;
  readonly perUserBudget?: number;
  readonly perProviderBudget?: number;
  readonly perCapabilityBudget?: number;
}

export interface ProviderPolicy {
  readonly retry: ProviderRetryPolicy;
  readonly circuit: ProviderCircuitPolicy;
  readonly cache: ProviderCachePolicy;
  readonly budget: ProviderBudgetPolicy;
  readonly priority: number;
  readonly failoverAllowed: boolean;
  readonly allowNonIdempotentFailover: boolean;
}

/** Capability contract — declared explicitly; nothing is implicit. */
export interface ProviderCapability {
  readonly id: ProviderCapabilityId;
  readonly category: ProviderCategory;
  readonly version: string;
  readonly operations: readonly string[];
  readonly inputFields: readonly string[];
  readonly outputFields: readonly string[];
  readonly idempotent: boolean;
  readonly cacheable: boolean;
  readonly requiresAuth: boolean;
  readonly environments: readonly ProviderEnvironment[];
  readonly limits: Partial<ProviderLimits>;
  readonly description?: string;
}

export interface ProviderContract {
  readonly providerId: ProviderId;
  readonly capabilities: readonly ProviderCapability[];
  readonly version: ProviderVersion;
}

export interface Provider {
  readonly id: ProviderId;
  readonly name: string;
  readonly type: ProviderType;
  readonly category: ProviderCategory;
  readonly environment: ProviderEnvironment;
  readonly version: ProviderVersion;
  readonly auth: ProviderAuthKind;
  readonly credentialRef?: ProviderCredentialReference;
  readonly endpoints: readonly ProviderEndpoint[];
  readonly limits: ProviderLimits;
  readonly pricing: ProviderPricing;
  readonly quota: ProviderQuota;
  readonly policy: ProviderPolicy;
  readonly metadata: ProviderMetadata;
  readonly capabilities: readonly ProviderCapability[];
  readonly status: ProviderStatus;
  readonly registeredAt: number;
}

export interface ProviderRequest {
  readonly requestId: string;
  readonly capability: ProviderCapabilityId;
  readonly operation: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly userId?: string;
  readonly tenantId?: string;
  readonly idempotencyKey?: string;
  readonly environment?: ProviderEnvironment;
  readonly region?: string;
  readonly providerId?: ProviderId;
  readonly deadlineMs?: number;
  readonly sandbox?: boolean;
}

export interface ProviderResponseMeta {
  readonly providerId: ProviderId;
  readonly capability: ProviderCapabilityId;
  readonly attempts: number;
  readonly latencyMs: number;
  readonly cached: boolean;
  readonly replayed: boolean;
  readonly fallbackUsed: boolean;
  readonly cost: number;
  readonly correlationId: string;
  readonly fingerprint: string;
}

export interface ProviderResponse<T = unknown> {
  readonly ok: boolean;
  readonly data: T;
  readonly meta: ProviderResponseMeta;
}

export interface ProviderRoute {
  readonly capability: ProviderCapabilityId;
  readonly primary: ProviderId;
  readonly fallbacks: readonly ProviderId[];
  readonly reason: string;
}
