/**
 * Goal Engine — deterministic validation.
 */
import type { GoalConfig } from "./config";
import { GoalValidationError } from "./errors";
import type { Goal, GoalPlan } from "./types";

export function validateGoal(goal: Goal, config: GoalConfig): void {
  if (!goal.id) throw new GoalValidationError("Goal.id is required");
  if (!goal.ownerId) throw new GoalValidationError("Goal.ownerId is required", { id: goal.id });
  if (!goal.title || goal.title.trim().length === 0) throw new GoalValidationError("Goal.title is required", { id: goal.id });
  if (goal.title.length > 512) throw new GoalValidationError("Goal.title too long", { id: goal.id });
  if (goal.dependencies.length > config.maxDependencyDepth) {
    throw new GoalValidationError("Too many dependencies", { id: goal.id, count: goal.dependencies.length });
  }
}

export function validatePlan(plan: GoalPlan, config: GoalConfig): void {
  if (!plan.goalId) throw new GoalValidationError("Plan.goalId is required");
  if (plan.milestones.length === 0) throw new GoalValidationError("Plan requires at least one milestone", { planId: plan.id });
  if (plan.milestones.length > config.maxMilestonesPerPlan) {
    throw new GoalValidationError("Too many milestones", { planId: plan.id, count: plan.milestones.length });
  }
  const ids = new Set<string>();
  for (const m of plan.milestones) {
    if (ids.has(m.id)) throw new GoalValidationError("Duplicate milestone id", { id: m.id });
    ids.add(m.id);
    if (m.steps.length > config.maxStepsPerMilestone) {
      throw new GoalValidationError("Too many steps in milestone", { id: m.id, count: m.steps.length });
    }
  }
  for (const m of plan.milestones) {
    for (const d of m.dependsOn) if (!ids.has(d)) throw new GoalValidationError("Milestone depends on unknown milestone", { id: m.id, depends: d });
  }
}
