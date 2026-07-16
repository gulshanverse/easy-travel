/**
 * Trust & Evidence Engine — configuration & defaults.
 * All tuning knobs are declared here so behavior is deterministic.
 */
export interface TrustConfig {
  readonly freshnessHalfLifeMs: number;
  readonly defaultValidityWindowMs: number;
  readonly minEvidencePerBundle: number;
  readonly maxEvidencePerBundle: number;
  readonly conflictAgreementThreshold: number;
  readonly thresholds: {
    readonly low: number;
    readonly medium: number;
    readonly high: number;
    readonly verified: number;
  };
  readonly weights: {
    readonly quality: number;
    readonly freshness: number;
    readonly reliability: number;
    readonly authority: number;
    readonly agreement: number;
  };
  readonly maxHistoryPerSubject: number;
  readonly maxSnapshotSize: number;
}

export const DEFAULT_TRUST_CONFIG: TrustConfig = Object.freeze({
  freshnessHalfLifeMs: 1000 * 60 * 60 * 24 * 7, // 7 days
  defaultValidityWindowMs: 1000 * 60 * 60 * 24 * 30, // 30 days
  minEvidencePerBundle: 1,
  maxEvidencePerBundle: 256,
  conflictAgreementThreshold: 0.6,
  thresholds: { low: 0.25, medium: 0.5, high: 0.75, verified: 0.9 },
  weights: { quality: 0.2, freshness: 0.25, reliability: 0.2, authority: 0.15, agreement: 0.2 },
  maxHistoryPerSubject: 256,
  maxSnapshotSize: 4096,
});

export function mergeConfig(partial?: Partial<TrustConfig>): TrustConfig {
  if (!partial) return DEFAULT_TRUST_CONFIG;
  return {
    ...DEFAULT_TRUST_CONFIG,
    ...partial,
    thresholds: { ...DEFAULT_TRUST_CONFIG.thresholds, ...(partial.thresholds ?? {}) },
    weights: { ...DEFAULT_TRUST_CONFIG.weights, ...(partial.weights ?? {}) },
  };
}
