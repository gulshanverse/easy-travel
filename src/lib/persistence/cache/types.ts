/**
 * Cache contracts — driver-independent. Redis is one driver, not the API.
 */

export interface CacheEntry<T = unknown> {
  readonly value: T;
  readonly expiresAt: number | null;
}

export interface CacheDriver {
  readonly kind: "memory" | "redis";
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlMs?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  has(key: string): Promise<boolean>;
  increment(key: string, by: number, ttlMs?: number): Promise<number>;
  keys(prefix: string): Promise<readonly string[]>;
  clear(prefix?: string): Promise<number>;
  ping(): Promise<boolean>;
  size(): Promise<number>;
}

export interface CacheStats {
  readonly hits: number;
  readonly misses: number;
  readonly writes: number;
  readonly evictions: number;
  readonly hitRate: number;
}
