/**
 * Goal Engine — GoalManager.
 * Orchestrates goal lifecycle, planning, milestones, progress, adaptation.
 */
import { adaptivePlan, shouldReplan, type AdaptiveTrigger } from "./adaptive";
import type { GoalConfig } from "./config";
import { UnknownGoalError } from "./errors";
import { GoalEventBus } from "./events";
import { makeGoal, makeSnapshot, withGoalPatch, type MakeGoalInput } from "./factories";
import { newHistoryId } from "./ids";
import { assertTransition, canTransition } from "./lifecycle";
import { GoalMetrics } from "./metrics";
import { nextActionable, orderMilestones, setMilestoneStatus } from "./milestones";
import { generatePlan } from "./planning";
import { DEFAULT_GOAL_POLICIES, type GoalPolicy } from "./policies";
import { computeProgress, type ProgressInputs } from "./progress";
import { detectConflicts, mergeGoals, orderByPriority, splitGoal } from "./reasoning";
import { GoalStore, HistoryStore, PlanStore } from "./registry";
import type { GoalTelemetrySink } from "./telemetry";
import type {
  Goal, GoalConflict, GoalMilestone, GoalPlan, GoalProgress, GoalSnapshot,
  GoalState, MilestoneStatus,
} from "./types";
import { understandGoal } from "./understanding";
import { validateGoal, validatePlan } from "./validation";

export interface GoalManagerDeps {
  readonly config: GoalConfig;
  readonly telemetry: GoalTelemetrySink;
  readonly events: GoalEventBus;
  readonly metrics: GoalMetrics;
  readonly now: () => number;
}

export class GoalManager {
  readonly goals = new GoalStore();
  readonly plans = new PlanStore();
  readonly history = new HistoryStore();
  private readonly policies = new Map<string, GoalPolicy>();

  constructor(private readonly deps: GoalManagerDeps) {
    for (const p of DEFAULT_GOAL_POLICIES) this.policies.set(p.id, p);
  }

  /* ---------- CRUD ---------- */
  createGoal(input: MakeGoalInput): Goal {
    const goal = makeGoal({ ...input, now: input.now ?? this.deps.now() });
    validateGoal(goal, this.deps.config);
    this.goals.put(goal);
    this.deps.metrics.inc("goal.created");
    this.deps.events.emit({ name: "GoalCreated", at: this.deps.now(), goalId: goal.id, data: { ownerId: goal.ownerId } });
    this.recordHistory(goal, "created");
    return goal;
  }

  updateGoal(id: string, patch: Partial<Goal>): Goal {
    const prev = this.goals.require(id);
    const next = withGoalPatch(prev, patch, this.deps.now());
    validateGoal(next, this.deps.config);
    this.goals.put(next);
    this.deps.metrics.inc("goal.updated");
    this.deps.events.emit({ name: "GoalUpdated", at: this.deps.now(), goalId: id, data: { version: next.version } });
    return next;
  }

  deleteGoal(id: string): void {
    if (!this.goals.get(id)) throw new UnknownGoalError(id);
    this.goals.remove(id);
    this.deps.metrics.inc("goal.deleted");
    this.deps.events.emit({ name: "GoalDeleted", at: this.deps.now(), goalId: id, data: {} });
  }

  /* ---------- Lifecycle ---------- */
  transition(id: string, to: GoalState, note?: string): Goal {
    const prev = this.goals.require(id);
    assertTransition(prev.state, to, id);
    const next = withGoalPatch(prev, { state: to }, this.deps.now());
    this.goals.put(next);
    this.deps.metrics.inc(`goal.state.${to}`);
    this.deps.events.emit({ name: "GoalTransitioned", at: this.deps.now(), goalId: id, data: { from: prev.state, to, note } });
    this.recordHistory(next, note);
    const nameMap: Partial<Record<GoalState, "GoalStarted" | "GoalBlocked" | "GoalResumed" | "GoalCompleted" | "GoalCancelled" | "GoalArchived" | "GoalPaused">> = {
      active: "GoalStarted", blocked: "GoalBlocked", tracking: "GoalResumed",
      completed: "GoalCompleted", cancelled: "GoalCancelled", archived: "GoalArchived", replanning: "GoalPaused",
    };
    const evName = nameMap[to];
    if (evName) this.deps.events.emit({ name: evName, at: this.deps.now(), goalId: id, data: {} });
    return next;
  }

  canTransition(id: string, to: GoalState): boolean {
    const g = this.goals.get(id); if (!g) return false;
    return canTransition(g.state, to);
  }

  /* ---------- Understanding ---------- */
  understand(id: string) { return understandGoal(this.goals.require(id)); }

  /* ---------- Planning ---------- */
  planGoal(id: string): GoalPlan {
    const goal = this.goals.require(id);
    const plan = generatePlan(goal, this.deps.config, this.deps.now());
    validatePlan(plan, this.deps.config);
    this.plans.put(plan);
    this.deps.metrics.inc("goal.plan.created");
    this.deps.metrics.observe("goal.plan.milestones", plan.milestones.length);
    this.deps.events.emit({ name: "PlanCreated", at: this.deps.now(), goalId: goal.id, data: { planId: plan.id, milestones: plan.milestones.length } });
    for (const m of plan.milestones) {
      this.deps.events.emit({ name: "MilestoneCreated", at: this.deps.now(), goalId: goal.id, data: { milestoneId: m.id, title: m.title } });
    }
    return plan;
  }

