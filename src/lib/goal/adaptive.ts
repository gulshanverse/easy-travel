/**
 * Goal Engine — adaptive planning. Deterministic replanning triggers.
 */
import type { GoalConfig } from "./config";
import { revisePlan } from "./planning";
import type { Goal, GoalPlan } from "./types";

export interface AdaptiveTrigger {
  readonly kind: "constraint" | "risk" | "decision" | "trust" | "journey" | "manual";
  readonly reason: string;
  readonly severity: number; // 0..1
}

export function shouldReplan(triggers: readonly AdaptiveTrigger[], threshold = 0.5): boolean {
  if (triggers.length === 0) return false;
  const max = triggers.reduce((m, t) => Math.max(m, t.severity), 0);
  return max >= threshold;
}

export function adaptivePlan(prev: GoalPlan, goal: Goal, triggers: readonly AdaptiveTrigger[], config: GoalConfig, now: number = Date.now()): GoalPlan {
  const note = triggers.map((t) => `${t.kind}:${t.reason}(${t.severity.toFixed(2)})`).join(" | ") || "manual";
  return revisePlan(prev, goal, config, note, now);
}
