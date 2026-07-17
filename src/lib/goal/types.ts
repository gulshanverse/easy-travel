/**
 * Goal Engine — immutable domain model.
 */
export type GoalState =
  | "created" | "analysing" | "planning" | "active"
  | "tracking" | "blocked" | "replanning"
  | "completed" | "cancelled" | "archived";

export type GoalCategory =
  | "trip" | "booking" | "budget" | "experience"
  | "logistics" | "wellbeing" | "learning" | "other";

export type GoalScope = "single" | "multi-leg" | "recurring" | "portfolio";
export type GoalComplexity = "trivial" | "simple" | "moderate" | "complex" | "epic";
export type GoalDurationBand = "instant" | "short" | "medium" | "long" | "openended";
export type GoalPriority = "low" | "normal" | "high" | "critical";
export type MilestoneStatus = "pending" | "active" | "done" | "skipped" | "blocked";
export type StepKind = "task" | "decision" | "review" | "validation" | "wait";

export interface GoalIntent {
  readonly id: string;
  readonly summary: string;
  readonly keywords: readonly string[];
  readonly signals: Readonly<Record<string, number>>;
  readonly capturedAt: number;
}

export interface GoalConstraint {
  readonly kind: string;
  readonly value: unknown;
  readonly hard: boolean;
}

export interface GoalDependency {
  readonly goalId: string;
  readonly kind: "requires" | "blocks" | "related";
}

export interface GoalCheckpoint {
  readonly id: string;
  readonly at: number;
  readonly note: string;
  readonly state: GoalState;
}

export interface GoalStep {
  readonly id: string;
  readonly kind: StepKind;
  readonly summary: string;
  readonly milestoneId: string;
  readonly order: number;
  readonly dependsOn: readonly string[];
  readonly estimateMs?: number;
  readonly gate?: "decision" | "risk" | "validation";
}

export interface GoalMilestone {
  readonly id: string;
  readonly title: string;
  readonly order: number;
  readonly status: MilestoneStatus;
  readonly dependsOn: readonly string[];
  readonly targetAt?: number;
  readonly completedAt?: number;
  readonly steps: readonly GoalStep[];
}

export interface GoalTimeline {
  readonly startAt?: number;
  readonly targetAt?: number;
  readonly windows: readonly { readonly from: number; readonly to: number; readonly label?: string }[];
}

export interface GoalBudgetTarget {
  readonly amountMinor: number;
  readonly currency: string;
  readonly hard: boolean;
}

export interface GoalPlan {
  readonly id: string;
  readonly goalId: string;
  readonly version: number;
  readonly milestones: readonly GoalMilestone[];
  readonly timeline: GoalTimeline;
  readonly budget?: GoalBudgetTarget;
  readonly rationale: readonly string[];
  readonly createdAt: number;
}

export interface GoalProgress {
  readonly id: string;
  readonly goalId: string;
  readonly percent: number;
  readonly milestonesDone: number;
  readonly milestonesTotal: number;
  readonly stepsDone: number;
  readonly stepsTotal: number;
  readonly budgetPercent?: number;
  readonly timelinePercent?: number;
  readonly confidence: number;
  readonly risk: number;
  readonly computedAt: number;
}

export interface GoalReview {
  readonly id: string;
  readonly at: number;
  readonly summary: string;
  readonly decisions: readonly string[];
  readonly changes: readonly string[];
}

export interface GoalConfidence {
  readonly value: number;
  readonly sampleSize: number;
  readonly reasons: readonly string[];
}

export interface GoalEvidence {
  readonly subject: string;
  readonly refs: readonly { readonly kind: string; readonly summary: string; readonly weight: number }[];
}

export interface GoalOutcome {
  readonly summary: string;
  readonly achieved: boolean;
  readonly measuredAt: number;
  readonly metrics: Readonly<Record<string, number>>;
}

export interface GoalMetadata {
  readonly tags: readonly string[];
  readonly attributes: Readonly<Record<string, unknown>>;
}

export interface Goal {
  readonly id: string;
  readonly ownerId: string;
  readonly title: string;
  readonly description: string;
  readonly category: GoalCategory;
  readonly scope: GoalScope;
  readonly complexity: GoalComplexity;
  readonly duration: GoalDurationBand;
  readonly priority: GoalPriority;
  readonly state: GoalState;
  readonly intent: GoalIntent;
  readonly constraints: readonly GoalConstraint[];
  readonly dependencies: readonly GoalDependency[];
  readonly timeline: GoalTimeline;
  readonly budget?: GoalBudgetTarget;
  readonly metadata: GoalMetadata;
  readonly version: number;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface GoalHistoryEntry {
  readonly id: string;
  readonly goalId: string;
  readonly at: number;
  readonly state: GoalState;
  readonly note?: string;
}

export interface GoalSnapshot {
  readonly id: string;
  readonly at: number;
  readonly goalIds: readonly string[];
  readonly planIds: readonly string[];
}

export interface GoalUnderstanding {
  readonly goalId: string;
  readonly category: GoalCategory;
  readonly scope: GoalScope;
  readonly complexity: GoalComplexity;
  readonly duration: GoalDurationBand;
  readonly confidence: GoalConfidence;
  readonly dependencies: readonly GoalDependency[];
  readonly constraints: readonly GoalConstraint[];
  readonly relationships: readonly string[];
}

export interface GoalConflict {
  readonly id: string;
  readonly kind: "priority" | "dependency" | "constraint" | "timeline";
  readonly goalIds: readonly string[];
  readonly summary: string;
  readonly at: number;
}
