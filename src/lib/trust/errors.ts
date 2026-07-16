/**
 * Trust & Evidence Engine — error hierarchy.
 * Every runtime failure is a subclass of TrustError so callers can discriminate.
 */
export class TrustError extends Error {
  readonly code: string;
  readonly meta: Readonly<Record<string, unknown>>;
  constructor(code: string, message: string, meta: Record<string, unknown> = {}) {
    super(message);
    this.name = "TrustError";
    this.code = code;
    this.meta = Object.freeze({ ...meta });
  }
}
export class EvidenceValidationError extends TrustError {
  constructor(message: string, meta: Record<string, unknown> = {}) {
    super("EVIDENCE_INVALID", message, meta);
    this.name = "EvidenceValidationError";
  }
}
export class SourceValidationError extends TrustError {
  constructor(message: string, meta: Record<string, unknown> = {}) {
    super("SOURCE_INVALID", message, meta);
    this.name = "SourceValidationError";
  }
}
export class UnknownSourceError extends TrustError {
  constructor(sourceId: string) {
    super("SOURCE_UNKNOWN", `Unknown source: ${sourceId}`, { sourceId });
    this.name = "UnknownSourceError";
  }
}
export class UnknownEvidenceError extends TrustError {
  constructor(evidenceId: string) {
    super("EVIDENCE_UNKNOWN", `Unknown evidence: ${evidenceId}`, { evidenceId });
    this.name = "UnknownEvidenceError";
  }
}
export class ConflictError extends TrustError {
  constructor(message: string, meta: Record<string, unknown> = {}) {
    super("CONFLICT", message, meta);
    this.name = "ConflictError";
  }
}
export class TrustPolicyError extends TrustError {
  constructor(message: string, meta: Record<string, unknown> = {}) {
    super("POLICY", message, meta);
    this.name = "TrustPolicyError";
  }
}
