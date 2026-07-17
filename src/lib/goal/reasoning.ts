/**
 * Goal Engine — reasoning: priority, conflict, merge, split, dependency graph.
 * Deterministic. No LLM reasoning.
 */
import type { GoalConfig } from "./config";
import { GoalDependencyError } from "./errors";
import { makeGoal } from "./factories";
import { newGoalId } from "./ids";
import type { Goal, GoalConflict } from "./types";

export function priorityScore(goal: Goal, config: GoalConfig): number {
  const base = config.priorityWeights[goal.priority] ?? 0.5;
  const urgency = goal.timeline.targetAt ? Math.max(0, Math.min(1, 1 - (goal.timeline.targetAt - Date.now()) / (1000 * 60 * 60 * 24 * 90))) : 0;
  const complexityFactor = { trivial: 0.1, simple: 0.2, moderate: 0.4, complex: 0.6, epic: 0.9 }[goal.complexity];
  return Math.max(0, Math.min(1, 0.6 * base + 0.25 * urgency + 0.15 * complexityFactor));
}

export function orderByPriority(goals: readonly Goal[], config: GoalConfig): readonly Goal[] {
  return Object.freeze([...goals].sort((a, b) => priorityScore(b, config) - priorityScore(a, config)));
}

export function detectConflicts(goals: readonly Goal[], now: number = Date.now()): readonly GoalConflict[] {
  const conflicts: GoalConflict[] = [];
  const byOwner = new Map<string, Goal[]>();
  for (const g of goals) {
    const list = byOwner.get(g.ownerId) ?? [];
    list.push(g);
    byOwner.set(g.ownerId, list);
  }
  for (const [, list] of byOwner) {
    // Priority conflict: multiple critical priority goals overlapping in time.
    const critical = list.filter((g) => g.priority === "critical" && g.timeline.startAt && g.timeline.targetAt);
    for (let i = 0; i < critical.length; i++) {
      for (let j = i + 1; j < critical.length; j++) {
        const a = critical[i]; const b = critical[j];
        if (a.timeline.startAt! < b.timeline.targetAt! && b.timeline.startAt! < a.timeline.targetAt!) {
          conflicts.push(Object.freeze({
            id: `cft_${a.id}_${b.id}`,
            kind: "timeline",
            goalIds: Object.freeze([a.id, b.id]),
            summary: "Overlapping critical-priority goals",
            at: now,
          }));
        }
      }
    }
    // Dependency conflict: goal depends on itself.
    for (const g of list) {
      if (g.dependencies.some((d) => d.goalId === g.id)) {
        conflicts.push(Object.freeze({
          id: `cft_self_${g.id}`,
          kind: "dependency",
          goalIds: Object.freeze([g.id]),
          summary: "Goal depends on itself",
          at: now,
        }));
      }
    }
  }
  return Object.freeze(conflicts);
}

export function mergeGoals(a: Goal, b: Goal, now: number = Date.now()): Goal {
  if (a.ownerId !== b.ownerId) throw new GoalDependencyError("Cannot merge goals from different owners", { a: a.id, b: b.id });
  return makeGoal({
    ownerId: a.ownerId,
    title: `${a.title} + ${b.title}`,
    description: [a.description, b.description].filter(Boolean).join("\n"),
    category: a.category,
    scope: a.scope === b.scope ? a.scope : "portfolio",
    complexity: a.complexity,
    duration: a.duration,
    priority: a.priority === "critical" || b.priority === "critical" ? "critical" : a.priority,
    constraints: [...a.constraints, ...b.constraints],
    dependencies: [...a.dependencies, ...b.dependencies],
    timeline: {
      startAt: a.timeline.startAt && b.timeline.startAt ? Math.min(a.timeline.startAt, b.timeline.startAt) : (a.timeline.startAt ?? b.timeline.startAt),
      targetAt: a.timeline.targetAt && b.timeline.targetAt ? Math.max(a.timeline.targetAt, b.timeline.targetAt) : (a.timeline.targetAt ?? b.timeline.targetAt),
      windows: [...a.timeline.windows, ...b.timeline.windows],
    },
    metadata: { tags: [...a.metadata.tags, ...b.metadata.tags, "merged"], attributes: { ...a.metadata.attributes, ...b.metadata.attributes } },
    now,
  });
}

export function splitGoal(goal: Goal, parts: readonly { title: string; description?: string }[], now: number = Date.now()): readonly Goal[] {
  if (parts.length < 2) throw new GoalDependencyError("Split requires at least 2 parts", { goalId: goal.id });
  return Object.freeze(parts.map((p) => makeGoal({
    ownerId: goal.ownerId,
    title: p.title,
    description: p.description ?? goal.description,
    category: goal.category,
    scope: "single",
    complexity: "simple",
    duration: goal.duration,
    priority: goal.priority,
    constraints: goal.constraints,
    dependencies: [{ goalId: goal.id, kind: "requires" }],
    timeline: goal.timeline,
    metadata: { tags: [...goal.metadata.tags, "split"], attributes: { splitFrom: goal.id } },
    id: newGoalId(),
    now,
  })));
}

export function buildDependencyGraph(goals: readonly Goal[]): Readonly<Record<string, readonly string[]>> {
  const graph: Record<string, string[]> = {};
  for (const g of goals) graph[g.id] = g.dependencies.map((d) => d.goalId);
  return Object.freeze(graph);
}

export function topologicalOrder(goals: readonly Goal[]): readonly string[] {
  const graph = buildDependencyGraph(goals);
  const visited = new Set<string>();
  const stack = new Set<string>();
  const order: string[] = [];
  function visit(id: string): void {
    if (visited.has(id)) return;
    if (stack.has(id)) return; // ignore cycle
    stack.add(id);
    for (const d of graph[id] ?? []) visit(d);
    stack.delete(id);
    visited.add(id);
    order.push(id);
  }
  for (const g of goals) visit(g.id);
  return Object.freeze(order);
}
