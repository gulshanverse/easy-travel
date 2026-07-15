/**
 * Trade-off Engine — reasons about pair-wise dimensional trade-offs.
 * Deterministic. Never calls providers.
 */

import { createTradeoff } from "./factories";
import type { DecisionOption, DecisionScore, DecisionTradeoff, ScoreDimension } from "./types";

/** Common trade-off pairs to inspect. */
export const TRADEOFF_PAIRS: readonly (readonly [ScoreDimension, ScoreDimension])[] = Object.freeze([
  ["budget", "time"],
  ["budget", "comfort"],
  ["time", "comfort"],
  ["time", "flexibility"],
  ["seasonality", "budget"],
  ["risk", "flexibility"],
  ["sustainability", "budget"],
  ["complexity", "journeyFit"],
] as const);

const READABLE: Record<ScoreDimension, string> = {
  budget: "cost",
  time: "speed",
  comfort: "comfort",
  risk: "risk",
  preference: "preference match",
  journeyFit: "journey fit",
  seasonality: "seasonality",
  sustainability: "sustainability",
  flexibility: "flexibility",
  complexity: "simplicity",
};

export interface TradeoffOptions {
  readonly maxPairs?: number;
  readonly deltaThreshold?: number;
}

export class TradeoffEngine {
  compute(
    options: readonly DecisionOption[],
    scores: readonly DecisionScore[],
    opts: TradeoffOptions = {},
  ): readonly DecisionTradeoff[] {
    if (options.length < 2) return Object.freeze([]);
    const threshold = opts.deltaThreshold ?? 0.05;
    const scoreByOption = new Map<string, DecisionScore>();
    for (const s of scores) scoreByOption.set(s.optionId, s);
    const dimWeighted = (s: DecisionScore, dim: ScoreDimension): number =>
      s.dimensions.find((d) => d.dimension === dim)?.weighted ?? 0;

    const results: DecisionTradeoff[] = [];
    const cap = opts.maxPairs ?? 32;
    for (let i = 0; i < options.length && results.length < cap; i++) {
      for (let j = i + 1; j < options.length && results.length < cap; j++) {
        const a = options[i];
        const b = options[j];
        const sa = scoreByOption.get(a.id);
        const sb = scoreByOption.get(b.id);
        if (!sa || !sb) continue;
        for (const [d1, d2] of TRADEOFF_PAIRS) {
          const dA = dimWeighted(sa, d1) - dimWeighted(sb, d1);
          const dB = dimWeighted(sa, d2) - dimWeighted(sb, d2);
          // Opposition: A wins on d1, B wins on d2 (or vice-versa).
          if (dA > threshold && dB < -threshold) {
            results.push(createTradeoff({
              leftOptionId: a.id,
              rightOptionId: b.id,
              dimension: d1,
              opposingDimension: d2,
              delta: dA,
              summary: `${a.title} offers better ${READABLE[d1]} but ${b.title} offers better ${READABLE[d2]}`,
            }));
          } else if (dA < -threshold && dB > threshold) {
            results.push(createTradeoff({
              leftOptionId: b.id,
              rightOptionId: a.id,
              dimension: d1,
              opposingDimension: d2,
              delta: -dA,
              summary: `${b.title} offers better ${READABLE[d1]} but ${a.title} offers better ${READABLE[d2]}`,
            }));
          }
          if (results.length >= cap) break;
        }
      }
    }
    return Object.freeze(results);
  }
}
