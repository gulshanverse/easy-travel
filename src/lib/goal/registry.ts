/**
 * Goal Engine — in-memory registries for goals, plans, history.
 */
import { UnknownGoalError, UnknownPlanError } from "./errors";
import type { Goal, GoalHistoryEntry, GoalPlan } from "./types";

export class GoalStore {
  private readonly goals = new Map<string, Goal>();
  private readonly byOwner = new Map<string, Set<string>>();

  put(goal: Goal): Goal {
    this.goals.set(goal.id, goal);
    const set = this.byOwner.get(goal.ownerId) ?? new Set<string>();
    set.add(goal.id);
    this.byOwner.set(goal.ownerId, set);
    return goal;
  }
  get(id: string): Goal | undefined { return this.goals.get(id); }
  require(id: string): Goal { const g = this.get(id); if (!g) throw new UnknownGoalError(id); return g; }
  remove(id: string): void {
    const g = this.goals.get(id);
    if (!g) return;
    this.goals.delete(id);
    this.byOwner.get(g.ownerId)?.delete(id);
  }
  list(): readonly Goal[] { return Array.from(this.goals.values()); }
  forOwner(ownerId: string): readonly Goal[] {
    const ids = this.byOwner.get(ownerId);
    if (!ids) return [];
    return Array.from(ids).map((id) => this.goals.get(id)!).filter(Boolean);
  }
  size(): number { return this.goals.size; }
  clear(): void { this.goals.clear(); this.byOwner.clear(); }
}

export class PlanStore {
  private readonly plans = new Map<string, GoalPlan>();
  private readonly byGoal = new Map<string, string>();

  put(plan: GoalPlan): GoalPlan {
    this.plans.set(plan.id, plan);
    this.byGoal.set(plan.goalId, plan.id);
    return plan;
  }
  get(id: string): GoalPlan | undefined { return this.plans.get(id); }
  require(id: string): GoalPlan { const p = this.get(id); if (!p) throw new UnknownPlanError(id); return p; }
  forGoal(goalId: string): GoalPlan | undefined {
    const id = this.byGoal.get(goalId);
    return id ? this.plans.get(id) : undefined;
  }
  list(): readonly GoalPlan[] { return Array.from(this.plans.values()); }
  size(): number { return this.plans.size; }
  clear(): void { this.plans.clear(); this.byGoal.clear(); }
}

export class HistoryStore {
  private readonly perGoal = new Map<string, GoalHistoryEntry[]>();
  append(entry: GoalHistoryEntry, cap: number): void {
    const list = this.perGoal.get(entry.goalId) ?? [];
    list.push(entry);
    if (list.length > cap) list.shift();
    this.perGoal.set(entry.goalId, list);
  }
  for(goalId: string): readonly GoalHistoryEntry[] { return this.perGoal.get(goalId) ?? []; }
  clear(): void { this.perGoal.clear(); }
}
