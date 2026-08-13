import { redact } from "./security";

export type GatewayErrorCode =
  | "provider_unavailable" | "provider_timeout" | "provider_rate_limited"
  | "provider_unauthorized" | "provider_forbidden" | "provider_invalid_request"
  | "provider_not_found" | "provider_conflict" | "provider_capacity_exceeded"
  | "provider_temporary_failure" | "provider_permanent_failure" | "provider_schema_mismatch"
  | "provider_unsupported_capability" | "provider_credential_failure" | "provider_budget_exceeded"
  | "provider_circuit_open" | "provider_security_violation" | "provider_concurrency_exceeded"
  | "provider_error";

export class ProviderGatewayError extends Error {
  readonly code: GatewayErrorCode;
  readonly retryable: boolean;
  readonly providerId?: string;
  readonly capability?: string;
  constructor(message: string, code: GatewayErrorCode = "provider_error", retryable = false, ctx: { providerId?: string; capability?: string } = {}) {
    super(redact(message));
    this.name = new.target.name;
    this.code = code;
    this.retryable = retryable;
    if (ctx.providerId) this.providerId = ctx.providerId;
    if (ctx.capability) this.capability = ctx.capability;
  }
}

const mk = (code: GatewayErrorCode, retryable: boolean) => class extends ProviderGatewayError {
  constructor(message: string, ctx: { providerId?: string; capability?: string } = {}) {
    super(message, code, retryable, ctx);
  }
};

export const ProviderUnavailableError = mk("provider_unavailable", true);
export const ProviderTimeoutError = mk("provider_timeout", true);
export const ProviderRateLimitedError = mk("provider_rate_limited", true);
export const ProviderUnauthorizedError = mk("provider_unauthorized", false);
export const ProviderForbiddenError = mk("provider_forbidden", false);
export const ProviderInvalidRequestError = mk("provider_invalid_request", false);
export const ProviderNotFoundError = mk("provider_not_found", false);
export const ProviderConflictError = mk("provider_conflict", false);
export const ProviderCapacityExceededError = mk("provider_capacity_exceeded", true);
export const ProviderTemporaryFailureError = mk("provider_temporary_failure", true);
export const ProviderPermanentFailureError = mk("provider_permanent_failure", false);
export const ProviderSchemaMismatchError = mk("provider_schema_mismatch", false);
export const ProviderUnsupportedCapabilityError = mk("provider_unsupported_capability", false);
export const ProviderCredentialFailureError = mk("provider_credential_failure", false);
export const ProviderBudgetExceededError = mk("provider_budget_exceeded", false);
export const ProviderCircuitOpenError = mk("provider_circuit_open", true);
export const ProviderSecurityViolationError = mk("provider_security_violation", false);
export const ProviderConcurrencyExceededError = mk("provider_concurrency_exceeded", true);

export function normalizeProviderError(input: { status?: number; code?: string; message?: string }, ctx: { providerId?: string; capability?: string } = {}): ProviderGatewayError {
  const msg = redact(input.message ?? input.code ?? "provider failure");
  const status = input.status ?? 0;
  if (status === 400) return new ProviderInvalidRequestError(msg, ctx);
  if (status === 401) return new ProviderUnauthorizedError(msg, ctx);
  if (status === 403) return new ProviderForbiddenError(msg, ctx);
  if (status === 404) return new ProviderNotFoundError(msg, ctx);
  if (status === 408) return new ProviderTimeoutError(msg, ctx);
  if (status === 409) return new ProviderConflictError(msg, ctx);
  if (status === 422) return new ProviderSchemaMismatchError(msg, ctx);
  if (status === 429) return new ProviderRateLimitedError(msg, ctx);
  if (status === 503) return new ProviderUnavailableError(msg, ctx);
  if (status === 507) return new ProviderCapacityExceededError(msg, ctx);
  if (status >= 500) return new ProviderTemporaryFailureError(msg, ctx);
  switch (input.code) {
    case "timeout": return new ProviderTimeoutError(msg, ctx);
    case "unavailable": return new ProviderUnavailableError(msg, ctx);
    case "rate_limited": return new ProviderRateLimitedError(msg, ctx);
    case "credential": return new ProviderCredentialFailureError(msg, ctx);
    default: return new ProviderPermanentFailureError(msg, ctx);
  }
}

export const normalizeProviderFailure = normalizeProviderError;
export function isRetryable(err: unknown): boolean {
  return err instanceof ProviderGatewayError && err.retryable;
}
