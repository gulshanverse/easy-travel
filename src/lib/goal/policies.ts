/**
 * Goal Engine — policies for gating lifecycle actions.
 */
import type { Goal } from "./types";

export interface GoalPolicy {
  readonly id: string;
  readonly description: string;
  readonly canStart: (goal: Goal) => boolean;
  readonly canComplete: (goal: Goal, progressPercent: number) => boolean;
  readonly canReplan: (goal: Goal) => boolean;
}

const DEFAULT: GoalPolicy = Object.freeze({
  id: "policy.default",
  description: "Standard gate policy",
  canStart: (g: Goal) => g.state === "planning" || g.state === "created" || g.state === "analysing",
  canComplete: (_g: Goal, p: number) => p >= 1,
  canReplan: (g: Goal) => g.state === "active" || g.state === "tracking" || g.state === "blocked",
});
const STRICT: GoalPolicy = Object.freeze({
  id: "policy.strict",
  description: "Strict gate policy: require full progress and non-blocked state",
  canStart: (g: Goal) => g.state === "planning",
  canComplete: (g: Goal, p: number) => p >= 1 && g.state !== "blocked",
  canReplan: (g: Goal) => g.state === "blocked" || g.state === "replanning",
});
const LAX: GoalPolicy = Object.freeze({
  id: "policy.lax",
  description: "Lax policy allowing early completion",
  canStart: (_g: Goal) => true,
  canComplete: (_g: Goal, p: number) => p >= 0.75,
  canReplan: (_g: Goal) => true,
});

export const DEFAULT_GOAL_POLICIES: readonly GoalPolicy[] = Object.freeze([DEFAULT, STRICT, LAX]);
