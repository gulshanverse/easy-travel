/**
 * Decision Runtime — Configuration & Policies.
 * Immutable, environment-independent. Composition root wires env values.
 */

import { DecisionConfigurationError } from "./errors";
import type { ScoreWeights } from "./types";
import { SCORE_DIMENSIONS } from "./types";

export interface DecisionPolicies {
  readonly maxDecisionsPerProcess: number;
  readonly maxOptionsPerDecision: number;
  readonly maxConstraintsPerDecision: number;
  readonly maxSnapshotsPerDecision: number;
  readonly maxTradeoffsPerDecision: number;
  readonly maxEvidencePerExplanation: number;
  readonly strictValidation: boolean;
  readonly requireOwnership: boolean;
  readonly allowDynamicCreation: boolean;
  readonly minScoreConfidence: number; // 0..1
}

export const DEFAULT_DECISION_POLICIES: DecisionPolicies = Object.freeze({
  maxDecisionsPerProcess: 1024,
  maxOptionsPerDecision: 128,
  maxConstraintsPerDecision: 64,
  maxSnapshotsPerDecision: 64,
  maxTradeoffsPerDecision: 128,
  maxEvidencePerExplanation: 64,
  strictValidation: true,
  requireOwnership: true,
  allowDynamicCreation: true,
  minScoreConfidence: 0,
});

export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = Object.freeze({
  budget: 0.2,
  time: 0.15,
  comfort: 0.1,
  risk: 0.1,
  preference: 0.15,
  journeyFit: 0.1,
  seasonality: 0.05,
  sustainability: 0.05,
  flexibility: 0.05,
  complexity: 0.05,
});

export function normalizeWeights(w: Partial<ScoreWeights>): ScoreWeights {
  const merged: Record<string, number> = { ...DEFAULT_SCORE_WEIGHTS };
  for (const d of SCORE_DIMENSIONS) {
    const v = w[d];
    if (v !== undefined) {
      if (typeof v !== "number" || v < 0 || v > 1 || Number.isNaN(v)) {
        throw new DecisionConfigurationError(`weight ${d} must be in [0,1]`, { d, v });
      }
      merged[d] = v;
    }
  }
  const total = SCORE_DIMENSIONS.reduce((s, d) => s + (merged[d] ?? 0), 0);
  if (total <= 0) throw new DecisionConfigurationError("weights sum must be > 0");
  const scaled: Record<string, number> = {};
  for (const d of SCORE_DIMENSIONS) scaled[d] = (merged[d] ?? 0) / total;
  return Object.freeze(scaled as ScoreWeights);
}

export interface DecisionBudget {
  readonly maxOptionsPerGeneration: number;
  readonly maxRankingCandidates: number;
  readonly assemblyTimeoutMs: number;
}

export const DEFAULT_DECISION_BUDGET: DecisionBudget = Object.freeze({
  maxOptionsPerGeneration: 64,
  maxRankingCandidates: 128,
  assemblyTimeoutMs: 2_000,
});

export interface DecisionConfiguration {
  readonly namespace: string;
  readonly policies: DecisionPolicies;
  readonly weights: ScoreWeights;
  readonly budget: DecisionBudget;
  readonly telemetry: { readonly enabled: boolean; readonly sampleRate: number };
}

export function defineDecisionConfig(
  partial: Partial<DecisionConfiguration> & { namespace: string },
): DecisionConfiguration {
  if (!partial.namespace || !/^[a-z0-9][a-z0-9._-]{1,63}$/i.test(partial.namespace)) {
    throw new DecisionConfigurationError("namespace must be 2-64 chars [a-z0-9._-]", {
      namespace: partial.namespace,
    });
  }
  const cfg: DecisionConfiguration = {
    namespace: partial.namespace,
    policies: { ...DEFAULT_DECISION_POLICIES, ...partial.policies },
    weights: normalizeWeights(partial.weights ?? {}),
    budget: { ...DEFAULT_DECISION_BUDGET, ...partial.budget },
    telemetry: {
      enabled: partial.telemetry?.enabled ?? true,
      sampleRate: partial.telemetry?.sampleRate ?? 1,
    },
  };
  if (cfg.telemetry.sampleRate < 0 || cfg.telemetry.sampleRate > 1) {
    throw new DecisionConfigurationError("telemetry.sampleRate must be in [0,1]");
  }
  if (cfg.policies.maxDecisionsPerProcess <= 0) {
    throw new DecisionConfigurationError("maxDecisionsPerProcess must be > 0");
  }
  return Object.freeze(cfg);
}
