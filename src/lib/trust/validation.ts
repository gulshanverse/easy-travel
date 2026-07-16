/**
 * Trust & Evidence Engine — structural validators.
 * Deterministic checks; throw typed errors so callers can discriminate.
 */
import { EvidenceValidationError, SourceValidationError } from "./errors";
import type { Evidence, EvidenceSource } from "./types";

function ensureRatio(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new SourceValidationError(`${name} must be within [0,1]`, { value });
  }
}

export function validateSource(source: EvidenceSource): void {
  if (!source.id) throw new SourceValidationError("Source id required");
  if (!source.name) throw new SourceValidationError("Source name required");
  ensureRatio("authority", source.authority);
  ensureRatio("reliability", source.reliability);
  if (!source.version) throw new SourceValidationError("Source version required");
}

export function validateEvidence(evidence: Evidence, knownSourceIds: ReadonlySet<string>): void {
  if (!evidence.id) throw new EvidenceValidationError("Evidence id required");
  if (!evidence.subject) throw new EvidenceValidationError("Evidence subject required");
  if (!evidence.claim) throw new EvidenceValidationError("Evidence claim required");
  if (!knownSourceIds.has(evidence.sourceId)) {
    throw new EvidenceValidationError("Evidence references unknown source", { sourceId: evidence.sourceId });
  }
  if (evidence.validFrom && evidence.validUntil && evidence.validFrom > evidence.validUntil) {
    throw new EvidenceValidationError("Evidence validity window inverted");
  }
  if (evidence.version < 1) {
    throw new EvidenceValidationError("Evidence version must be >= 1");
  }
}
