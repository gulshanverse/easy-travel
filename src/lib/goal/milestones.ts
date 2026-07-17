/**
 * Goal Engine — milestone engine. Ordering, dependencies, completion rules.
 */
import { UnknownMilestoneError } from "./errors";
import type { GoalMilestone, GoalPlan, MilestoneStatus } from "./types";

export function orderMilestones(plan: GoalPlan): readonly GoalMilestone[] {
  const byId = new Map(plan.milestones.map((m) => [m.id, m]));
  const visited = new Set<string>();
  const order: GoalMilestone[] = [];
  function visit(id: string, stack: Set<string>): void {
    if (visited.has(id)) return;
    if (stack.has(id)) return; // ignore cycle
    stack.add(id);
    const m = byId.get(id);
    if (!m) return;
    for (const d of m.dependsOn) visit(d, stack);
    stack.delete(id);
    visited.add(id);
    order.push(m);
  }
  for (const m of [...plan.milestones].sort((a, b) => a.order - b.order)) visit(m.id, new Set());
  return Object.freeze(order);
}

export function nextActionable(plan: GoalPlan): GoalMilestone | undefined {
  const done = new Set(plan.milestones.filter((m) => m.status === "done").map((m) => m.id));
  for (const m of orderMilestones(plan)) {
    if (m.status === "done" || m.status === "skipped") continue;
    if (m.dependsOn.every((d) => done.has(d))) return m;
  }
  return undefined;
}

export function setMilestoneStatus(plan: GoalPlan, milestoneId: string, status: MilestoneStatus, now: number): GoalPlan {
  let found = false;
  const next = plan.milestones.map((m) => {
    if (m.id !== milestoneId) return m;
    found = true;
    return Object.freeze({ ...m, status, completedAt: status === "done" ? now : m.completedAt });
  });
  if (!found) throw new UnknownMilestoneError(milestoneId);
  return Object.freeze({ ...plan, milestones: Object.freeze(next) });
}

export function rollbackMilestone(plan: GoalPlan, milestoneId: string): GoalPlan {
  return setMilestoneStatus(plan, milestoneId, "pending", 0);
}
