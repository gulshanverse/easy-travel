/**
 * Memory Engine — Retriever (EDS-001 v2.0 §5).
 *
 * Implements the 10-stage deterministic pipeline. Semantic similarity uses a
 * lightweight lexical Jaccard/token-overlap heuristic when no external
 * embedding provider is wired; the interface is stable so an embedding
 * client can replace it without touching call sites.
 */
import type { MemoryConfiguration } from "./config";
import { DEFAULT_BUDGET } from "./config";
import type { MemoryStore } from "./store/types";
import type {
  MemoryClass,
  MemoryEnvelope,
  RankedMemory,
  RetrievalBudget,
  RetrievalQuery,
  RetrievalResult,
  RetrievalTrace,
} from "./types";
import { MemoryRanker } from "./ranker";
import { MemoryConfidenceEngine } from "./confidence";
import { newCorrelationId } from "./ids";
import { queryHash } from "./hash";

const SESSION_CLASSES: MemoryClass[] = ["short_term", "working", "conversation"];
const SEMANTIC_CLASSES: MemoryClass[] = [
  "semantic", "episodic", "preference", "journey", "spatial", "reflection", "portfolio",
];

export interface SemanticSearcher {
  score(query: string, env: MemoryEnvelope): number; // [0,1]
}

/** Default lexical searcher: token-overlap Jaccard on payload/tags/kind. */
export class LexicalSearcher implements SemanticSearcher {
  score(query: string, env: MemoryEnvelope): number {
    if (!query) return 0;
    const q = tokenize(query);
    if (!q.size) return 0;
    const text = [
      env.kind,
      ...(env.tags ?? []),
      typeof env.payload === "string" ? env.payload : JSON.stringify(env.payload ?? {}),
    ].join(" ");
    const t = tokenize(text);
    if (!t.size) return 0;
    let inter = 0;
    for (const w of q) if (t.has(w)) inter += 1;
    const union = q.size + t.size - inter;
    return union > 0 ? inter / union : 0;
  }
}

function tokenize(s: string): Set<string> {
  return new Set(
    s.toLowerCase().split(/[^a-z0-9]+/g).filter((w) => w.length >= 2 && w.length <= 32),
  );
}

export class MemoryRetriever {
  private ranker: MemoryRanker;
  private confidence = new MemoryConfidenceEngine();

  constructor(
    private config: MemoryConfiguration,
    private store: MemoryStore,
    private searcher: SemanticSearcher = new LexicalSearcher(),
  ) {
    this.ranker = new MemoryRanker(config);
  }

