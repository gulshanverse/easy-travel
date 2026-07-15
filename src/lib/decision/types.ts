/**
 * Decision Engine — Domain model.
 * Immutable value types describing a travel decision, its candidates,
 * scoring, trade-offs, evidence, and explanations.
 * Provider-agnostic. Persistence-agnostic.
 */

// ---------- Lifecycle ----------
export const DECISION_STATES = [
  "created",
  "collecting_context",
  "generating_options",
  "evaluating",
  "constraining",
  "ranking",
  "explaining",
  "validating",
  "approved",
  "archived",
  "failed",
] as const;
export type DecisionState = (typeof DECISION_STATES)[number];

// ---------- Scoring dimensions ----------
export const SCORE_DIMENSIONS = [
  "budget",
  "time",
  "comfort",
  "risk",
  "preference",
  "journeyFit",
  "seasonality",
  "sustainability",
  "flexibility",
  "complexity",
] as const;
export type ScoreDimension = (typeof SCORE_DIMENSIONS)[number];

export type ScoreWeights = Readonly<Record<ScoreDimension, number>>;

export interface DimensionScore {
  readonly dimension: ScoreDimension;
  readonly raw: number;      // 0..1 (higher = better)
  readonly weight: number;   // 0..1
  readonly weighted: number; // raw * weight
  readonly rationale?: string;
}

export interface DecisionScore {
  readonly id: string;
  readonly optionId: string;
  readonly overall: number;   // 0..1
  readonly confidence: number; // 0..1
  readonly dimensions: readonly DimensionScore[];
  readonly computedAt: string;
}

// ---------- Options ----------
export type DecisionOptionKind =
  | "destination"
  | "route"
  | "accommodation"
  | "activity"
  | "transport"
  | "itinerary"
  | "generic";

export interface DecisionOption {
  readonly id: string;
  readonly kind: DecisionOptionKind;
  readonly title: string;
  readonly summary?: string;
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly features: Readonly<Record<ScoreDimension, number>>; // 0..1 features per dimension
  readonly tags: readonly string[];
  readonly createdAt: string;
}

// ---------- Constraints ----------
export type DecisionConstraintKind =
  | "budget"
  | "timeline"
  | "visa"
  | "accessibility"
  | "weather"
  | "safety"
  | "group"
  | "policy"
  | "window";

export type DecisionConstraintSeverity = "hard" | "soft" | "advisory";

export interface DecisionConstraint {
  readonly id: string;
  readonly kind: DecisionConstraintKind;
  readonly severity: DecisionConstraintSeverity;
  readonly description: string;
  readonly rank: number;
  readonly params: Readonly<Record<string, unknown>>;
  /** Deterministic predicate: true means option satisfies the constraint. */
  readonly predicate?: (o: DecisionOption) => boolean;
}

// ---------- Trade-offs ----------
export interface DecisionTradeoff {
  readonly id: string;
  readonly leftOptionId: string;
  readonly rightOptionId: string;
  readonly dimension: ScoreDimension;
  readonly opposingDimension: ScoreDimension;
  readonly delta: number;         // left - right (weighted)
  readonly summary: string;
  readonly severity: "minor" | "moderate" | "significant";
}

// ---------- Evidence ----------
export type EvidenceSource =
  | "journey"
  | "memory"
  | "graph"
  | "constraint"
  | "preference"
  | "historical"
  | "policy"
  | "computed";

export interface DecisionEvidence {
  readonly id: string;
  readonly source: EvidenceSource;
  readonly ref?: string; // opaque id from the source
  readonly summary: string;
  readonly weight: number;      // 0..1
  readonly capturedAt: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

// ---------- Explanation ----------
export interface DecisionExplanation {
  readonly id: string;
  readonly decisionId: string;
  readonly summary: string;
  readonly rationale: readonly string[];
  readonly whyTop: readonly string[];
  readonly whyAlternativesLower: readonly string[];
  readonly constraintsImpact: readonly string[];
  readonly evidence: readonly DecisionEvidence[];
  readonly confidence: number;
  readonly generatedAt: string;
}

// ---------- Outcome ----------
export interface DecisionOutcome {
  readonly id: string;
  readonly decisionId: string;
  readonly selectedOptionId: string;
  readonly approved: boolean;
  readonly note?: string;
  readonly at: string;
}

// ---------- Context ----------
export interface DecisionContext {
  readonly id: string;
  readonly ownerId: string;
  readonly namespace: string;
  readonly correlationId: string;
  readonly builtAt: string;
  readonly journeyId?: string;
  readonly weights: ScoreWeights;
  readonly constraints: readonly DecisionConstraint[];
  readonly preferences: Readonly<Record<string, number>>; // key → weight (0..1)
  readonly memoryRefs: readonly string[];
  readonly graphSeedNodeIds: readonly string[];
  readonly metadata: Readonly<Record<string, unknown>>;
}

// ---------- Ranked results ----------
export interface RankedOption {
  readonly optionId: string;
  readonly rank: number;
  readonly score: DecisionScore;
  readonly satisfiesHardConstraints: boolean;
  readonly violatedConstraintIds: readonly string[];
}

// ---------- Decision aggregate ----------
export interface DecisionMetadata {
  readonly tags: readonly string[];
  readonly attributes: Readonly<Record<string, unknown>>;
}

export interface Decision {
  readonly id: string;
  readonly ownerId: string;
  readonly namespace: string;
  readonly title: string;
  readonly summary?: string;
  readonly state: DecisionState;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly journeyId?: string;
  readonly context: DecisionContext;
  readonly options: readonly DecisionOption[];
  readonly scores: readonly DecisionScore[];
  readonly ranked: readonly RankedOption[];
  readonly tradeoffs: readonly DecisionTradeoff[];
  readonly explanation?: DecisionExplanation;
  readonly outcome?: DecisionOutcome;
  readonly metadata: DecisionMetadata;
}

export interface DecisionSnapshot {
  readonly id: string;
  readonly decisionId: string;
  readonly version: number;
  readonly capturedAt: string;
  readonly reason: string;
  readonly decision: Decision;
}
