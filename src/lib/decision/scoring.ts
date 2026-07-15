/**
 * Decision Scoring Engine — weighted, deterministic.
 * Never calls providers or LLMs.
 */

import { DecisionScoringError } from "./errors";
import { createDimensionScore, createScore } from "./factories";
import type {
  DecisionOption, DecisionScore, DimensionScore, ScoreDimension, ScoreWeights,
} from "./types";
import { SCORE_DIMENSIONS } from "./types";

export interface ScoringOptions {
  readonly weights: ScoreWeights;
  /** Preference weights (0..1) merged into the preference dimension. */
  readonly preferences?: Readonly<Record<string, number>>;
}

export class ScoringEngine {
  score(option: DecisionOption, opts: ScoringOptions): DecisionScore {
    if (!option) throw new DecisionScoringError("option required");
    const weights = opts.weights;
    const dims: DimensionScore[] = [];
    for (const dim of SCORE_DIMENSIONS) {
      const raw = this.rawFor(option, dim, opts);
      dims.push(createDimensionScore({
        dimension: dim,
        raw,
        weight: weights[dim] ?? 0,
        rationale: this.rationale(dim, raw),
      }));
    }
    const confidence = this.confidence(dims);
    return createScore({ optionId: option.id, dimensions: dims, confidence });
  }

  scoreMany(options: readonly DecisionOption[], opts: ScoringOptions): readonly DecisionScore[] {
    return options.map((o) => this.score(o, opts));
  }

  private rawFor(
    option: DecisionOption,
    dim: ScoreDimension,
    opts: ScoringOptions,
  ): number {
    const base = option.features[dim];
    if (dim === "preference" && opts.preferences && Object.keys(opts.preferences).length) {
      // Blend option preference feature with tag-based preference match.
      const tags = option.tags.map((t) => t.toLowerCase());
      let matched = 0;
      let total = 0;
      for (const [k, w] of Object.entries(opts.preferences)) {
        total += w;
        if (tags.includes(k.toLowerCase())) matched += w;
      }
      const tagScore = total > 0 ? matched / total : 0;
      return Math.max(0, Math.min(1, 0.6 * base + 0.4 * tagScore));
    }
    return base;
  }

  private rationale(dim: ScoreDimension, raw: number): string {
    const band = raw >= 0.75 ? "strong" : raw >= 0.5 ? "adequate" : raw >= 0.25 ? "weak" : "poor";
    return `${dim}:${band}(${raw.toFixed(2)})`;
  }

  private confidence(dims: readonly DimensionScore[]): number {
    // Confidence rises when weighted contributions are consistent (low variance).
    const totalWeight = dims.reduce((s, d) => s + d.weight, 0) || 1;
    const mean = dims.reduce((s, d) => s + d.raw * d.weight, 0) / totalWeight;
    const variance = dims.reduce((s, d) => s + d.weight * Math.pow(d.raw - mean, 2), 0) / totalWeight;
    // Map variance in [0, 0.25] to confidence in [1, 0.5].
    const conf = 1 - Math.min(0.25, variance) * 2;
    return Math.max(0.5, Math.min(1, conf));
  }
}
