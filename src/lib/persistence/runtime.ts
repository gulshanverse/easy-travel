/**
 * PersistenceRuntime — the single composition root for the persistence
 * platform. Selects drivers from configuration, builds the database
 * manager, repositories, caches, object storage and adapters, and exposes
 * aggregated health + metrics.
 */

import { assertProductionConfig, createPersistenceConfig, type PersistenceConfig } from "./config";
import { ALL_COLLECTIONS, COLLECTIONS } from "./collections";
import { DatabaseManager } from "./database/pool";
import { InMemoryDatabaseDriver } from "./database/memory-driver";
import { PostgresDatabaseDriver, type SqlDataClient } from "./database/postgres-driver";
import type { DatabaseDriver } from "./database/types";
import { GenericRepository } from "./repository/generic-repository";
import { UnitOfWork } from "./repository/unit-of-work";
import type { Repository } from "./repository/types";
import { CacheManager } from "./cache/manager";
import { InMemoryCacheDriver } from "./cache/memory-driver";
import { RedisCacheDriver, type RedisTransport } from "./cache/redis-driver";
import type { CacheDriver } from "./cache/types";
import { ObjectStorageManager } from "./storage/manager";
import { InMemoryObjectStorageDriver, RemoteObjectStorageDriver } from "./storage/drivers";
import type { ObjectStorageDriver, ObjectTransport, UrlSigner } from "./storage/types";
import { MemoryStoreAdapter, WorkflowStoreAdapter, DocumentStoreAdapter } from "./adapters";
import { MigrationManager, type Migration, type MigrationContext } from "./migrations/framework";
import { baselineMigrations } from "./migrations/definitions";
import {
  aggregateHealth,
  noopTelemetry,
  PersistenceMetrics,
  type AggregatedHealth,
  type PersistenceTelemetry,
} from "./telemetry";
import { PersistenceConfigError } from "./errors";

export interface PersistenceRuntimeOptions {
  readonly config?: PersistenceConfig;
  readonly telemetry?: PersistenceTelemetry;
  readonly metrics?: PersistenceMetrics;
  /** Required when `database.driver === "postgres"`. */
  readonly sqlClient?: SqlDataClient;
  /** Required when `cache.driver === "redis"`. */
  readonly redisTransport?: RedisTransport;
  /** Required for remote object storage drivers. */
  readonly storageSigner?: UrlSigner;
  readonly storageTransport?: ObjectTransport;
  readonly migrations?: readonly Migration[];
  readonly migrationContext?: MigrationContext;
}

export class PersistenceRuntime {
  readonly config: PersistenceConfig;
  readonly metrics: PersistenceMetrics;
  readonly telemetry: PersistenceTelemetry;
  readonly database: DatabaseManager;
  readonly cache: CacheManager;
  readonly storage: ObjectStorageManager;
  readonly unitOfWork: UnitOfWork;
  readonly migrations?: MigrationManager;

  private readonly repos = new Map<string, Repository<Record<string, unknown>>>();

  constructor(options: PersistenceRuntimeOptions = {}) {
    this.config = options.config ?? createPersistenceConfig();
    this.metrics = options.metrics ?? new PersistenceMetrics();
    this.telemetry = options.telemetry ?? noopTelemetry;

    this.database = new DatabaseManager(
      buildDatabaseDriver(this.config, options),
      this.config.database,
      this.metrics,
      this.telemetry,
    );
    this.cache = new CacheManager(
      buildCacheDriver(this.config, options),
      this.config.cache,
      this.metrics,
    );
    this.storage = new ObjectStorageManager(
      buildStorageDriver(this.config, options),
      this.config.storage,
      this.metrics,
    );
    this.unitOfWork = new UnitOfWork(this.database, this.metrics);
    if (options.migrationContext) {
      this.migrations = new MigrationManager(
        options.migrations ?? baselineMigrations,
        options.migrationContext,
      );
    }
    if (this.config.environment === "production") assertProductionConfig(this.config);
  }

