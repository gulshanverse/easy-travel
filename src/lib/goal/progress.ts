/**
 * Goal Engine — progress engine. Deterministic recalculation.
 */
import type { GoalConfig } from "./config";
import { newProgressId } from "./ids";
import type { GoalPlan, GoalProgress } from "./types";

export interface ProgressInputs {
  readonly goalId: string;
  readonly plan?: GoalPlan;
  readonly budgetSpentMinor?: number;
  readonly budgetTargetMinor?: number;
  readonly journeyProgress?: number;
  readonly decisionProgress?: number;
  readonly trust?: number;
  readonly risk?: number;
  readonly now?: number;
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function computeProgress(inputs: ProgressInputs, config: GoalConfig): GoalProgress {
  const now = inputs.now ?? Date.now();
  const plan = inputs.plan;
  const milestonesTotal = plan ? plan.milestones.length : 0;
  const milestonesDone = plan ? plan.milestones.filter((m) => m.status === "done" || m.status === "skipped").length : 0;
  let stepsTotal = 0;
  let stepsDone = 0;
  if (plan) {
    for (const m of plan.milestones) {
      stepsTotal += m.steps.length;
      if (m.status === "done") stepsDone += m.steps.length;
    }
  }
  const mFrac = milestonesTotal ? milestonesDone / milestonesTotal : 0;
  const sFrac = stepsTotal ? stepsDone / stepsTotal : 0;
  const budgetPercent = inputs.budgetTargetMinor && inputs.budgetTargetMinor > 0 && inputs.budgetSpentMinor !== undefined
    ? clamp01(inputs.budgetSpentMinor / inputs.budgetTargetMinor) : undefined;
  const timelinePercent = plan && plan.timeline.startAt && plan.timeline.targetAt
    ? clamp01((now - plan.timeline.startAt) / Math.max(1, plan.timeline.targetAt - plan.timeline.startAt)) : undefined;
  const w = config.progress;
  const weighted = clamp01(
    (mFrac * w.milestoneWeight) +
    (sFrac * w.stepWeight) +
    ((budgetPercent ?? 0) * w.budgetWeight) +
    ((timelinePercent ?? 0) * w.timelineWeight),
  );
  const confidence = clamp01(((inputs.trust ?? 0.5) + (inputs.journeyProgress ?? 0) + (inputs.decisionProgress ?? 0)) / 3);
  return Object.freeze({
    id: newProgressId(),
    goalId: inputs.goalId,
    percent: weighted,
    milestonesDone,
    milestonesTotal,
    stepsDone,
    stepsTotal,
    budgetPercent,
    timelinePercent,
    confidence,
    risk: clamp01(inputs.risk ?? Math.max(0, 1 - confidence)),
    computedAt: now,
  });
}
