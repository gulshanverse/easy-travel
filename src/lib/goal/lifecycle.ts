/**
 * Goal Engine — lifecycle state machine.
 * Deterministic transitions with rollback support.
 */
import { GoalTransitionError } from "./errors";
import type { GoalState } from "./types";

const TRANSITIONS: Readonly<Record<GoalState, readonly GoalState[]>> = Object.freeze({
  created:    ["analysing", "cancelled", "archived"],
  analysing:  ["planning", "blocked", "cancelled"],
  planning:   ["active", "blocked", "cancelled"],
  active:     ["tracking", "blocked", "replanning", "completed", "cancelled"],
  tracking:   ["active", "blocked", "replanning", "completed", "cancelled"],
  blocked:    ["replanning", "active", "cancelled"],
  replanning: ["active", "tracking", "cancelled"],
  completed:  ["archived"],
  cancelled:  ["archived"],
  archived:   [],
});

export function canTransition(from: GoalState, to: GoalState): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: GoalState, to: GoalState, goalId: string): void {
  if (!canTransition(from, to)) {
    throw new GoalTransitionError(`Illegal transition ${from} → ${to}`, { goalId, from, to });
  }
}

export const TERMINAL_STATES: readonly GoalState[] = Object.freeze(["archived"]);

export function isTerminal(state: GoalState): boolean {
  return TERMINAL_STATES.includes(state);
}
