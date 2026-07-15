/**
 * Decision factories — deterministic constructors for immutable entities.
 * No IO, no side effects.
 */

import {
  newConstraintId, newContextId, newEvidenceId, newExplanationId, newOptionId,
  newOutcomeId, newScoreId, newSnapshotId, newTradeoffId,
} from "./ids";
import type {
  Decision, DecisionConstraint, DecisionConstraintKind, DecisionConstraintSeverity,
  DecisionContext, DecisionEvidence, DecisionExplanation, DecisionOption,
  DecisionOptionKind, DecisionOutcome, DecisionScore, DecisionSnapshot,
  DecisionTradeoff, DimensionScore, EvidenceSource, RankedOption, ScoreDimension,
  ScoreWeights,
} from "./types";
import { SCORE_DIMENSIONS } from "./types";

const nowIso = () => new Date().toISOString();

export function freezeFeatures(input?: Partial<Record<ScoreDimension, number>>): Readonly<Record<ScoreDimension, number>> {
  const out: Record<string, number> = {};
  for (const d of SCORE_DIMENSIONS) {
    const v = input?.[d];
    out[d] = typeof v === "number" && !Number.isNaN(v) ? Math.max(0, Math.min(1, v)) : 0.5;
  }
  return Object.freeze(out as Record<ScoreDimension, number>);
}

export function createOption(input: {
  kind?: DecisionOptionKind;
  title: string;
  summary?: string;
  attributes?: Record<string, unknown>;
  features?: Partial<Record<ScoreDimension, number>>;
  tags?: readonly string[];
}): DecisionOption {
  return Object.freeze({
    id: newOptionId(),
    kind: input.kind ?? "generic",
    title: input.title,
    summary: input.summary,
    attributes: Object.freeze({ ...(input.attributes ?? {}) }),
    features: freezeFeatures(input.features),
    tags: Object.freeze([...(input.tags ?? [])]),
    createdAt: nowIso(),
  });
}

export function createConstraint(input: {
  kind: DecisionConstraintKind;
  severity: DecisionConstraintSeverity;
  description: string;
  rank?: number;
  params?: Record<string, unknown>;
  predicate?: (o: DecisionOption) => boolean;
}): DecisionConstraint {
  return Object.freeze({
    id: newConstraintId(),
    kind: input.kind,
    severity: input.severity,
    description: input.description,
    rank: input.rank ?? 0,
    params: Object.freeze({ ...(input.params ?? {}) }),
    predicate: input.predicate,
  });
}

export function createDimensionScore(input: {
  dimension: ScoreDimension;
  raw: number;
  weight: number;
  rationale?: string;
}): DimensionScore {
  const raw = Math.max(0, Math.min(1, input.raw));
  const weight = Math.max(0, Math.min(1, input.weight));
  return Object.freeze({
    dimension: input.dimension,
    raw, weight,
    weighted: raw * weight,
    rationale: input.rationale,
  });
}

export function createScore(input: {
  optionId: string;
  dimensions: readonly DimensionScore[];
  confidence?: number;
}): DecisionScore {
  const overall = input.dimensions.reduce((s, d) => s + d.weighted, 0);
  return Object.freeze({
    id: newScoreId(),
    optionId: input.optionId,
    overall: Math.max(0, Math.min(1, overall)),
    confidence: Math.max(0, Math.min(1, input.confidence ?? 0.7)),
    dimensions: Object.freeze([...input.dimensions]),
    computedAt: nowIso(),
  });
}

export function createTradeoff(input: {
  leftOptionId: string;
  rightOptionId: string;
  dimension: ScoreDimension;
  opposingDimension: ScoreDimension;
  delta: number;
  summary: string;
}): DecisionTradeoff {
  const abs = Math.abs(input.delta);
  const severity = abs < 0.05 ? "minor" : abs < 0.15 ? "moderate" : "significant";
  return Object.freeze({
    id: newTradeoffId(),
    leftOptionId: input.leftOptionId,
    rightOptionId: input.rightOptionId,
    dimension: input.dimension,
    opposingDimension: input.opposingDimension,
    delta: input.delta,
    summary: input.summary,
    severity,
  });
}

export function createEvidence(input: {
  source: EvidenceSource;
  summary: string;
  weight?: number;
  ref?: string;
  metadata?: Record<string, unknown>;
}): DecisionEvidence {
  return Object.freeze({
    id: newEvidenceId(),
    source: input.source,
    ref: input.ref,
    summary: input.summary,
    weight: Math.max(0, Math.min(1, input.weight ?? 0.5)),
    capturedAt: nowIso(),
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
  });
}

export function createExplanation(input: {
  decisionId: string;
  summary: string;
  rationale: readonly string[];
  whyTop: readonly string[];
  whyAlternativesLower: readonly string[];
  constraintsImpact: readonly string[];
  evidence: readonly DecisionEvidence[];
  confidence: number;
}): DecisionExplanation {
  return Object.freeze({
    id: newExplanationId(),
    decisionId: input.decisionId,
    summary: input.summary,
    rationale: Object.freeze([...input.rationale]),
    whyTop: Object.freeze([...input.whyTop]),
    whyAlternativesLower: Object.freeze([...input.whyAlternativesLower]),
    constraintsImpact: Object.freeze([...input.constraintsImpact]),
    evidence: Object.freeze([...input.evidence]),
    confidence: Math.max(0, Math.min(1, input.confidence)),
    generatedAt: nowIso(),
  });
}

export function createOutcome(input: {
  decisionId: string;
  selectedOptionId: string;
  approved: boolean;
  note?: string;
}): DecisionOutcome {
  return Object.freeze({
    id: newOutcomeId(),
    decisionId: input.decisionId,
    selectedOptionId: input.selectedOptionId,
    approved: input.approved,
    note: input.note,
    at: nowIso(),
  });
}

export function createContext(input: {
  ownerId: string;
  namespace: string;
  correlationId: string;
  weights: ScoreWeights;
  journeyId?: string;
  constraints?: readonly DecisionConstraint[];
  preferences?: Record<string, number>;
  memoryRefs?: readonly string[];
  graphSeedNodeIds?: readonly string[];
  metadata?: Record<string, unknown>;
}): DecisionContext {
  return Object.freeze({
    id: newContextId(),
    ownerId: input.ownerId,
    namespace: input.namespace,
    correlationId: input.correlationId,
    builtAt: nowIso(),
    journeyId: input.journeyId,
    weights: input.weights,
    constraints: Object.freeze([...(input.constraints ?? [])]),
    preferences: Object.freeze({ ...(input.preferences ?? {}) }),
    memoryRefs: Object.freeze([...(input.memoryRefs ?? [])]),
    graphSeedNodeIds: Object.freeze([...(input.graphSeedNodeIds ?? [])]),
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
  });
}

export function createSnapshot(input: {
  decision: Decision;
  reason: string;
}): DecisionSnapshot {
  return Object.freeze({
    id: newSnapshotId(),
    decisionId: input.decision.id,
    version: input.decision.version,
    capturedAt: nowIso(),
    reason: input.reason,
    decision: input.decision,
  });
}

export function freezeRanked(items: readonly RankedOption[]): readonly RankedOption[] {
  return Object.freeze(items.map((r) => Object.freeze({ ...r })));
}
