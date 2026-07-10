/**
 * Provider Runtime — Error hierarchy.
 * Every error carries severity, retryable classification, and optional cause.
 */
export type ProviderErrorSeverity = "info" | "warn" | "error" | "fatal";

export interface ProviderErrorOptions {
  cause?: unknown;
  retryable?: boolean;
  severity?: ProviderErrorSeverity;
  metadata?: Readonly<Record<string, unknown>>;
}

export class ProviderError extends Error {
  readonly retryable: boolean;
  readonly severity: ProviderErrorSeverity;
  readonly metadata?: Readonly<Record<string, unknown>>;
  constructor(message: string, opts: ProviderErrorOptions = {}) {
    super(message);
    this.name = new.target.name;
    this.retryable = opts.retryable ?? false;
    this.severity = opts.severity ?? "error";
    this.metadata = opts.metadata;
    if (opts.cause !== undefined) (this as { cause?: unknown }).cause = opts.cause;
  }
}

export class ProviderConfigurationError extends ProviderError {}
export class ProviderRegistrationError extends ProviderError {}
export class ProviderNotFoundError extends ProviderError {}
export class ProviderUnavailableError extends ProviderError {
  constructor(message: string, opts: ProviderErrorOptions = {}) {
    super(message, { retryable: true, ...opts });
  }
}
export class ProviderTimeoutError extends ProviderError {
  constructor(message: string, opts: ProviderErrorOptions = {}) {
    super(message, { retryable: true, ...opts });
  }
}
export class ProviderCancellationError extends ProviderError {
  constructor(message = "Provider execution cancelled", opts: ProviderErrorOptions = {}) {
    super(message, { retryable: false, severity: "info", ...opts });
  }
}
export class ProviderCircuitOpenError extends ProviderError {
  constructor(message: string, opts: ProviderErrorOptions = {}) {
    super(message, { retryable: true, ...opts });
  }
}
export class ProviderCapabilityError extends ProviderError {}
export class ProviderBudgetError extends ProviderError {}
export class ProviderRoutingError extends ProviderError {}
export class ProviderValidationError extends ProviderError {}
export class ProviderCredentialError extends ProviderError {
  constructor(message: string, opts: ProviderErrorOptions = {}) {
    super(message, { severity: "fatal", ...opts });
  }
}
export class ModelNotFoundError extends ProviderError {}
export class ModelIncompatibleError extends ProviderError {}