  async retrieve(query: RetrievalQuery): Promise<RetrievalResult> {
    const started = Date.now();
    const now = query.now ?? started;
    const budget = mergeBudget(this.config.defaultBudget, query.budget);
    const trace: RetrievalTrace = {
      queryHash: await queryHash({ ...query, now: undefined }),
      purpose: query.purpose,
      stageCounts: {},
      dropped: [],
      weightsProfile: query.purpose,
      weightsVersion: this.ranker.profile(query.purpose).version,
      degraded: false,
      latencyMs: 0,
    };

    // Stage 1 — Context (session-scoped) always included first.
    const sessionCandidates = await this.store.list({
      ownerId: query.ownerId,
      classes: query.classes ?? SESSION_CLASSES,
      threadId: query.threadId ?? undefined,
      statuses: ["active"],
      now,
    });
    trace.stageCounts["context"] = sessionCandidates.length;

    // Stage 2 — Semantic search across long-lived classes.
    let semanticCandidates: MemoryEnvelope[] = [];
    if (this.config.flags.enableSemanticSearch) {
      semanticCandidates = await this.store.list({
        ownerId: query.ownerId,
        classes: intersect(query.classes, SEMANTIC_CLASSES),
        statuses: ["active"],
        now,
      });
    }
    trace.stageCounts["semantic"] = semanticCandidates.length;

    // Stage 3 — Relationship expansion (from top-K session+semantic).
    const seed = [...sessionCandidates, ...semanticCandidates];
    let relationshipCandidates: MemoryEnvelope[] = [];
    if (this.config.flags.enableRelationshipExpansion) {
      const relatedIds = new Set<string>();
      for (const s of seed) {
        for (const id of s.relatedIds ?? []) relatedIds.add(id);
        for (const e of s.relationships ?? []) relatedIds.add(e.targetId);
      }
      for (const id of relatedIds) {
        const m = await this.store.get(id, query.ownerId);
        if (m && m.status === "active") relationshipCandidates.push(m);
      }
    }
    trace.stageCounts["relationship"] = relationshipCandidates.length;

    // Stage 4 — Journey expansion.
    let journeyCandidates: MemoryEnvelope[] = [];
    if (query.journeyId) {
      journeyCandidates = await this.store.list({
        ownerId: query.ownerId,
        classes: ["journey", "portfolio"],
        journeyId: query.journeyId,
        statuses: ["active"],
        now,
      });
    }
    trace.stageCounts["journey"] = journeyCandidates.length;

    // Stage 5 — Preference expansion.
    const preferenceCandidates = await this.store.list({
      ownerId: query.ownerId,
      classes: ["preference"],
      statuses: ["active"],
      now,
    });
    trace.stageCounts["preference"] = preferenceCandidates.length;

    // Stage 6 — Goal expansion.
    let goalCandidates: MemoryEnvelope[] = [];
    if (query.goalIds?.length) {
      goalCandidates = await this.store.list({
        ownerId: query.ownerId,
        classes: ["goal"],
        goalIds: query.goalIds,
        statuses: ["active"],
        now,
      });
    }
    trace.stageCounts["goal"] = goalCandidates.length;

    // Merge candidate pool (dedup by memoryId).
    const pool = new Map<string, MemoryEnvelope>();
    for (const m of [
      ...sessionCandidates, ...semanticCandidates, ...relationshipCandidates,
      ...journeyCandidates, ...preferenceCandidates, ...goalCandidates,
    ]) {
      if (!pool.has(m.memoryId)) pool.set(m.memoryId, m);
    }

    // Stage 7 — Trust filtering + min-confidence filter.
    const minTrust = query.minTrust ?? 0;
    const minConf = budget.minConfidence ?? 0;
    const filtered: MemoryEnvelope[] = [];
    for (const m of pool.values()) {
      const eff = this.confidence.effective(m, now);
      if (eff < minConf) {
        trace.dropped.push({ memoryId: m.memoryId, reason: "min_confidence" });
        continue;
      }
      const trust = m.trustSourceId ? 0.7 : 0.5; // no external trust registry yet
      if (trust < minTrust) {
        trace.dropped.push({ memoryId: m.memoryId, reason: "min_trust" });
        continue;
      }
      filtered.push(m);
    }
    trace.stageCounts["trust_filtered"] = filtered.length;

    // Stage 8 — Ranking.
    const goalSet = new Set(query.goalIds ?? []);
    const ranked = filtered.map((m) => this.ranker.score(m, query.purpose, {
      similarity: query.text ? this.searcher.score(query.text, m) : 0,
      goalAlignment: (m.goalIds ?? []).some((g) => goalSet.has(g)) ? 1 : 0,
      contradictionPenalty: m.status === "needs_reconciliation" ? 1 : 0,
      trust: m.trustSourceId ? 0.7 : 0.5,
      now,
    }));
    const sorted = this.ranker.sort(ranked);
    trace.stageCounts["ranked"] = sorted.length;

    // Stage 9 — Deduplication by content_hash.
    const seen = new Map<string, RankedMemory>();
    for (const r of sorted) {
      const h = r.memory.contentHash;
      const existing = seen.get(h);
      if (!existing) {
        seen.set(h, r);
      } else {
        existing.alsoSeenIds = existing.alsoSeenIds ?? [];
        existing.alsoSeenIds.push(r.memory.memoryId);
        trace.dropped.push({ memoryId: r.memory.memoryId, reason: "duplicate" });
      }
    }
    const deduped = Array.from(seen.values());
    trace.stageCounts["deduped"] = deduped.length;

    // Stage 10 — Final assembly under budget (per-class caps + total cap).
    const perClass: Partial<Record<MemoryClass, number>> = {};
    const final: RankedMemory[] = [];
    for (const item of deduped) {
      const cap = budget.perClassCaps?.[item.memory.class] ?? Infinity;
      const used = perClass[item.memory.class] ?? 0;
      if (used >= cap) {
        trace.dropped.push({ memoryId: item.memory.memoryId, reason: "class_cap" });
        continue;
      }
      if (final.length >= budget.maxItems) {
        trace.dropped.push({ memoryId: item.memory.memoryId, reason: "item_cap" });
        continue;
      }
      perClass[item.memory.class] = used + 1;
      final.push(item);
    }
    trace.stageCounts["final"] = final.length;

    // Diversity floor: warn (degraded) but never over-drop.
    if (budget.diversityFloor) {
      const distinctClasses = new Set(final.map((f) => f.memory.class)).size;
      if (distinctClasses < budget.diversityFloor && final.length > 0) {
        trace.degraded = true;
        trace.degradedReason = "diversity_floor_unmet";
      }
    }

    trace.latencyMs = Date.now() - started;
    return { items: final, trace, correlationId: newCorrelationId("ret") };
  }
}

function mergeBudget(base: RetrievalBudget, override?: Partial<RetrievalBudget>): RetrievalBudget {
  if (!override) return { ...DEFAULT_BUDGET, ...base };
  return {
    maxItems: override.maxItems ?? base.maxItems,
    maxTokens: override.maxTokens ?? base.maxTokens,
    minConfidence: override.minConfidence ?? base.minConfidence,
    diversityFloor: override.diversityFloor ?? base.diversityFloor,
    perClassCaps: { ...base.perClassCaps, ...override.perClassCaps },
  };
}

function intersect<T>(a: T[] | undefined, b: T[]): T[] {
  if (!a?.length) return b;
  return a.filter((x) => b.includes(x));
}
