/**
 * CacheManager and named caches.
 *
 * Every subsystem gets a namespaced cache with its own TTL policy so keys
 * can never collide and invalidation stays scoped.
 */

import type { CacheConfig } from "../config";
import { aggregateHealth, PersistenceMetrics, type AggregatedHealth } from "../telemetry";
import type { CacheDriver, CacheStats } from "./types";

export class NamespacedCache {
  private hits = 0;
  private misses = 0;
  private writes = 0;

  constructor(
    readonly namespace: string,
    private readonly driver: CacheDriver,
    private readonly defaultTtlMs: number,
    private readonly prefix: string,
    private readonly metrics: PersistenceMetrics,
  ) {}

  key(key: string): string {
    return `${this.prefix}:${this.namespace}:${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.driver.get<T>(this.key(key));
    if (value === null) {
      this.misses += 1;
      this.metrics.increment(`cache.${this.namespace}.miss`);
    } else {
      this.hits += 1;
      this.metrics.increment(`cache.${this.namespace}.hit`);
    }
    return value;
  }

  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    this.writes += 1;
    this.metrics.increment(`cache.${this.namespace}.write`);
    await this.driver.set(this.key(key), value, ttlMs ?? this.defaultTtlMs);
  }

  /** Read-through helper: computes and caches on miss. */
  async getOrSet<T>(key: string, loader: () => Promise<T>, ttlMs?: number): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const value = await loader();
    await this.set(key, value, ttlMs);
    return value;
  }

  async delete(key: string): Promise<boolean> {
    return this.driver.delete(this.key(key));
  }
  async has(key: string): Promise<boolean> {
    return this.driver.has(this.key(key));
  }
  async invalidate(): Promise<number> {
    return this.driver.clear(`${this.prefix}:${this.namespace}:`);
  }
  async keys(): Promise<readonly string[]> {
    return this.driver.keys(`${this.prefix}:${this.namespace}:`);
  }
  stats(): CacheStats {
    const total = this.hits + this.misses;
    return Object.freeze({
      hits: this.hits,
      misses: this.misses,
      writes: this.writes,
      evictions: 0,
      hitRate: total === 0 ? 0 : this.hits / total,
    });
  }
}

export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly count: number;
  readonly limit: number;
  readonly windowMs: number;
  readonly retryAfterMs: number;
}

/** Fixed-window rate limit counter backed by the cache driver. */
export class RateLimitStore {
  constructor(
    private readonly cache: NamespacedCache,
    private readonly windowMs: number,
    private readonly driver: CacheDriver,
  ) {}

  async consume(identifier: string, limit: number, now = Date.now()): Promise<RateLimitDecision> {
    const window = Math.floor(now / this.windowMs);
    const key = this.cache.key(`${identifier}:${window}`);
    const count = await this.driver.increment(key, 1, this.windowMs);
    const resetAt = (window + 1) * this.windowMs;
    return Object.freeze({
      allowed: count <= limit,
      count,
      limit,
      windowMs: this.windowMs,
      retryAfterMs: count <= limit ? 0 : Math.max(0, resetAt - now),
    });
  }
}

export class CacheManager {
  readonly distributed: NamespacedCache;
  readonly session: NamespacedCache;
  readonly workflow: NamespacedCache;
  readonly prompt: NamespacedCache;
  readonly memory: NamespacedCache;
  readonly rateLimit: RateLimitStore;

  constructor(
    readonly driver: CacheDriver,
    private readonly config: CacheConfig,
    readonly metrics: PersistenceMetrics = new PersistenceMetrics(),
  ) {
    const make = (ns: string, ttl: number) =>
      new NamespacedCache(ns, driver, ttl, config.keyPrefix, metrics);
    this.distributed = make("distributed", config.ttl.defaultTtlMs);
    this.session = make("session", config.ttl.sessionTtlMs);
    this.workflow = make("workflow", config.ttl.workflowTtlMs);
    this.prompt = make("prompt", config.ttl.promptTtlMs);
    this.memory = make("memory", config.ttl.memoryTtlMs);
    this.rateLimit = new RateLimitStore(
      make("ratelimit", config.ttl.rateLimitWindowMs),
      config.ttl.rateLimitWindowMs,
      driver,
    );
  }

  namespaces(): readonly NamespacedCache[] {
    return [this.distributed, this.session, this.workflow, this.prompt, this.memory];
  }

  async invalidateAll(): Promise<number> {
    return this.driver.clear(`${this.config.keyPrefix}:`);
  }

  async health(): Promise<AggregatedHealth> {
    const reachable = await this.driver.ping().catch(() => false);
    return aggregateHealth([
      {
        name: "cache.driver",
        status: reachable ? "healthy" : "unhealthy",
        details: { kind: this.driver.kind },
      },
      ...this.namespaces().map((ns) => ({
        name: `cache.${ns.namespace}`,
        status: "healthy" as const,
        details: { ...ns.stats() },
      })),
    ]);
  }
}
