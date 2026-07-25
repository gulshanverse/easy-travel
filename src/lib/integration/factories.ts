/** IPCF — immutable factory helpers for connector domain models. */
import { makeAuthentication } from "./auth";
import {
  newConnectorId, newConnectorVersionId, newRequestId, newSnapshotId, newWebhookId,
  newPollingJobId, newCorrelationId,
} from "./ids";
import type {
  AuthenticationKind, Connector, ConnectorAuthentication, ConnectorCapability,
  ConnectorCategory, ConnectorConfiguration, ConnectorContract, ConnectorDefinition,
  ConnectorDependency, ConnectorHealth, ConnectorHistoryEntry, ConnectorManifest,
  ConnectorMetadata, ConnectorPolicy, ConnectorRequest, ConnectorSnapshot,
  ConnectorStatistics, ConnectorStatus, ConnectorTransformation, ConnectorVersion,
  ConnectorRateLimit, ConnectorRetryPolicy, ConnectorCircuitPolicy,
  WebhookEndpoint, PollingJob,
} from "./types";

const now = () => Date.now();
const freeze = <T>(v: T): T => Object.freeze(v) as T;
const freezeArr = <T>(a: readonly T[]): readonly T[] => Object.freeze([...a]) as readonly T[];

export function makeCapability(input: {
  id: string; name: string; version?: string; description?: string;
  inputs?: readonly string[]; outputs?: readonly string[];
  metadata?: Record<string, unknown>;
}): ConnectorCapability {
  return freeze({
    id: input.id,
    name: input.name,
    version: input.version ?? "1.0.0",
    description: input.description,
    inputs: input.inputs ? freezeArr(input.inputs) : undefined,
    outputs: input.outputs ? freezeArr(input.outputs) : undefined,
    metadata: input.metadata ? freeze({ ...input.metadata }) : undefined,
  });
}

export function makeContract(input: {
  id: string; category: ConnectorCategory;
  capabilities: readonly ConnectorCapability[];
  authentication: readonly AuthenticationKind[];
  version?: string;
  metadata?: Record<string, unknown>;
}): ConnectorContract {
  return freeze({
    id: input.id,
    category: input.category,
    capabilities: freezeArr(input.capabilities),
    authentication: freezeArr(input.authentication),
    version: input.version ?? "1.0.0",
    metadata: input.metadata ? freeze({ ...input.metadata }) : undefined,
  });
}

export function makeMetadata(input: Partial<ConnectorMetadata> = {}): ConnectorMetadata {
  return freeze({
    tags: freezeArr(input.tags ?? []),
    labels: freeze({ ...(input.labels ?? {}) }),
    owner: input.owner,
    description: input.description,
  });
}

export function makeRateLimit(perMinute = 600, burst?: number): ConnectorRateLimit {
  return freeze({ perMinute, burst });
}
export function makeRetryPolicy(input: Partial<ConnectorRetryPolicy> = {}): ConnectorRetryPolicy {
  return freeze({
    maxAttempts: input.maxAttempts ?? 3,
    baseDelayMs: input.baseDelayMs ?? 100,
    maxDelayMs: input.maxDelayMs ?? 5_000,
    jitter: input.jitter ?? true,
  });
}
export function makeCircuitPolicy(input: Partial<ConnectorCircuitPolicy> = {}): ConnectorCircuitPolicy {
  return freeze({
    failureThreshold: input.failureThreshold ?? 5,
    openCooldownMs: input.openCooldownMs ?? 30_000,
  });
}
export function makePolicy(input: Partial<ConnectorPolicy> = {}): ConnectorPolicy {
  return freeze({
    rateLimit: input.rateLimit ?? makeRateLimit(),
    retry: input.retry ?? makeRetryPolicy(),
    circuit: input.circuit ?? makeCircuitPolicy(),
    concurrency: input.concurrency ?? 8,
    executionBudgetMs: input.executionBudgetMs ?? 30_000,
    sandbox: input.sandbox ?? true,
  });
}

export function makeConfiguration(input: Partial<ConnectorConfiguration> = {}): ConnectorConfiguration {
  return freeze({
    settings: freeze({ ...(input.settings ?? {}) }),
    featureFlags: freeze({ ...(input.featureFlags ?? {}) }),
  });
}

export function makeVersion(v = "1.0.0", notes?: string): ConnectorVersion {
  return freeze({ id: newConnectorVersionId(), version: v, createdAt: now(), notes });
}

