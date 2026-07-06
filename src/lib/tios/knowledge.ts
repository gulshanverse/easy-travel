/**
 * TIOS Knowledge Graph interfaces.
 * We do not ship the full graph — we define provider contracts so future
 * knowledge sources (Cloud tables, external APIs, embeddings) plug in
 * without modifying callers.
 */
import type {
  KnowledgeEntityType, KnowledgeProvider, KnowledgeQuery, KnowledgeResult,
} from "./types";

const providers = new Map<string, KnowledgeProvider>();

export function registerKnowledgeProvider(p: KnowledgeProvider): void {
  providers.set(p.id, p);
}

export function unregisterKnowledgeProvider(id: string): void {
  providers.delete(id);
}

export function listKnowledgeProviders(): KnowledgeProvider[] {
  return Array.from(providers.values());
}

/** Query the first provider that supports the entity. Returns empty when none. */
export async function queryKnowledge<T = Record<string, unknown>>(
  q: KnowledgeQuery,
): Promise<KnowledgeResult<T>> {
  for (const p of providers.values()) {
    if (p.supports(q.entity)) return p.query<T>(q);
  }
  return { entity: q.entity, items: [], source: "empty" };
}

/** Fan-out query across every provider that supports the entity. */
export async function queryKnowledgeAll<T = Record<string, unknown>>(
  q: KnowledgeQuery,
): Promise<KnowledgeResult<T>[]> {
  const results: KnowledgeResult<T>[] = [];
  for (const p of providers.values()) {
    if (!p.supports(q.entity)) continue;
    try { results.push(await p.query<T>(q)); } catch { /* provider errors are non-fatal */ }
  }
  return results;
}

// A no-op provider so the pipeline works out of the box.
registerKnowledgeProvider({
  id: "noop",
  supports: (_e: KnowledgeEntityType) => false,
  query: async (q) => ({ entity: q.entity, items: [], source: "noop" }),
});
