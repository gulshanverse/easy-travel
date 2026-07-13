/**
 * Journey lifecycle state machine.
 * Deterministic, side-effect free. The manager owns event emission; this
 * module only answers "is this transition legal?".
 */

import { JourneyTransitionError } from "./errors";
import { JOURNEY_STATES, type JourneyState } from "./types";

/** Directed transition graph. Terminal-ish states can still be re-opened via
 *  explicit rollback (see `canRollback`), but forward moves are constrained. */
export const JOURNEY_TRANSITIONS: Readonly<Record<JourneyState, readonly JourneyState[]>> =
  Object.freeze({
    created:   ["exploring", "archived"],
    exploring: ["planning", "archived"],
    planning:  ["draft", "exploring", "archived"],
    draft:     ["review", "planning", "archived"],
    review:    ["confirmed", "draft", "archived"],
    confirmed: ["active", "review", "archived"],
    active:    ["paused", "completed", "archived"],
    paused:    ["active", "archived"],
    completed: ["archived"],
    archived:  [],
  });

export const TERMINAL_STATES: ReadonlySet<JourneyState> = new Set(["archived"]);

/** Rollback map — subset of transitions allowed only via `rollback()`. */
export const ROLLBACK_MAP: Readonly<Record<JourneyState, JourneyState | undefined>> = Object.freeze({
  created: undefined,
  exploring: "created",
  planning: "exploring",
  draft: "planning",
  review: "draft",
  confirmed: "review",
  active: "confirmed",
  paused: "active",
  completed: "active",
  archived: undefined,
});

export function isJourneyState(v: unknown): v is JourneyState {
  return typeof v === "string" && (JOURNEY_STATES as readonly string[]).includes(v);
}

export function canTransition(from: JourneyState, to: JourneyState): boolean {
  return (JOURNEY_TRANSITIONS[from] ?? []).includes(to);
}

export function assertTransition(from: JourneyState, to: JourneyState): void {
  if (!canTransition(from, to)) throw new JourneyTransitionError(from, to);
}

export function canRollback(from: JourneyState): boolean {
  return ROLLBACK_MAP[from] !== undefined;
}

export function rollbackTarget(from: JourneyState): JourneyState {
  const t = ROLLBACK_MAP[from];
  if (!t) throw new JourneyTransitionError(from, "<none>");
  return t;
}
