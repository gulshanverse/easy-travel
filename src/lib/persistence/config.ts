/**
 * Persistence Platform — configuration.
 *
 * A single immutable configuration object selects drivers for the three
 * persistence pillars (database, cache, object storage). Production
 * configurations MUST NOT select the `memory` driver — `assertProduction`
 * enforces that at composition time.
 */

import { PersistenceConfigError } from "./errors";

export type DatabaseDriverKind = "memory" | "postgres";
export type CacheDriverKind = "memory" | "redis";
export type ObjectStorageDriverKind = "memory" | "local" | "s3" | "azure" | "gcs";

export interface ConnectionPoolConfig {
  readonly min: number;
  readonly max: number;
  readonly acquireTimeoutMs: number;
  readonly idleTimeoutMs: number;
  readonly maxRetries: number;
  readonly retryBaseDelayMs: number;
}

export interface DatabaseConfig {
  readonly driver: DatabaseDriverKind;
  readonly schema: string;
  readonly statementTimeoutMs: number;
  readonly pool: ConnectionPoolConfig;
  readonly softDelete: boolean;
  readonly optimisticLocking: boolean;
}

export interface CacheTtlPolicies {
  readonly defaultTtlMs: number;
  readonly sessionTtlMs: number;
  readonly workflowTtlMs: number;
  readonly promptTtlMs: number;
  readonly memoryTtlMs: number;
  readonly rateLimitWindowMs: number;
}

export interface CacheConfig {
  readonly driver: CacheDriverKind;
  readonly keyPrefix: string;
  readonly maxEntries: number;
  readonly ttl: CacheTtlPolicies;
}

export interface ObjectStorageConfig {
  readonly driver: ObjectStorageDriverKind;
  readonly bucket: string;
  readonly pathPrefix: string;
  readonly signedUrlTtlSeconds: number;
  readonly maxObjectBytes: number;
}

export interface PersistenceConfig {
  readonly namespace: string;
  readonly environment: "development" | "test" | "production";
  readonly database: DatabaseConfig;
  readonly cache: CacheConfig;
  readonly storage: ObjectStorageConfig;
  readonly telemetryEnabled: boolean;
}

export const DEFAULT_POOL_CONFIG: ConnectionPoolConfig = Object.freeze({
  min: 1,
  max: 10,
  acquireTimeoutMs: 5_000,
  idleTimeoutMs: 30_000,
  maxRetries: 3,
  retryBaseDelayMs: 25,
});

export const DEFAULT_TTL_POLICIES: CacheTtlPolicies = Object.freeze({
  defaultTtlMs: 60_000,
  sessionTtlMs: 30 * 60_000,
  workflowTtlMs: 10 * 60_000,
  promptTtlMs: 5 * 60_000,
  memoryTtlMs: 2 * 60_000,
  rateLimitWindowMs: 60_000,
});

export function createPersistenceConfig(
  over: Partial<PersistenceConfig> = {},
): PersistenceConfig {
  const cfg: PersistenceConfig = {
    namespace: over.namespace ?? "easytrip",
    environment: over.environment ?? "development",
    telemetryEnabled: over.telemetryEnabled ?? true,
    database: Object.freeze({
      driver: "memory",
      schema: "public",
      statementTimeoutMs: 10_000,
      softDelete: true,
      optimisticLocking: true,
      ...over.database,
      pool: Object.freeze({ ...DEFAULT_POOL_CONFIG, ...over.database?.pool }),
    }),
    cache: Object.freeze({
      driver: "memory",
      keyPrefix: over.namespace ?? "easytrip",
      maxEntries: 10_000,
      ...over.cache,
      ttl: Object.freeze({ ...DEFAULT_TTL_POLICIES, ...over.cache?.ttl }),
    }),
    storage: Object.freeze({
      driver: "memory",
      bucket: "easytrip-objects",
      pathPrefix: "",
      signedUrlTtlSeconds: 900,
      maxObjectBytes: 25 * 1024 * 1024,
      ...over.storage,
    }),
  };
  validatePersistenceConfig(cfg);
  return Object.freeze(cfg);
}

/** Production preset: Postgres + Redis + object storage; never in-memory. */
export function createProductionConfig(
  over: Partial<PersistenceConfig> = {},
): PersistenceConfig {
  const cfg = createPersistenceConfig({
    environment: "production",
    ...over,
    database: { driver: "postgres", ...over.database } as DatabaseConfig,
    cache: { driver: "redis", ...over.cache } as CacheConfig,
    storage: { driver: "s3", ...over.storage } as ObjectStorageConfig,
  });
  assertProductionConfig(cfg);
  return cfg;
}

export function validatePersistenceConfig(cfg: PersistenceConfig): void {
  const p = cfg.database.pool;
  if (p.min < 0 || p.max < 1 || p.min > p.max)
    throw new PersistenceConfigError("invalid connection pool bounds", { pool: p });
  if (cfg.cache.maxEntries < 1)
    throw new PersistenceConfigError("cache maxEntries must be >= 1");
  if (cfg.storage.maxObjectBytes < 1)
    throw new PersistenceConfigError("storage maxObjectBytes must be >= 1");
}

/** Fails when a production configuration still points at in-memory drivers. */
export function assertProductionConfig(cfg: PersistenceConfig): void {
  const offenders: string[] = [];
  if (cfg.database.driver === "memory") offenders.push("database");
  if (cfg.cache.driver === "memory") offenders.push("cache");
  if (cfg.storage.driver === "memory") offenders.push("storage");
  if (offenders.length)
    throw new PersistenceConfigError(
      `in-memory drivers are not permitted in production: ${offenders.join(", ")}`,
      { offenders },
    );
}
