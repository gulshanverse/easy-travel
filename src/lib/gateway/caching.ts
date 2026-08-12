/** Provider Gateway (P-1.4) — provider-aware caching and idempotency.
 *  Backed by the injected P-1.1 cache/persistence ports; the in-memory
 *  implementations below are the deterministic default for tests.
 */
import { cacheKeyFor, newIdempotencyRecordId, operationIdentity, requestFingerprint } from "./ids";
import type { ProviderCachePolicy } from "./types";

/* ------------------------------------------------------------------ */
/* Cache                                                               */
/* ------------------------------------------------------------------ */

export interface GatewayCachePort {
  get<T>(key: string): Promise<{ value: T; storedAt: number } | null>;
  set<T>(key: string, value: T, ttlMs: number): Promise<void>;
  delete(key: string): Promise<void>;
}

export class InMemoryGatewayCache implements GatewayCachePort {
  private entries = new Map<string, { value: unknown; storedAt: number; expiresAt: number }>();
  async get<T>(key: string): Promise<{ value: T; storedAt: number } | null> {
    const e = this.entries.get(key);
    if (!e) return null;
    if (e.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return null;
    }
    return { value: e.value as T, storedAt: e.storedAt };
  }
  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    const now = Date.now();
    this.entries.set(key, { value, storedAt: now, expiresAt: now + ttlMs });
  }
  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }
  size(): number {
    return this.entries.size;
  }
  clear(): void {
    this.entries.clear();
  }
}

export interface CacheLookup<T> {
  readonly hit: boolean;
  readonly stale: boolean;
  readonly value?: T;
}

export class GatewayCache {
  private hits = 0;
  private misses = 0;
  constructor(private readonly port: GatewayCachePort = new InMemoryGatewayCache()) {}

  key = cacheKeyFor;

  stats(): { hits: number; misses: number; hitRate: number } {
    const total = this.hits + this.misses;
    return { hits: this.hits, misses: this.misses, hitRate: total === 0 ? 0 : this.hits / total };
  }

  async lookup<T>(
    key: string,
    policy: ProviderCachePolicy,
    cacheable: boolean,
  ): Promise<CacheLookup<T>> {
    if (!policy.enabled || !cacheable) {
      this.misses++;
      return { hit: false, stale: false };
    }
    const found = await this.port.get<T>(key);
    if (!found) {
      this.misses++;
      return { hit: false, stale: false };
    }
    this.hits++;
    const age = Date.now() - found.storedAt;
    return { hit: true, stale: age > policy.ttlMs, value: found.value };
  }

  async store<T>(
    key: string,
    value: T,
    policy: ProviderCachePolicy,
    cacheable: boolean,
  ): Promise<void> {
    // Never cache non-cacheable mutation results or auth material.
    if (!policy.enabled || !cacheable) return;
    await this.port.set(key, value, policy.ttlMs + policy.staleWhileRevalidateMs);
  }

  invalidate(key: string): Promise<void> {
    return this.port.delete(key);
  }

  reset(): void {
    this.hits = 0;
    this.misses = 0;
  }
}

/* ------------------------------------------------------------------ */
/* Idempotency                                                         */
/* ------------------------------------------------------------------ */

export interface IdempotencyRecord {
  readonly id: string;
  readonly key: string;
  readonly fingerprint: string;
  readonly operation: string;
  readonly state: "in-flight" | "completed" | "failed";
  readonly result?: unknown;
  readonly createdAt: number;
  readonly completedAt?: number;
}

export interface IdempotencyStorePort {
  get(key: string): Promise<IdempotencyRecord | null>;
  put(record: IdempotencyRecord): Promise<void>;
}

export class InMemoryIdempotencyStore implements IdempotencyStorePort {
  private rows = new Map<string, IdempotencyRecord>();
  async get(key: string): Promise<IdempotencyRecord | null> {
    return this.rows.get(key) ?? null;
  }
  async put(record: IdempotencyRecord): Promise<void> {
    this.rows.set(record.key, record);
  }
  size(): number {
    return this.rows.size;
  }
  clear(): void {
    this.rows.clear();
  }
}

export class IdempotencyManager {
  private replays = 0;
  constructor(private readonly store: IdempotencyStorePort = new InMemoryIdempotencyStore()) {}

  replayCount(): number {
    return this.replays;
  }

  identity = operationIdentity;
  fingerprint = requestFingerprint;

  scopedKey(input: {
    idempotencyKey: string;
    capability: string;
    operation: string;
    userId?: string;
    tenantId?: string;
  }): string {
    return `${operationIdentity(input)}:${input.idempotencyKey}`;
  }

  /** Returns a replayable record when the same key + fingerprint completed. */
  async begin(input: {
    key: string;
    fingerprint: string;
    operation: string;
  }): Promise<{ replay: boolean; record: IdempotencyRecord }> {
    const existing = await this.store.get(input.key);
    if (existing && existing.fingerprint === input.fingerprint && existing.state === "completed") {
      this.replays++;
      return { replay: true, record: existing };
    }
    if (existing && existing.fingerprint !== input.fingerprint) {
      throw new Error(`idempotency key reused with a different request fingerprint`);
    }
    if (existing && existing.state === "in-flight") {
      this.replays++;
      return { replay: true, record: existing };
    }
    const record: IdempotencyRecord = Object.freeze({
      id: newIdempotencyRecordId(),
      key: input.key,
      fingerprint: input.fingerprint,
      operation: input.operation,
      state: "in-flight" as const,
      createdAt: Date.now(),
    });
    await this.store.put(record);
    return { replay: false, record };
  }

  async complete(record: IdempotencyRecord, result: unknown): Promise<void> {
    await this.store.put(
      Object.freeze({
        ...record,
        state: "completed" as const,
        result,
        completedAt: Date.now(),
      }),
    );
  }

  async fail(record: IdempotencyRecord): Promise<void> {
    await this.store.put(
      Object.freeze({ ...record, state: "failed" as const, completedAt: Date.now() }),
    );
  }
}
