/**
 * Goal Engine — planning engine. Deterministic decomposition.
 */
import type { GoalConfig } from "./config";
import { makeMilestone, makePlan, makeStep } from "./factories";
import type { Goal, GoalMilestone, GoalPlan, GoalStep, StepKind } from "./types";

const STANDARD_TEMPLATE: readonly { title: string; gate?: "decision" | "risk" | "validation" }[] = Object.freeze([
  { title: "Understand goal", gate: "validation" },
  { title: "Explore options", gate: "decision" },
  { title: "Decide direction", gate: "decision" },
  { title: "Prepare", gate: "risk" },
  { title: "Execute" },
  { title: "Review", gate: "validation" },
  { title: "Close" },
]);

export function generatePlan(goal: Goal, config: GoalConfig, now: number = Date.now()): GoalPlan {
  const target = config.complexity.milestonesPer[goal.complexity] ?? 4;
  const stepsPer = config.complexity.stepsPerMilestone[goal.complexity] ?? 3;
  const clamped = Math.max(1, Math.min(config.maxMilestonesPerPlan, target));
  const templates = STANDARD_TEMPLATE.slice(0, clamped);
  const milestones: GoalMilestone[] = [];
  let prevId: string | undefined;
  const startAt = goal.timeline.startAt ?? now;
  const targetAt = goal.timeline.targetAt ?? startAt + config.defaultPlanTimeoutMs;
  const window = Math.max(1, (targetAt - startAt) / templates.length);
  templates.forEach((tpl, i) => {
    const mid = `ms_${i}_${goal.id}`;
    const steps: GoalStep[] = [];
    for (let s = 0; s < stepsPer; s++) {
      const kind: StepKind = s === stepsPer - 1 && tpl.gate ? (tpl.gate === "decision" ? "decision" : tpl.gate === "risk" ? "validation" : "validation") : "task";
      steps.push(makeStep({
        summary: `${tpl.title}: step ${s + 1}`,
        milestoneId: mid,
        order: s,
        kind,
        gate: s === stepsPer - 1 ? tpl.gate : undefined,
        estimateMs: Math.floor(window / stepsPer),
      }));
    }
    milestones.push(makeMilestone({
      id: mid,
      title: tpl.title,
      order: i,
      dependsOn: prevId ? [prevId] : [],
      targetAt: Math.floor(startAt + window * (i + 1)),
      steps,
    }));
    prevId = mid;
  });
  const rationale = [
    `complexity=${goal.complexity} → ${clamped} milestones`,
    `stepsPerMilestone=${stepsPer}`,
    `window=${Math.round(window)}ms`,
  ];
  return makePlan({
    goalId: goal.id,
    milestones,
    timeline: { startAt, targetAt },
    budget: goal.budget,
    rationale,
    now,
  });
}

export function revisePlan(prev: GoalPlan, goal: Goal, config: GoalConfig, note: string, now: number = Date.now()): GoalPlan {
  const next = generatePlan(goal, config, now);
  return Object.freeze({
    ...next,
    version: prev.version + 1,
    rationale: Object.freeze([...next.rationale, `revision: ${note}`]),
  });
}
