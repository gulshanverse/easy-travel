/**
 * TIOS Recommendation Pipeline.
 * Context → Knowledge → Business Rules → Ranking → AI Enhancement → Explainability → User
 * AI is optional; passing enhance=undefined keeps the pipeline deterministic.
 */
import { emitTIOSEvent } from "./events";
import { evaluatePolicies } from "./policy";
import type {
  DecisionContext, Explanation, RecommendationCandidate, RecommendationScored,
} from "./types";

export interface RecommendationPipelineInput<T> {
  category: string;                // policy category (e.g. "recommendation")
  candidates: RecommendationCandidate<T>[];
  weights?: {
    base?: number; policy?: number; context?: number; diversity?: number;
  };
  diversify?: (c: RecommendationScored<T>[]) => RecommendationScored<T>[];
  enhance?: (
    top: RecommendationScored<T>[], ctx: DecisionContext,
  ) => Promise<RecommendationScored<T>[]>;
  limit?: number;
}

export interface RecommendationResult<T> {
  items: RecommendationScored<T>[];
  explanation: Explanation;
}

const DEFAULT_WEIGHTS = { base: 0.6, policy: 0.2, context: 0.15, diversity: 0.05 };

/** Simple round-robin by `type` to diversify. */
function defaultDiversify<T>(items: RecommendationScored<T>[]): RecommendationScored<T>[] {
  const buckets = new Map<string, RecommendationScored<T>[]>();
  for (const it of items) {
    if (!buckets.has(it.type)) buckets.set(it.type, []);
    buckets.get(it.type)!.push(it);
  }
  const out: RecommendationScored<T>[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const list of buckets.values()) {
      const next = list.shift();
      if (next) { out.push(next); added = true; }
    }
  }
  return out;
}

export async function runRecommendationPipeline<T extends Record<string, unknown>>(
  input: RecommendationPipelineInput<T>,
  ctx: DecisionContext,
): Promise<RecommendationResult<T>> {
  const w = { ...DEFAULT_WEIGHTS, ...(input.weights ?? {}) };
  const scored: RecommendationScored<T>[] = [];

  for (const c of input.candidates) {
    const policy = await evaluatePolicies(input.category, c.payload, ctx);
    if (!policy.allowed) continue;

    const contextBoost = Number((c.payload as Record<string, unknown>).contextBoost ?? 0);
    const penalty = policy.warnings.length * 0.05;
    const rawScore = Math.max(
      0,
      Math.min(
        1,
        c.baseScore * w.base +
          (1 - penalty) * w.policy +
          contextBoost * w.context,
      ),
    );

    const reasons: string[] = [];
    if (c.baseScore >= 0.75) reasons.push("High base relevance score");
    if (contextBoost > 0) reasons.push("Matches current trip context");
    if (policy.warnings.length === 0) reasons.push("No policy warnings");

    const antiReasons = policy.warnings
      .map((d) => d.message)
      .filter((m): m is string => Boolean(m));

    const confidence = Math.min(
      1,
      0.5 + c.baseScore * 0.3 + contextBoost * 0.15 - penalty,
    );

    scored.push({
      ...c,
      score: rawScore,
      confidence: Math.max(0, confidence),
      reasons,
      antiReasons,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  const diversified = (input.diversify ?? defaultDiversify)(scored);
  const limited = diversified.slice(0, input.limit ?? 10);

  const finalItems = input.enhance ? await input.enhance(limited, ctx) : limited;

  const top = finalItems[0];
  const explanation: Explanation = {
    summary: top
      ? `Top pick: ${top.type} (${(top.confidence * 100).toFixed(0)}% confidence)`
      : "No candidates satisfy current policies.",
    reasons: top?.reasons ?? [],
    antiReasons: top?.antiReasons ?? [],
    alternatives: finalItems.slice(1, 4).map((it) => ({
      id: it.id,
      label: (it.payload as Record<string, unknown>).name as string ?? it.id,
    })),
    confidence: top?.confidence ?? 0,
  };

  emitTIOSEvent({
    name: "RECOMMENDATION_CREATED",
    requestId: ctx.requestId,
    timestamp: Date.now(),
    data: { count: finalItems.length, category: input.category },
  });

  return { items: finalItems, explanation };
}
