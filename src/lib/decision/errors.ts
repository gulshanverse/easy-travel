/**
 * Decision Engine — Error hierarchy.
 * All errors extend `DecisionError` so consumers catch a single base type.
 */

export type DecisionErrorSeverity = "info" | "warning" | "error" | "critical";

export class DecisionError extends Error {
  readonly code: string;
  readonly severity: DecisionErrorSeverity;
  readonly context?: Readonly<Record<string, unknown>>;
  constructor(
    code: string,
    message: string,
    opts: { severity?: DecisionErrorSeverity; context?: Record<string, unknown>; cause?: unknown } = {},
  ) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.severity = opts.severity ?? "error";
    this.context = opts.context ? Object.freeze({ ...opts.context }) : undefined;
    if (opts.cause !== undefined) (this as { cause?: unknown }).cause = opts.cause;
  }
}

export class DecisionConfigurationError extends DecisionError {
  constructor(m: string, c?: Record<string, unknown>) {
    super("decision.config_invalid", m, { severity: "critical", context: c });
  }
}
export class DecisionNotFoundError extends DecisionError {
  constructor(id: string) { super("decision.not_found", `decision not found: ${id}`, { context: { id } }); }
}
export class DecisionStateError extends DecisionError {
  constructor(m: string, c?: Record<string, unknown>) { super("decision.invalid_state", m, { context: c }); }
}
export class DecisionTransitionError extends DecisionError {
  constructor(from: string, to: string) {
    super("decision.invalid_transition", `illegal transition ${from} → ${to}`, { context: { from, to } });
  }
}
export class DecisionValidationError extends DecisionError {
  constructor(m: string, c?: Record<string, unknown>) { super("decision.validation_failed", m, { context: c }); }
}
export class DecisionConstraintConflictError extends DecisionError {
  constructor(m: string, c?: Record<string, unknown>) { super("decision.constraint_conflict", m, { context: c }); }
}
export class DecisionScoringError extends DecisionError {
  constructor(m: string, c?: Record<string, unknown>) { super("decision.scoring_failed", m, { context: c }); }
}
export class DecisionRankingError extends DecisionError {
  constructor(m: string, c?: Record<string, unknown>) { super("decision.ranking_failed", m, { context: c }); }
}
export class DecisionExplanationError extends DecisionError {
  constructor(m: string, c?: Record<string, unknown>) { super("decision.explanation_failed", m, { context: c }); }
}
export class DecisionPortError extends DecisionError {
  constructor(port: string, message: string, cause?: unknown) {
    super("decision.port_failed", `${port}: ${message}`, { context: { port }, cause });
  }
}
export class DecisionRegistryError extends DecisionError {
  constructor(m: string, c?: Record<string, unknown>) { super("decision.registry_error", m, { context: c }); }
}
