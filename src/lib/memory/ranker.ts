/**
 * Memory Engine — Ranking (EDS-001 v2.0 §5.8).
 *
 * Deterministic scoring using per-purpose weight profiles. All inputs are
 * pre-computed by the retriever; the ranker itself is a pure function.
 */
import type { MemoryConfiguration, RankProfile } from "./config";
import type { MemoryEnvelope, RankedMemory, RetrievalPurpose, ScoreDecomposition } from "./types";
import { MemoryConfidenceEngine } from "./confidence";

export interface RankInputs {
  similarity: number;         // [0,1]
  goalAlignment?: number;      // [0,1]
  contradictionPenalty?: number; // [0,1]
  trust?: number;              // override for source trust
  now?: number;                // ms
}

export class MemoryRanker {
  private conf = new MemoryConfidenceEngine();

  constructor(private config: MemoryConfiguration) {}

  profile(purpose: RetrievalPurpose): RankProfile {
    return this.config.rankProfiles[purpose];
  }

  score<T>(env: MemoryEnvelope<T>, purpose: RetrievalPurpose, inputs: RankInputs): RankedMemory<T> {
    const p = this.profile(purpose);
    const w = p.weights;
    const now = inputs.now ?? Date.now();
    const confidenceEffective = this.conf.effective(env, now);
    const recency = recencyScore(env.updatedAt, now);
    const trust = inputs.trust ?? 0.5;
    const dec: ScoreDecomposition = {
      confidenceEffective,
      similarity: clamp(inputs.similarity),
      recency,
      importance: clamp(env.importance),
      trust: clamp(trust),
      goalAlignment: clamp(inputs.goalAlignment ?? 0),
      contradictionPenalty: clamp(inputs.contradictionPenalty ?? 0),
      final: 0,
    };
    dec.final =
      w.confidence * dec.confidenceEffective +
      w.similarity * dec.similarity +
      w.recency * dec.recency +
      w.importance * dec.importance +
      w.trust * dec.trust +
      w.goalAlignment * dec.goalAlignment -
      w.contradictionPenalty * dec.contradictionPenalty;
    dec.final = clamp(dec.final);
    return { memory: env, score: dec, stage: "ranked" };
  }

  sort<T>(items: RankedMemory<T>[]): RankedMemory<T>[] {
    return [...items].sort((a, b) => {
      if (b.score.final !== a.score.final) return b.score.final - a.score.final;
      // Deterministic tiebreak: newer > older, then id
      const at = Date.parse(a.memory.updatedAt);
      const bt = Date.parse(b.memory.updatedAt);
      if (bt !== at) return bt - at;
      return a.memory.memoryId.localeCompare(b.memory.memoryId);
    });
  }
}

function clamp(n: number): number { return Math.min(1, Math.max(0, n)); }

function recencyScore(updatedAt: string, now: number): number {
  const t = Date.parse(updatedAt);
  if (!Number.isFinite(t)) return 0.5;
  const ageDays = Math.max(0, (now - t) / 86_400_000);
  // Half-life ~30 days
  return Math.pow(0.5, ageDays / 30);
}
