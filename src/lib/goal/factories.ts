/**
 * Goal Engine — pure factory helpers. All entities are frozen.
 */
import { newGoalId, newIntentId, newMilestoneId, newPlanId, newSnapshotId, newStepId } from "./ids";
import type {
  Goal, GoalBudgetTarget, GoalCategory, GoalComplexity, GoalConstraint, GoalDependency,
  GoalDurationBand, GoalIntent, GoalMetadata, GoalMilestone, GoalPlan, GoalPriority,
  GoalScope, GoalSnapshot, GoalState, GoalStep, GoalTimeline, StepKind,
} from "./types";

export function makeIntent(input: { summary: string; keywords?: readonly string[]; signals?: Record<string, number>; at?: number }): GoalIntent {
  return Object.freeze({
    id: newIntentId(),
    summary: input.summary,
    keywords: Object.freeze([...(input.keywords ?? [])]),
    signals: Object.freeze({ ...(input.signals ?? {}) }),
    capturedAt: input.at ?? Date.now(),
  });
}

export function makeMetadata(input: Partial<GoalMetadata> = {}): GoalMetadata {
  return Object.freeze({
    tags: Object.freeze([...(input.tags ?? [])]),
    attributes: Object.freeze({ ...(input.attributes ?? {}) }),
  });
}

export function makeTimeline(input: Partial<GoalTimeline> = {}): GoalTimeline {
  return Object.freeze({
    startAt: input.startAt,
    targetAt: input.targetAt,
    windows: Object.freeze([...(input.windows ?? [])]),
  });
}

export interface MakeGoalInput {
  ownerId: string;
  title: string;
  description?: string;
  category?: GoalCategory;
  scope?: GoalScope;
  complexity?: GoalComplexity;
  duration?: GoalDurationBand;
  priority?: GoalPriority;
  state?: GoalState;
  intent?: GoalIntent;
  constraints?: readonly GoalConstraint[];
  dependencies?: readonly GoalDependency[];
  timeline?: Partial<GoalTimeline>;
  budget?: GoalBudgetTarget;
  metadata?: Partial<GoalMetadata>;
  now?: number;
  id?: string;
}

export function makeGoal(input: MakeGoalInput): Goal {
  const now = input.now ?? Date.now();
  return Object.freeze({
    id: input.id ?? newGoalId(),
    ownerId: input.ownerId,
    title: input.title,
    description: input.description ?? "",
    category: input.category ?? "trip",
    scope: input.scope ?? "single",
    complexity: input.complexity ?? "moderate",
    duration: input.duration ?? "medium",
    priority: input.priority ?? "normal",
    state: input.state ?? "created",
    intent: input.intent ?? makeIntent({ summary: input.title, at: now }),
    constraints: Object.freeze([...(input.constraints ?? [])]),
    dependencies: Object.freeze([...(input.dependencies ?? [])]),
    timeline: makeTimeline(input.timeline),
    budget: input.budget ? Object.freeze({ ...input.budget }) : undefined,
    metadata: makeMetadata(input.metadata),
    version: 1,
    createdAt: now,
    updatedAt: now,
  });
}

export function withGoalPatch(prev: Goal, patch: Partial<Goal>, now: number): Goal {
  return Object.freeze({
    ...prev,
    ...patch,
    id: prev.id,
    ownerId: prev.ownerId,
    createdAt: prev.createdAt,
    version: prev.version + 1,
    updatedAt: now,
  });
}

export interface MakeStepInput {
  kind?: StepKind;
  summary: string;
  milestoneId: string;
  order: number;
  dependsOn?: readonly string[];
  estimateMs?: number;
  gate?: "decision" | "risk" | "validation";
}
export function makeStep(input: MakeStepInput): GoalStep {
  return Object.freeze({
    id: newStepId(),
    kind: input.kind ?? "task",
    summary: input.summary,
    milestoneId: input.milestoneId,
    order: input.order,
    dependsOn: Object.freeze([...(input.dependsOn ?? [])]),
    estimateMs: input.estimateMs,
    gate: input.gate,
  });
}

export interface MakeMilestoneInput {
  title: string;
  order: number;
  dependsOn?: readonly string[];
  targetAt?: number;
  steps?: readonly GoalStep[];
  id?: string;
}
export function makeMilestone(input: MakeMilestoneInput): GoalMilestone {
  return Object.freeze({
    id: input.id ?? newMilestoneId(),
    title: input.title,
    order: input.order,
    status: "pending",
    dependsOn: Object.freeze([...(input.dependsOn ?? [])]),
    targetAt: input.targetAt,
    completedAt: undefined,
    steps: Object.freeze([...(input.steps ?? [])]),
  });
}

export function makePlan(input: {
  goalId: string;
  milestones: readonly GoalMilestone[];
  timeline?: Partial<GoalTimeline>;
  budget?: GoalBudgetTarget;
  rationale?: readonly string[];
  version?: number;
  now?: number;
}): GoalPlan {
  return Object.freeze({
    id: newPlanId(),
    goalId: input.goalId,
    version: input.version ?? 1,
    milestones: Object.freeze([...input.milestones]),
    timeline: makeTimeline(input.timeline),
    budget: input.budget ? Object.freeze({ ...input.budget }) : undefined,
    rationale: Object.freeze([...(input.rationale ?? [])]),
    createdAt: input.now ?? Date.now(),
  });
}

export function makeSnapshot(goalIds: readonly string[], planIds: readonly string[], now = Date.now()): GoalSnapshot {
  return Object.freeze({
    id: newSnapshotId(),
    at: now,
    goalIds: Object.freeze([...goalIds]),
    planIds: Object.freeze([...planIds]),
  });
}
