/**
 * Journey Intelligence Engine — Error hierarchy.
 * All journey errors extend `JourneyError` so consumers can catch a single
 * base type. Every error carries a stable `code` for telemetry.
 */

export type JourneyErrorSeverity = "info" | "warning" | "error" | "critical";

export class JourneyError extends Error {
  readonly code: string;
  readonly severity: JourneyErrorSeverity;
  readonly context?: Readonly<Record<string, unknown>>;
  constructor(
    code: string,
    message: string,
    opts: { severity?: JourneyErrorSeverity; context?: Record<string, unknown>; cause?: unknown } = {},
  ) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.severity = opts.severity ?? "error";
    this.context = opts.context ? Object.freeze({ ...opts.context }) : undefined;
    if (opts.cause !== undefined) (this as { cause?: unknown }).cause = opts.cause;
  }
}

export class JourneyConfigurationError extends JourneyError {
  constructor(message: string, ctx?: Record<string, unknown>) {
    super("journey.config_invalid", message, { severity: "critical", context: ctx });
  }
}
export class JourneyNotFoundError extends JourneyError {
  constructor(id: string) {
    super("journey.not_found", `journey not found: ${id}`, { context: { id } });
  }
}
export class JourneyStateError extends JourneyError {
  constructor(message: string, ctx?: Record<string, unknown>) {
    super("journey.invalid_state", message, { context: ctx });
  }
}
export class JourneyTransitionError extends JourneyError {
  constructor(from: string, to: string) {
    super("journey.invalid_transition", `illegal transition ${from} → ${to}`, {
      context: { from, to },
    });
  }
}
export class JourneyValidationError extends JourneyError {
  constructor(message: string, ctx?: Record<string, unknown>) {
    super("journey.validation_failed", message, { context: ctx });
  }
}
export class JourneyConstraintConflictError extends JourneyError {
  constructor(message: string, ctx?: Record<string, unknown>) {
    super("journey.constraint_conflict", message, { context: ctx });
  }
}
export class JourneyTimelineError extends JourneyError {
  constructor(message: string, ctx?: Record<string, unknown>) {
    super("journey.timeline_invalid", message, { context: ctx });
  }
}
export class JourneyIntentError extends JourneyError {
  constructor(message: string, ctx?: Record<string, unknown>) {
    super("journey.intent_invalid", message, { context: ctx });
  }
}
export class JourneyContextError extends JourneyError {
  constructor(message: string, ctx?: Record<string, unknown>) {
    super("journey.context_assembly_failed", message, { context: ctx });
  }
}
export class JourneyPortError extends JourneyError {
  constructor(port: string, message: string, cause?: unknown) {
    super("journey.port_failed", `${port}: ${message}`, { context: { port }, cause });
  }
}
export class JourneyRegistryError extends JourneyError {
  constructor(message: string, ctx?: Record<string, unknown>) {
    super("journey.registry_error", message, { context: ctx });
  }
}
