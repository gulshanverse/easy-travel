/**
 * Runtime Core — Unified error hierarchy (Sprint I-003).
 *
 * Every runtime module throws a subclass of RuntimeError. Errors carry a
 * machine-readable code, severity, retryability classification, and an
 * optional recovery hint so upstream capabilities can react programmatically
 * rather than pattern-matching on messages.
 */

export type ErrorSeverity = "info" | "warning" | "error" | "critical";

export interface RuntimeErrorOptions {
  code: string;
  severity?: ErrorSeverity;
  retryable?: boolean;
  cause?: unknown;
  recoveryHint?: string;
  context?: Record<string, unknown>;
}

export class RuntimeError extends Error {
  readonly code: string;
  readonly severity: ErrorSeverity;
  readonly retryable: boolean;
  readonly recoveryHint?: string;
  readonly context?: Record<string, unknown>;
  override readonly cause?: unknown;

  constructor(message: string, opts: RuntimeErrorOptions) {
    super(message);
    this.name = new.target.name;
    this.code = opts.code;
    this.severity = opts.severity ?? "error";
    this.retryable = opts.retryable ?? false;
    this.recoveryHint = opts.recoveryHint;
    this.context = opts.context;
    this.cause = opts.cause;
  }
}

export class ConfigurationError extends RuntimeError {
  constructor(message: string, opts?: Partial<RuntimeErrorOptions>) {
    super(message, { code: "RUNTIME_CONFIG", severity: "critical", retryable: false, ...opts });
  }
}

export class ContainerError extends RuntimeError {
  constructor(message: string, opts?: Partial<RuntimeErrorOptions>) {
    super(message, { code: "RUNTIME_CONTAINER", severity: "error", retryable: false, ...opts });
  }
}

export class DependencyResolutionError extends ContainerError {
  constructor(message: string, opts?: Partial<RuntimeErrorOptions>) {
    super(message, { code: "RUNTIME_DEPENDENCY", ...opts });
  }
}

export class EventBusError extends RuntimeError {
  constructor(message: string, opts?: Partial<RuntimeErrorOptions>) {
    super(message, { code: "RUNTIME_EVENT_BUS", severity: "error", retryable: true, ...opts });
  }
}

export class ContextError extends RuntimeError {
  constructor(message: string, opts?: Partial<RuntimeErrorOptions>) {
    super(message, { code: "RUNTIME_CONTEXT", severity: "error", retryable: false, ...opts });
  }
}

export class CapabilityError extends RuntimeError {
  constructor(message: string, opts?: Partial<RuntimeErrorOptions>) {
    super(message, { code: "RUNTIME_CAPABILITY", severity: "error", retryable: false, ...opts });
  }
}

export class ValidationError extends RuntimeError {
  constructor(message: string, opts?: Partial<RuntimeErrorOptions>) {
    super(message, { code: "RUNTIME_VALIDATION", severity: "warning", retryable: false, ...opts });
  }
}

export class TimeoutError extends RuntimeError {
  constructor(message: string, opts?: Partial<RuntimeErrorOptions>) {
    super(message, { code: "RUNTIME_TIMEOUT", severity: "warning", retryable: true, ...opts });
  }
}

export class CancellationError extends RuntimeError {
  constructor(message = "Operation cancelled", opts?: Partial<RuntimeErrorOptions>) {
    super(message, { code: "RUNTIME_CANCELLED", severity: "info", retryable: false, ...opts });
  }
}
