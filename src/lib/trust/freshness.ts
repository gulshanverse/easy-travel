/**
 * Trust & Evidence Engine — freshness / recency evaluator.
 * Deterministic exponential half-life decay, bounded [0,1].
 */
import type { TrustConfig } from "./config";
import type { Evidence } from "./types";

export interface FreshnessResult {
  readonly ageMs: number;
  readonly score: number;    // 0..1
  readonly stale: boolean;
  readonly expired: boolean;
}

export function evaluateFreshness(evidence: Evidence, cfg: TrustConfig, now: number): FreshnessResult {
  const ageMs = Math.max(0, now - evidence.collectedAt);
  const halfLife = cfg.freshnessHalfLifeMs;
  const decay = Math.pow(0.5, ageMs / halfLife);
  const score = Math.min(1, Math.max(0, decay));
  const expiresAt = evidence.validUntil ?? evidence.collectedAt + cfg.defaultValidityWindowMs;
  const expired = now > expiresAt;
  const stale = score < 0.25 || expired;
  return { ageMs, score: expired ? 0 : score, stale, expired };
}
