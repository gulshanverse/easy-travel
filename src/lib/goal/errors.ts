/**
 * Goal Engine — error hierarchy.
 */
export class GoalError extends Error {
  readonly code: string;
  readonly meta: Readonly<Record<string, unknown>>;
  constructor(code: string, message: string, meta: Record<string, unknown> = {}) {
    super(message);
    this.name = "GoalError";
    this.code = code;
    this.meta = Object.freeze({ ...meta });
  }
}
export class GoalValidationError extends GoalError {
  constructor(m: string, meta: Record<string, unknown> = {}) { super("GOAL_INVALID", m, meta); this.name = "GoalValidationError"; }
}
export class UnknownGoalError extends GoalError {
  constructor(id: string) { super("GOAL_UNKNOWN", `Unknown goal: ${id}`, { id }); this.name = "UnknownGoalError"; }
}
export class UnknownPlanError extends GoalError {
  constructor(id: string) { super("PLAN_UNKNOWN", `Unknown plan: ${id}`, { id }); this.name = "UnknownPlanError"; }
}
export class UnknownMilestoneError extends GoalError {
  constructor(id: string) { super("MILESTONE_UNKNOWN", `Unknown milestone: ${id}`, { id }); this.name = "UnknownMilestoneError"; }
}
export class GoalTransitionError extends GoalError {
  constructor(m: string, meta: Record<string, unknown> = {}) { super("GOAL_TRANSITION", m, meta); this.name = "GoalTransitionError"; }
}
export class GoalConflictError extends GoalError {
  constructor(m: string, meta: Record<string, unknown> = {}) { super("GOAL_CONFLICT", m, meta); this.name = "GoalConflictError"; }
}
export class GoalPlanningError extends GoalError {
  constructor(m: string, meta: Record<string, unknown> = {}) { super("GOAL_PLANNING", m, meta); this.name = "GoalPlanningError"; }
}
export class GoalDependencyError extends GoalError {
  constructor(m: string, meta: Record<string, unknown> = {}) { super("GOAL_DEPENDENCY", m, meta); this.name = "GoalDependencyError"; }
}