export function makeManifest(input: {
  id?: string; name: string; category: ConnectorCategory; version?: string;
  contract: ConnectorContract; capabilities: readonly ConnectorCapability[];
  authentication?: ConnectorAuthentication;
  dependencies?: readonly ConnectorDependency[];
  metadata?: ConnectorMetadata;
}): ConnectorManifest {
  return freeze({
    id: input.id ?? newConnectorId(),
    name: input.name,
    category: input.category,
    version: input.version ?? "1.0.0",
    contract: input.contract,
    capabilities: freezeArr(input.capabilities),
    authentication: input.authentication ?? makeAuthentication({ kind: "anonymous" }),
    dependencies: freezeArr(input.dependencies ?? []),
    metadata: input.metadata ?? makeMetadata(),
  });
}

export function makeDefinition(input: {
  manifest: ConnectorManifest;
  policy?: ConnectorPolicy;
  configuration?: ConnectorConfiguration;
  transformation?: ConnectorTransformation;
}): ConnectorDefinition {
  return freeze({
    manifest: input.manifest,
    policy: input.policy ?? makePolicy(),
    configuration: input.configuration ?? makeConfiguration(),
    transformation: input.transformation,
  });
}

export function initialHealth(): ConnectorHealth {
  return freeze({
    status: "unknown",
    failureStreak: 0,
    successStreak: 0,
    circuit: "closed",
    lastCheckedAt: now(),
  });
}
export function initialStatistics(): ConnectorStatistics {
  return freeze({ invocations: 0, successes: 0, failures: 0, avgLatencyMs: 0 });
}

export function makeConnector(input: {
  definition: ConnectorDefinition;
  status?: ConnectorStatus;
  version?: ConnectorVersion;
  metadata?: Record<string, unknown>;
}): Connector {
  const t = now();
  return freeze({
    id: input.definition.manifest.id,
    definition: input.definition,
    status: input.status ?? "registered",
    health: initialHealth(),
    statistics: initialStatistics(),
    version: input.version ?? makeVersion(input.definition.manifest.version),
    history: freezeArr([
      freeze({ at: t, kind: "created", message: `connector ${input.definition.manifest.id} created` } as ConnectorHistoryEntry),
    ]),
    createdAt: t,
    updatedAt: t,
    metadata: freeze({ ...(input.metadata ?? {}) }),
  });
}

export function withUpdated(c: Connector, patch: Partial<Connector>, historyEntry?: Partial<ConnectorHistoryEntry>): Connector {
  const t = now();
  const history = historyEntry
    ? freezeArr([...c.history, freeze({ at: t, kind: "updated", ...historyEntry } as ConnectorHistoryEntry)])
    : c.history;
  return freeze({ ...c, ...patch, history, updatedAt: t });
}

export function makeSnapshot(c: Connector): ConnectorSnapshot {
  return freeze({ id: newSnapshotId(), connectorId: c.id, at: now(), connector: c });
}

export function makeRequest<T = unknown>(input: {
  connectorId: string; capabilityId: string; payload: T;
  correlationId?: string; causationId?: string;
  headers?: Record<string, string>; query?: Record<string, string>;
  timeoutMs?: number; metadata?: Record<string, unknown>;
}): ConnectorRequest<T> {
  return freeze({
    id: newRequestId(),
    connectorId: input.connectorId,
    capabilityId: input.capabilityId,
    correlationId: input.correlationId ?? newCorrelationId(),
    causationId: input.causationId,
    payload: input.payload,
    headers: input.headers ? freeze({ ...input.headers }) : undefined,
    query: input.query ? freeze({ ...input.query }) : undefined,
    timeoutMs: input.timeoutMs,
    metadata: input.metadata ? freeze({ ...input.metadata }) : undefined,
  });
}

export function makeWebhookEndpoint(input: {
  connectorId: string; path: string; secretRef?: string;
  enabled?: boolean; metadata?: Record<string, unknown>;
}): WebhookEndpoint {
  return freeze({
    id: newWebhookId(),
    connectorId: input.connectorId,
    path: input.path,
    secretRef: input.secretRef,
    enabled: input.enabled ?? true,
    createdAt: now(),
    metadata: freeze({ ...(input.metadata ?? {}) }),
  });
}

export function makePollingJob(input: {
  connectorId: string; capabilityId: string; intervalMs: number;
  enabled?: boolean; metadata?: Record<string, unknown>;
}): PollingJob {
  return freeze({
    id: newPollingJobId(),
    connectorId: input.connectorId,
    capabilityId: input.capabilityId,
    intervalMs: input.intervalMs,
    enabled: input.enabled ?? true,
    nextRunAt: now() + input.intervalMs,
    runs: 0,
    metadata: freeze({ ...(input.metadata ?? {}) }),
  });
}
