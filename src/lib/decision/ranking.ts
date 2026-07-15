/**
 * Ranking Engine — weighted, stable, explainable.
 * Deterministic tie-breaking:
 *   1. overall score DESC
 *   2. confidence DESC
 *   3. option.createdAt ASC
 *   4. option.id ASC
 */

import type { ConstraintEvaluation } from "./constraints";
import { DecisionRankingError } from "./errors";
import { freezeRanked } from "./factories";
import type { DecisionOption, DecisionScore, RankedOption } from "./types";

export interface RankingInput {
  readonly options: readonly DecisionOption[];
  readonly scores: readonly DecisionScore[];
  readonly evaluations?: readonly ConstraintEvaluation[];
  readonly topN?: number;
  readonly minConfidence?: number;
  /** When true, hard-violating options are excluded from ranking output. */
  readonly excludeHardViolations?: boolean;
}

export class RankingEngine {
  rank(input: RankingInput): readonly RankedOption[] {
    if (!input.options?.length) return freezeRanked([]);
    if (!input.scores?.length) throw new DecisionRankingError("scores required");

    const optionsById = new Map<string, DecisionOption>();
    for (const o of input.options) optionsById.set(o.id, o);
    const evalById = new Map<string, ConstraintEvaluation>();
    for (const e of input.evaluations ?? []) evalById.set(e.optionId, e);

    const rows: RankedOption[] = [];
    for (const s of input.scores) {
      const o = optionsById.get(s.optionId);
      if (!o) continue;
      if (input.minConfidence !== undefined && s.confidence < input.minConfidence) continue;
      const ev = evalById.get(o.id);
      const satisfies = ev ? ev.satisfiesHardConstraints : true;
      const violatedIds = ev ? ev.violated.map((v) => v.id) : [];
      if (input.excludeHardViolations && !satisfies) continue;
      rows.push({
        optionId: o.id,
        rank: 0,
        score: s,
        satisfiesHardConstraints: satisfies,
        violatedConstraintIds: Object.freeze(violatedIds),
      });
    }

    rows.sort((a, b) => {
      // Hard-constraint satisfaction dominates when both retained.
      if (a.satisfiesHardConstraints !== b.satisfiesHardConstraints) {
        return a.satisfiesHardConstraints ? -1 : 1;
      }
      if (b.score.overall !== a.score.overall) return b.score.overall - a.score.overall;
      if (b.score.confidence !== a.score.confidence) return b.score.confidence - a.score.confidence;
      const oa = optionsById.get(a.optionId)!;
      const ob = optionsById.get(b.optionId)!;
      if (oa.createdAt !== ob.createdAt) return oa.createdAt < ob.createdAt ? -1 : 1;
      return a.optionId < b.optionId ? -1 : a.optionId > b.optionId ? 1 : 0;
    });

    const withRanks = rows.map((r, i) => ({ ...r, rank: i + 1 }));
    const capped = input.topN && input.topN > 0 ? withRanks.slice(0, input.topN) : withRanks;
    return freezeRanked(capped);
  }
}
