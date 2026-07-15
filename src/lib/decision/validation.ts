/**
 * Decision validation — pure predicate helpers used by manager & runtime.
 */

import { DecisionValidationError } from "./errors";
import type { Decision, DecisionOption, ScoreWeights } from "./types";
import { SCORE_DIMENSIONS } from "./types";

export function validateWeights(w: ScoreWeights): void {
  for (const d of SCORE_DIMENSIONS) {
    const v = w[d];
    if (typeof v !== "number" || Number.isNaN(v) || v < 0 || v > 1) {
      throw new DecisionValidationError(`weight ${d} out of range`, { dimension: d, value: v });
    }
  }
}

export function validateOption(o: DecisionOption): void {
  if (!o.id) throw new DecisionValidationError("option missing id");
  if (!o.title) throw new DecisionValidationError("option missing title");
  for (const d of SCORE_DIMENSIONS) {
    const v = o.features[d];
    if (typeof v !== "number" || Number.isNaN(v) || v < 0 || v > 1) {
      throw new DecisionValidationError(`option feature ${d} out of range`, {
        optionId: o.id, dimension: d, value: v,
      });
    }
  }
}

export function validateDecision(d: Decision): void {
  if (!d.id) throw new DecisionValidationError("decision missing id");
  if (!d.ownerId) throw new DecisionValidationError("decision missing ownerId");
  if (!d.namespace) throw new DecisionValidationError("decision missing namespace");
  validateWeights(d.context.weights);
  const seen = new Set<string>();
  for (const o of d.options) {
    if (seen.has(o.id)) throw new DecisionValidationError("duplicate option id", { id: o.id });
    seen.add(o.id);
    validateOption(o);
  }
}
