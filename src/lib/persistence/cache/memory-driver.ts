/**
 * In-memory CacheDriver — LRU-bounded with TTL. Development/test only.
 */

import type { CacheDriver, CacheEntry } from "./types";

export class InMemoryCacheDriver implements CacheDriver {
  readonly kind = "memory" as const;
  private readonly entries = new Map<string, CacheEntry>();
  evictions = 0;

  constructor(private readonly maxEntries = 10_000) {}

  private live(key: string): CacheEntry | undefined {
    const e = this.entries.get(key);
    if (!e) return undefined;
    if (e.expiresAt !== null && e.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    // LRU touch
    this.entries.delete(key);
    this.entries.set(key, e);
    return e;
  }

  async get<T>(key: string): Promise<T | null> {
    const e = this.live(key);
    return e ? (e.value as T) : null;
  }

  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    this.entries.delete(key);
    this.entries.set(key, {
      value,
      expiresAt: ttlMs && ttlMs > 0 ? Date.now() + ttlMs : null,
    });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
      this.evictions += 1;
    }
  }

  async delete(key: string): Promise<boolean> {
    return this.entries.delete(key);
  }

  async has(key: string): Promise<boolean> {
    return this.live(key) !== undefined;
  }

  async increment(key: string, by: number, ttlMs?: number): Promise<number> {
    const current = (await this.get<number>(key)) ?? 0;
    const next = current + by;
    const existing = this.entries.get(key);
    const remaining =
      existing?.expiresAt != null ? Math.max(1, existing.expiresAt - Date.now()) : ttlMs;
    await this.set(key, next, remaining);
    return next;
  }

  async keys(prefix: string): Promise<readonly string[]> {
    const out: string[] = [];
    for (const key of this.entries.keys()) if (key.startsWith(prefix)) out.push(key);
    return out.sort();
  }

  async clear(prefix?: string): Promise<number> {
    if (!prefix) {
      const n = this.entries.size;
      this.entries.clear();
      return n;
    }
    let n = 0;
    for (const key of [...this.entries.keys()])
      if (key.startsWith(prefix)) {
        this.entries.delete(key);
        n += 1;
      }
    return n;
  }

  async ping(): Promise<boolean> {
    return true;
  }

  async size(): Promise<number> {
    return this.entries.size;
  }
}
