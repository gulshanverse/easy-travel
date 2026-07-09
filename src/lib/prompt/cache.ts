/**
 * PromptCache — provider-independent LRU+TTL cache with four namespaces:
 * compiled prompts, semantic responses, context assemblies, template renders.
 * Version-aware invalidation is exposed via invalidateByPrompt().
 */
import type { CachePolicy } from "./config";
import type { CompiledPrompt, PromptId, PromptVersion } from "./types";

interface Entry<V> {
  value: V;
  expiresAt: number;
}

export class TtlLruCache<K, V> {
  private readonly map = new Map<K, Entry<V>>();
  private hits = 0;
  private misses = 0;
  constructor(private readonly maxEntries: number, private readonly ttlMs: number) {}

  get(key: K): V | undefined {
    const e = this.map.get(key);
    if (!e) { this.misses++; return undefined; }
    if (e.expiresAt < Date.now()) {
      this.map.delete(key);
      this.misses++;
      return undefined;
    }
    // LRU touch.
    this.map.delete(key);
    this.map.set(key, e);
    this.hits++;
    return e.value;
  }

  set(key: K, value: V, ttlMs = this.ttlMs): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, expiresAt: Date.now() + ttlMs });
    if (this.map.size > this.maxEntries) {
      const first = this.map.keys().next().value as K | undefined;
      if (first !== undefined) this.map.delete(first);
    }
  }

  delete(key: K): boolean { return this.map.delete(key); }
  clear(): void { this.map.clear(); }
  size(): number { return this.map.size; }

  stats(): { size: number; hits: number; misses: number } {
    return { size: this.map.size, hits: this.hits, misses: this.misses };
  }

  keys(): K[] { return [...this.map.keys()]; }
}

export interface CachedResponse {
  content: string;
  parsed?: unknown;
  cachedAt: number;
}

export class PromptCache {
  readonly compiled: TtlLruCache<string, CompiledPrompt>;
  readonly semantic: TtlLruCache<string, CachedResponse>;
  readonly context: TtlLruCache<string, unknown>;
  readonly template: TtlLruCache<string, string>;

  constructor(policy: CachePolicy) {
    this.compiled = new TtlLruCache(policy.compiled.maxEntries, policy.compiled.ttlMs);
    this.semantic = new TtlLruCache(policy.semantic.maxEntries, policy.semantic.ttlMs);
    this.context = new TtlLruCache(policy.context.maxEntries, policy.context.ttlMs);
    this.template = new TtlLruCache(policy.template.maxEntries, policy.template.ttlMs);
  }

  compiledKey(promptId: PromptId, version: PromptVersion, fingerprint: string): string {
    return `${promptId}@${version}:${fingerprint}`;
  }

  invalidateByPrompt(promptId: PromptId, version?: PromptVersion): number {
    let n = 0;
    for (const k of this.compiled.keys()) {
      const [pv] = k.split(":");
      const [id, v] = pv.split("@");
      if (id === promptId && (!version || v === version)) {
        this.compiled.delete(k);
        n++;
      }
    }
    for (const k of this.semantic.keys()) {
      const [pv] = k.split(":");
      const [id, v] = pv.split("@");
      if (id === promptId && (!version || v === version)) {
        this.semantic.delete(k);
        n++;
      }
    }
    return n;
  }

  clearAll(): void {
    this.compiled.clear();
    this.semantic.clear();
    this.context.clear();
    this.template.clear();
  }

  stats(): {
    compiled: ReturnType<TtlLruCache<unknown, unknown>["stats"]>;
    semantic: ReturnType<TtlLruCache<unknown, unknown>["stats"]>;
    context: ReturnType<TtlLruCache<unknown, unknown>["stats"]>;
    template: ReturnType<TtlLruCache<unknown, unknown>["stats"]>;
  } {
    return {
      compiled: this.compiled.stats(),
      semantic: this.semantic.stats(),
      context: this.context.stats(),
      template: this.template.stats(),
    };
  }
}
