/**
 * Explanation Engine — deterministic, template-driven.
 * NO LLM output. Explains ranking, constraints, evidence and confidence.
 */

import type { ConstraintEvaluation } from "./constraints";
import { createEvidence, createExplanation } from "./factories";
import type {
  Decision, DecisionEvidence, DecisionExplanation, DecisionOption, DecisionTradeoff,
  DimensionScore, RankedOption,
} from "./types";

export interface ExplanationInput {
  readonly decision: Decision;
  readonly evaluations?: readonly ConstraintEvaluation[];
  readonly extraEvidence?: readonly DecisionEvidence[];
  readonly maxAlternatives?: number;
}

export class ExplanationEngine {
  explain(input: ExplanationInput): DecisionExplanation {
    const d = input.decision;
    const ranked = d.ranked;
    const top = ranked[0];
    const optById = new Map<string, DecisionOption>();
    for (const o of d.options) optById.set(o.id, o);
    const evalById = new Map<string, ConstraintEvaluation>();
    for (const e of input.evaluations ?? []) evalById.set(e.optionId, e);

    const summary = top
      ? `Selected "${optById.get(top.optionId)?.title ?? top.optionId}" (score ${top.score.overall.toFixed(2)}, confidence ${top.score.confidence.toFixed(2)})`
      : "No candidate options were rankable";

    const whyTop = top ? this.whyRanked(top, optById) : [];
    const maxAlt = input.maxAlternatives ?? 3;
    const whyAlternativesLower: string[] = [];
    for (let i = 1; i < Math.min(ranked.length, maxAlt + 1); i++) {
      const r = ranked[i];
      const winner = ranked[0];
      const opt = optById.get(r.optionId);
      const winOpt = optById.get(winner.optionId);
      if (!opt || !winOpt) continue;
      const delta = winner.score.overall - r.score.overall;
      whyAlternativesLower.push(
        `"${opt.title}" ranked #${r.rank} — trailed "${winOpt.title}" by ${delta.toFixed(2)} overall`,
      );
    }

    const constraintsImpact: string[] = [];
    for (const r of ranked) {
      const ev = evalById.get(r.optionId);
      if (!ev) continue;
      if (ev.violated.length > 0) {
        constraintsImpact.push(
          `"${optById.get(r.optionId)?.title ?? r.optionId}" violated ${ev.violated.length} hard constraint(s)`,
        );
      }
      if (ev.softViolations.length > 0) {
        constraintsImpact.push(
          `"${optById.get(r.optionId)?.title ?? r.optionId}" softly violated ${ev.softViolations.length} constraint(s)`,
        );
      }
    }

    const rationale: string[] = [];
    for (const t of d.tradeoffs.slice(0, 5)) {
      rationale.push(`Tradeoff (${t.severity}): ${t.summary}`);
    }
    if (top) {
      const strongest = this.strongestDim(top);
      if (strongest) {
        rationale.push(`Dominant advantage: ${strongest.dimension} (${strongest.weighted.toFixed(2)})`);
      }
    }

    const evidence: DecisionEvidence[] = [];
    for (const c of d.context.constraints) {
      evidence.push(createEvidence({
        source: "constraint",
        ref: c.id,
        summary: `${c.severity} ${c.kind}: ${c.description}`,
        weight: c.severity === "hard" ? 0.9 : c.severity === "soft" ? 0.6 : 0.3,
      }));
    }
    for (const [k, w] of Object.entries(d.context.preferences)) {
      evidence.push(createEvidence({
        source: "preference",
        ref: k,
        summary: `preference "${k}" weight ${w}`,
        weight: Math.max(0, Math.min(1, w)),
      }));
    }
    for (const t of d.tradeoffs) {
      evidence.push(createEvidence({ source: "computed", ref: t.id, summary: t.summary, weight: 0.5 }));
    }
    if (input.extraEvidence) evidence.push(...input.extraEvidence);

    const confidence = top ? top.score.confidence : 0.5;

    return createExplanation({
      decisionId: d.id,
      summary,
      rationale,
      whyTop,
      whyAlternativesLower,
      constraintsImpact,
      evidence,
      confidence,
    });
  }

  private whyRanked(r: RankedOption, opts: Map<string, DecisionOption>): string[] {
    const opt = opts.get(r.optionId);
    const strongest = this.topDimensions(r, 3);
    const parts: string[] = [];
    if (opt) parts.push(`"${opt.title}" ranked #${r.rank} overall`);
    for (const d of strongest) {
      parts.push(`Strong ${d.dimension} (${d.raw.toFixed(2)} × w${d.weight.toFixed(2)} = ${d.weighted.toFixed(2)})`);
    }
    if (r.violatedConstraintIds.length === 0) {
      parts.push("Satisfied all hard constraints");
    }
    return parts;
  }

  private topDimensions(r: RankedOption, n: number): DimensionScore[] {
    return [...r.score.dimensions].sort((a, b) => b.weighted - a.weighted).slice(0, n);
  }

  private strongestDim(r: RankedOption): DimensionScore | undefined {
    return this.topDimensions(r, 1)[0];
  }
}

export function summariseTradeoffs(tradeoffs: readonly DecisionTradeoff[]): string {
  if (!tradeoffs.length) return "no significant trade-offs";
  const sig = tradeoffs.filter((t) => t.severity === "significant").length;
  return `${tradeoffs.length} trade-off(s), ${sig} significant`;
}
