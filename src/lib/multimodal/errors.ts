/** MTIP — error taxonomy. */
export class MultiModalError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  constructor(code: string, message: string, retryable = false) {
    super(message);
    this.name = "MultiModalError";
    this.code = code;
    this.retryable = retryable;
  }
}
export class MultiModalValidationError extends MultiModalError {
  constructor(message: string) {
    super("multimodal_validation_error", message, false);
  }
}
export class MultiModalNotFoundError extends MultiModalError {
  constructor(kind: string, id: string) {
    super("multimodal_not_found", `${kind} not found: ${id}`, false);
  }
}
export class MultiModalCapabilityUnsupportedError extends MultiModalError {
  constructor(providerId: string, capability: string) {
    super(
      "multimodal_capability_unsupported",
      `provider ${providerId} does not support ${capability}`,
      false,
    );
  }
}
export class MultiModalProviderUnavailableError extends MultiModalError {
  constructor(providerId: string, reason = "provider is not functional in this build") {
    super("multimodal_provider_unavailable", `${providerId}: ${reason}`, true);
  }
}
export class MultiModalNormalizationError extends MultiModalError {
  constructor(message: string) {
    super("multimodal_normalization_error", message, false);
  }
}
export class MultiModalResolutionError extends MultiModalError {
  constructor(capability: string) {
    super(
      "multimodal_no_connector",
      `no enabled connector provides capability: ${capability}`,
      false,
    );
  }
}
