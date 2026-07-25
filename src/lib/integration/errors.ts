/** IPCF — error hierarchy. */
export class IntegrationError extends Error {
  constructor(message: string, readonly code: string = "integration_error") {
    super(message);
    this.name = "IntegrationError";
  }
}
export class IntegrationValidationError extends IntegrationError {
  constructor(m: string) { super(m, "integration_validation_error"); this.name = "IntegrationValidationError"; }
}
export class IntegrationNotFoundError extends IntegrationError {
  constructor(kind: string, id: string) { super(`${kind} not found: ${id}`, "integration_not_found"); this.name = "IntegrationNotFoundError"; }
}
export class IntegrationLifecycleError extends IntegrationError {
  constructor(m: string) { super(m, "integration_lifecycle_error"); this.name = "IntegrationLifecycleError"; }
}
export class IntegrationDuplicateError extends IntegrationError {
  constructor(m: string) { super(m, "integration_duplicate"); this.name = "IntegrationDuplicateError"; }
}
export class IntegrationAuthenticationError extends IntegrationError {
  constructor(m: string) { super(m, "integration_auth_error"); this.name = "IntegrationAuthenticationError"; }
}
export class IntegrationTransformationError extends IntegrationError {
  constructor(m: string) { super(m, "integration_transform_error"); this.name = "IntegrationTransformationError"; }
}
export class IntegrationNormalizationError extends IntegrationError {
  constructor(m: string) { super(m, "integration_normalization_error"); this.name = "IntegrationNormalizationError"; }
}
export class IntegrationRateLimitError extends IntegrationError {
  constructor(m: string) { super(m, "integration_rate_limit"); this.name = "IntegrationRateLimitError"; }
}
export class IntegrationCircuitOpenError extends IntegrationError {
  constructor(m: string) { super(m, "integration_circuit_open"); this.name = "IntegrationCircuitOpenError"; }
}
export class IntegrationPolicyError extends IntegrationError {
  constructor(m: string) { super(m, "integration_policy_error"); this.name = "IntegrationPolicyError"; }
}
export class IntegrationVersionError extends IntegrationError {
  constructor(m: string) { super(m, "integration_version_error"); this.name = "IntegrationVersionError"; }
}
export class IntegrationDependencyError extends IntegrationError {
  constructor(m: string) { super(m, "integration_dependency_error"); this.name = "IntegrationDependencyError"; }
}
export class IntegrationExecutionError extends IntegrationError {
  constructor(m: string) { super(m, "integration_execution_error"); this.name = "IntegrationExecutionError"; }
}
export class IntegrationTimeoutError extends IntegrationError {
  constructor(m: string) { super(m, "integration_timeout"); this.name = "IntegrationTimeoutError"; }
}
