/**
 * Trust & Evidence Engine — per-evidence quality scoring.
 * Combines source authority/reliability with freshness into an overall score.
 */
import type { TrustConfig } from "./config";
import { evaluateFreshness } from "./freshness";
import type { Evidence, EvidenceScore, EvidenceSource } from "./types";

export function scoreEvidence(
  evidence: Evidence,
  source: EvidenceSource,
  cfg: TrustConfig,
  now: number,
): EvidenceScore {
  const fresh = evaluateFreshness(evidence, cfg, now);
  const authority = clamp01(source.authority);
  const reliability = clamp01(source.reliability);
  const quality = clamp01(0.4 * authority + 0.4 * reliability + 0.2 * fresh.score);
  const w = cfg.weights;
  const denom = w.quality + w.freshness + w.reliability + w.authority || 1;
  const overall = clamp01(
    (quality * w.quality + fresh.score * w.freshness + reliability * w.reliability + authority * w.authority) / denom,
  );
  return Object.freeze({
    evidenceId: evidence.id,
    quality,
    freshness: fresh.score,
    reliability,
    authority,
    overall,
  });
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