  /** Repository for any registered collection. */
  repository<T extends Record<string, unknown>>(collection: string): Repository<T> {
    const cached = this.repos.get(collection);
    if (cached) return cached as unknown as Repository<T>;
    const repo = new GenericRepository<T>(collection, this.database);
    this.repos.set(collection, repo as unknown as Repository<Record<string, unknown>>);
    return repo;
  }

  /** Adapters implementing existing engine ports. */
  memoryStore(): MemoryStoreAdapter {
    return new MemoryStoreAdapter(this.repository(COLLECTIONS.memoryRecords));
  }
  workflowStore(): WorkflowStoreAdapter {
    return new WorkflowStoreAdapter(this.repository(COLLECTIONS.workflowInstances));
  }
  documentStore<T extends Record<string, unknown>>(collection: string): DocumentStoreAdapter<T> {
    return new DocumentStoreAdapter<T>(collection, this.repository(collection));
  }
  identityStore<T extends Record<string, unknown>>(
    collection: string = COLLECTIONS.profiles,
  ): IdentityStoreAdapter<T> {
    return new IdentityStoreAdapter<T>(this.repository(collection), collection);
  }
  journeyStore<T extends Record<string, unknown>>(
    collection: string = COLLECTIONS.journeys,
  ): JourneyStoreAdapter<T> {
    return new JourneyStoreAdapter<T>(this.repository(collection), collection);
  }
  travelStore<T extends Record<string, unknown>>(
    collection: string = COLLECTIONS.travelRecords,
  ): TravelStoreAdapter<T> {
    return new TravelStoreAdapter<T>(this.repository(collection), collection);
  }

  /** Optional persistence implementations (event sourcing, audit, outbox). */
  events(): EventStore {
    return (this.eventStore ??= new EventStore(this.repository(COLLECTIONS.events)));
  }
  audit(): AuditStore {
    return (this.auditStore ??= new AuditStore(this.repository(COLLECTIONS.auditLogs)));
  }
  outbox(): OutboxStore {
    return (this.outboxStore ??= new OutboxStore(this.repository(COLLECTIONS.outbox)));
  }

  collections(): readonly string[] {
    return ALL_COLLECTIONS;
  }


  async health(): Promise<AggregatedHealth> {
    const [db, cache, storage] = await Promise.all([
      this.database.health(),
      this.cache.health(),
      this.storage.health(),
    ]);
    return aggregateHealth([...db.checks, ...cache.checks, ...storage.checks]);
  }

  metricsSnapshot(): Readonly<Record<string, number>> {
    return this.metrics.snapshot();
  }
}

function buildDatabaseDriver(
  cfg: PersistenceConfig,
  o: PersistenceRuntimeOptions,
): DatabaseDriver {
  if (cfg.database.driver === "postgres") {
    if (!o.sqlClient)
      throw new PersistenceConfigError("postgres driver requires a sqlClient");
    return new PostgresDatabaseDriver(o.sqlClient);
  }
  return new InMemoryDatabaseDriver();
}

function buildCacheDriver(cfg: PersistenceConfig, o: PersistenceRuntimeOptions): CacheDriver {
  if (cfg.cache.driver === "redis") {
    if (!o.redisTransport)
      throw new PersistenceConfigError("redis driver requires a redisTransport");
    return new RedisCacheDriver(o.redisTransport);
  }
  return new InMemoryCacheDriver(cfg.cache.maxEntries);
}

function buildStorageDriver(
  cfg: PersistenceConfig,
  o: PersistenceRuntimeOptions,
): ObjectStorageDriver {
  if (cfg.storage.driver === "memory") return new InMemoryObjectStorageDriver();
  if (!o.storageSigner || !o.storageTransport)
    throw new PersistenceConfigError(
      `${cfg.storage.driver} storage requires a signer and transport`,
    );
  return new RemoteObjectStorageDriver({
    kind: cfg.storage.driver,
    bucket: cfg.storage.bucket,
    pathPrefix: cfg.storage.pathPrefix,
    signer: o.storageSigner,
    transport: o.storageTransport,
    maxObjectBytes: cfg.storage.maxObjectBytes,
  });
}