  currentPlan(id: string): GoalPlan | undefined { return this.plans.forGoal(id); }

  replan(id: string, triggers: readonly AdaptiveTrigger[]): GoalPlan {
    const goal = this.goals.require(id);
    const prev = this.plans.forGoal(id);
    if (!prev) return this.planGoal(id);
    const next = adaptivePlan(prev, goal, triggers, this.deps.config, this.deps.now());
    validatePlan(next, this.deps.config);
    this.plans.put(next);
    this.deps.metrics.inc("goal.plan.revised");
    this.deps.events.emit({ name: "PlanRevised", at: this.deps.now(), goalId: id, data: { planId: next.id, version: next.version } });
    this.deps.events.emit({ name: "GoalReplanned", at: this.deps.now(), goalId: id, data: { planId: next.id, triggers: triggers.length } });
    return next;
  }

  maybeReplan(id: string, triggers: readonly AdaptiveTrigger[], threshold?: number): GoalPlan | undefined {
    if (!shouldReplan(triggers, threshold)) return undefined;
    return this.replan(id, triggers);
  }

  /* ---------- Milestones ---------- */
  updateMilestone(goalId: string, milestoneId: string, status: MilestoneStatus): GoalPlan {
    const plan = this.plans.forGoal(goalId);
    if (!plan) throw new UnknownGoalError(goalId);
    const next = setMilestoneStatus(plan, milestoneId, status, this.deps.now());
    this.plans.put(next);
    this.deps.metrics.inc(`goal.milestone.${status}`);
    if (status === "done") this.deps.events.emit({ name: "MilestoneCompleted", at: this.deps.now(), goalId, data: { milestoneId } });
    if (status === "blocked") this.deps.events.emit({ name: "MilestoneBlocked", at: this.deps.now(), goalId, data: { milestoneId } });
    return next;
  }

  orderedMilestones(goalId: string): readonly GoalMilestone[] {
    const plan = this.plans.forGoal(goalId);
    return plan ? orderMilestones(plan) : [];
  }
  nextActionableMilestone(goalId: string): GoalMilestone | undefined {
    const plan = this.plans.forGoal(goalId);
    return plan ? nextActionable(plan) : undefined;
  }

  /* ---------- Progress ---------- */
  progressFor(id: string, extra: Partial<ProgressInputs> = {}): GoalProgress {
    const plan = this.plans.forGoal(id);
    const progress = computeProgress({ goalId: id, plan, ...extra, now: this.deps.now() }, this.deps.config);
    this.deps.metrics.observe("goal.progress.percent", progress.percent);
    this.deps.events.emit({ name: "ProgressUpdated", at: this.deps.now(), goalId: id, data: { percent: progress.percent } });
    return progress;
  }

  /* ---------- Reasoning ---------- */
  prioritise(): readonly Goal[] { return orderByPriority(this.goals.list(), this.deps.config); }
  conflicts(): readonly GoalConflict[] {
    const c = detectConflicts(this.goals.list(), this.deps.now());
    for (const conflict of c) {
      this.deps.events.emit({ name: "GoalConflictDetected", at: this.deps.now(), data: { id: conflict.id, kind: conflict.kind, goals: conflict.goalIds } });
    }
    return c;
  }
  mergeGoals(a: string, b: string): Goal {
    const merged = mergeGoals(this.goals.require(a), this.goals.require(b), this.deps.now());
    this.goals.put(merged);
    this.deps.events.emit({ name: "GoalMerged", at: this.deps.now(), goalId: merged.id, data: { from: [a, b] } });
    return merged;
  }
  splitGoal(id: string, parts: readonly { title: string; description?: string }[]): readonly Goal[] {
    const goals = splitGoal(this.goals.require(id), parts, this.deps.now());
    for (const g of goals) this.goals.put(g);
    this.deps.events.emit({ name: "GoalSplit", at: this.deps.now(), goalId: id, data: { parts: goals.map((g) => g.id) } });
    return goals;
  }

  /* ---------- Policies ---------- */
  registerPolicy(policy: GoalPolicy): GoalPolicy { this.policies.set(policy.id, policy); return policy; }
  policy(id = "policy.default"): GoalPolicy { return this.policies.get(id) ?? this.policies.get("policy.default")!; }

  /* ---------- Snapshots & history ---------- */
  snapshot(): GoalSnapshot {
    return makeSnapshot(this.goals.list().map((g) => g.id), this.plans.list().map((p) => p.id), this.deps.now());
  }

  private recordHistory(goal: Goal, note?: string): void {
    this.history.append({
      id: newHistoryId(),
      goalId: goal.id,
      at: this.deps.now(),
      state: goal.state,
      note,
    }, this.deps.config.maxHistoryPerGoal);
  }
}
