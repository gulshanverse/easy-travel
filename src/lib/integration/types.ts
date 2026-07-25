/** IPCF — immutable domain model.
 * The Integration Platform owns connector infrastructure only.
 * Provider-specific logic MUST live inside a connector implementation
 * consumed via ConnectorInvoker; never inside these types.
 */

export type ConnectorCategory =
  | "railway" | "flight" | "hotel" | "maps" | "weather" | "payments"
  | "notifications" | "calendar" | "identity" | "documents"
  | "analytics" | "storage" | "search" | "messaging" | "custom";

export type ConnectorStatus =
  | "registered" | "validated" | "enabled" | "disabled"
  | "degraded" | "failed" | "retired";

export type AuthenticationKind =
  | "api-key" | "oauth2" | "oauth2-pkce" | "jwt" | "bearer"
  | "basic" | "hmac" | "service-account" | "client-credentials" | "anonymous";

export interface ConnectorCredentialReference {
  readonly id: string;
  readonly ref: string;                 // opaque reference; NEVER a secret value
  readonly kind: AuthenticationKind;
  readonly scopes?: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ConnectorAuthentication {
  readonly kind: AuthenticationKind;
  readonly credentialRef?: ConnectorCredentialReference;
  readonly refreshable: boolean;
  readonly refreshHookName?: string;    // symbolic hook id resolved by host
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ConnectorCapability {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description?: string;
  readonly inputs?: readonly string[];
  readonly outputs?: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ConnectorRateLimit {
  readonly perMinute: number;
  readonly burst?: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ConnectorRetryPolicy {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly jitter: boolean;
}

export interface ConnectorCircuitPolicy {
  readonly failureThreshold: number;
  readonly openCooldownMs: number;
}

export interface ConnectorPolicy {
  readonly rateLimit: ConnectorRateLimit;
  readonly retry: ConnectorRetryPolicy;
  readonly circuit: ConnectorCircuitPolicy;
  readonly concurrency: number;
  readonly executionBudgetMs: number;
  readonly sandbox: boolean;
}

export interface ConnectorDependency {
  readonly connectorId: string;
  readonly minVersion?: string;
  readonly maxVersion?: string;
  readonly optional?: boolean;
}

export interface ConnectorConfiguration {
  readonly settings: Readonly<Record<string, unknown>>;
  readonly featureFlags: Readonly<Record<string, boolean>>;
}

export interface ConnectorTransformation {
  readonly requestName?: string;   // symbolic name; runtime resolves it
  readonly responseName?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ConnectorVersion {
  readonly id: string;
  readonly version: string;        // semver x.y.z
  readonly createdAt: number;
  readonly notes?: string;
}

export interface ConnectorMetadata {
  readonly tags: readonly string[];
  readonly labels: Readonly<Record<string, string>>;
  readonly owner?: string;
  readonly description?: string;
}

export interface ConnectorStatistics {
  readonly invocations: number;
  readonly successes: number;
  readonly failures: number;
  readonly avgLatencyMs: number;
  readonly lastInvokedAt?: number;
}

export interface ConnectorHealth {
  readonly status: "healthy" | "degraded" | "unhealthy" | "unknown";
  readonly failureStreak: number;
  readonly successStreak: number;
  readonly circuit: "closed" | "open" | "half-open";
  readonly circuitOpenedAt?: number;
  readonly lastCheckedAt: number;
  readonly reason?: string;
}

export interface ConnectorHistoryEntry {
  readonly at: number;
  readonly kind: string;
  readonly message?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ConnectorContract {
  readonly id: string;
  readonly category: ConnectorCategory;
  readonly capabilities: readonly ConnectorCapability[];
  readonly authentication: readonly AuthenticationKind[];
  readonly version: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ConnectorManifest {
  readonly id: string;
  readonly name: string;
  readonly category: ConnectorCategory;
  readonly version: string;
  readonly contract: ConnectorContract;
  readonly capabilities: readonly ConnectorCapability[];
  readonly authentication: ConnectorAuthentication;
  readonly dependencies: readonly ConnectorDependency[];
  readonly metadata: ConnectorMetadata;
}

export interface ConnectorDefinition {
  readonly manifest: ConnectorManifest;
  readonly policy: ConnectorPolicy;
  readonly configuration: ConnectorConfiguration;
  readonly transformation?: ConnectorTransformation;
}

export interface Connector {
  readonly id: string;
  readonly definition: ConnectorDefinition;
  readonly status: ConnectorStatus;
  readonly health: ConnectorHealth;
  readonly statistics: ConnectorStatistics;
  readonly version: ConnectorVersion;
  readonly history: readonly ConnectorHistoryEntry[];
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ConnectorSnapshot {
  readonly id: string;
  readonly connectorId: string;
  readonly at: number;
  readonly connector: Connector;
}

export interface ConnectorRequest<TPayload = unknown> {
  readonly id: string;
  readonly connectorId: string;
  readonly capabilityId: string;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly payload: TPayload;
  readonly headers?: Readonly<Record<string, string>>;
  readonly query?: Readonly<Record<string, string>>;
  readonly timeoutMs?: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface NormalizedPagination {
  readonly page?: number;
  readonly pageSize?: number;
  readonly total?: number;
  readonly cursor?: string;
  readonly hasMore?: boolean;
}

export interface NormalizedRateLimit {
  readonly limit?: number;
  readonly remaining?: number;
  readonly resetAt?: number;
}

export interface NormalizedDiagnostics {
  readonly latencyMs: number;
  readonly attempts: number;
  readonly retried: boolean;
  readonly circuitState: "closed" | "open" | "half-open";
  readonly transformationApplied: boolean;
}

export interface NormalizedMetadata {
  readonly connectorId: string;
  readonly capabilityId: string;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly version: string;
  readonly at: number;
}

export interface NormalizedError {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
  readonly cause?: Readonly<Record<string, unknown>>;
}

export interface NormalizedResponse<T = unknown> {
  readonly id: string;
  readonly ok: boolean;
  readonly data?: T;
  readonly error?: NormalizedError;
  readonly metadata: NormalizedMetadata;
  readonly pagination?: NormalizedPagination;
  readonly rateLimit?: NormalizedRateLimit;
  readonly diagnostics: NormalizedDiagnostics;
}

export type ConnectorResponse<T = unknown> = NormalizedResponse<T>;

/** Executor hook — the ONLY seam where an implementation may touch
 *  the outside world. IPCF ships stubs; real network transport is
 *  provided by adapters registered against the runtime.
 */
export interface ConnectorExecutorContext {
  readonly connector: Connector;
  readonly request: ConnectorRequest;
  readonly signal?: AbortSignal;
  readonly attempt: number;
}
export interface ConnectorRawResult<T = unknown> {
  readonly ok: boolean;
  readonly data?: T;
  readonly error?: { code: string; message: string; retryable?: boolean };
  readonly pagination?: NormalizedPagination;
  readonly rateLimit?: NormalizedRateLimit;
}
export type ConnectorExecutor = (
  ctx: ConnectorExecutorContext,
) => Promise<ConnectorRawResult>;

/** Webhook & Polling primitives */
export interface WebhookEndpoint {
  readonly id: string;
  readonly connectorId: string;
  readonly path: string;
  readonly secretRef?: string;
  readonly enabled: boolean;
  readonly createdAt: number;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface WebhookDelivery {
  readonly id: string;
  readonly webhookId: string;
  readonly receivedAt: number;
  readonly payload: unknown;
  readonly headers: Readonly<Record<string, string>>;
  readonly normalized?: NormalizedEvent;
  readonly ok: boolean;
  readonly error?: string;
}

export interface PollingJob {
  readonly id: string;
  readonly connectorId: string;
  readonly capabilityId: string;
  readonly intervalMs: number;
  readonly enabled: boolean;
  readonly nextRunAt: number;
  readonly lastRunAt?: number;
  readonly runs: number;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface NormalizedEvent<T = unknown> {
  readonly id: string;
  readonly connectorId: string;
  readonly kind: string;
  readonly at: number;
  readonly correlationId: string;
  readonly payload: T;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface DeadLetterEntry {
  readonly id: string;
  readonly connectorId: string;
  readonly kind: "webhook" | "polling" | "request";
  readonly at: number;
  readonly attempts: number;
  readonly reason: string;
  readonly payload: unknown;
}
