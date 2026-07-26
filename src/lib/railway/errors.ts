/** RICS — error taxonomy. */
export class RailwayError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  constructor(code: string, message: string, retryable = false) {
    super(message);
    this.name = "RailwayError";
    this.code = code;
    this.retryable = retryable;
  }
}
export class RailwayValidationError extends RailwayError {
  constructor(message: string) { super("railway_validation_error", message, false); }
}
export class RailwayNotFoundError extends RailwayError {
  constructor(kind: string, id: string) { super("railway_not_found", `${kind} not found: ${id}`, false); }
}
export class RailwayCapabilityUnsupportedError extends RailwayError {
  constructor(providerId: string, capability: string) {
    super("railway_capability_unsupported", `provider ${providerId} does not support ${capability}`, false);
  }
}
export class RailwayProviderUnavailableError extends RailwayError {
  constructor(providerId: string, reason = "provider is not functional in this build") {
    super("railway_provider_unavailable", `${providerId}: ${reason}`, true);
  }
}
export class RailwayNormalizationError extends RailwayError {
  constructor(message: string) { super("railway_normalization_error", message, false); }
}
export class RailwayResolutionError extends RailwayError {
  constructor(capability: string) {
    super("railway_no_connector", `no enabled railway connector provides capability: ${capability}`, false);
  }
}
