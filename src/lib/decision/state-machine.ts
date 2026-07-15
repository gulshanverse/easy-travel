/**
 * Decision lifecycle state machine.
 * Deterministic, side-effect free.
 */

import { DecisionTransitionError } from "./errors";
import { DECISION_STATES, type DecisionState } from "./types";

export const DECISION_TRANSITIONS: Readonly<Record<DecisionState, readonly DecisionState[]>> =
  Object.freeze({
    created:            ["collecting_context", "archived", "failed"],
    collecting_context: ["generating_options", "failed", "archived"],
    generating_options: ["evaluating", "failed", "archived"],
    evaluating:         ["constraining", "failed", "archived"],
    constraining:       ["ranking", "failed", "archived"],
    ranking:            ["explaining", "failed", "archived"],
    explaining:         ["validating", "failed", "archived"],
    validating:         ["approved", "ranking", "failed", "archived"],
    approved:           ["archived"],
    archived:           [],
    failed:             ["archived"],
  });

export const ROLLBACK_MAP: Readonly<Record<DecisionState, DecisionState | undefined>> = Object.freeze({
  created: undefined,
  collecting_context: "created",
  generating_options: "collecting_context",
  evaluating: "generating_options",
  constraining: "evaluating",
  ranking: "constraining",
  explaining: "ranking",
  validating: "explaining",
  approved: "validating",
  archived: undefined,
  failed: undefined,
});

export function isDecisionState(v: unknown): v is DecisionState {
  return typeof v === "string" && (DECISION_STATES as readonly string[]).includes(v);
}

export function canTransition(from: DecisionState, to: DecisionState): boolean {
  return (DECISION_TRANSITIONS[from] ?? []).includes(to);
}
export function assertTransition(from: DecisionState, to: DecisionState): void {
  if (!canTransition(from, to)) throw new DecisionTransitionError(from, to);
}
export function canRollback(from: DecisionState): boolean {
  return ROLLBACK_MAP[from] !== undefined;
}
export function rollbackTarget(from: DecisionState): DecisionState {
  const t = ROLLBACK_MAP[from];
  if (!t) throw new DecisionTransitionError(from, "<none>");
  return t;
}
