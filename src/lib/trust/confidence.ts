/**
 * Trust & Evidence Engine — confidence engine.
 * Deterministic aggregation across evidence count, agreement, freshness,
 * source quality, consistency and completeness.
 */
import type { TrustConfig } from "./config";
import type { Evidence, EvidenceScore, TrustConfidence } from "./types";

export interface ConfidenceInput {
  readonly evidence: readonly Evidence[];
  readonly scores: readonly EvidenceScore[];
}

export function calculateConfidence(input: ConfidenceInput, cfg: TrustConfig): TrustConfidence {
  const n = input.evidence.length;
  if (n === 0) return Object.freeze({ value: 0, sampleSize: 0, agreement: 0 });
  const agreement = calculateAgreement(input.evidence);
  const freshMean = mean(input.scores.map((s) => s.freshness));
  const qualityMean = mean(input.scores.map((s) => s.overall));
  const completeness = Math.min(1, n / Math.max(3, cfg.minEvidencePerBundle * 3));
  const sampleFactor = 1 - Math.exp(-n / 4); // grows fast, saturates
  const raw = 0.35 * agreement + 0.25 * qualityMean + 0.2 * freshMean + 0.1 * completeness + 0.1 * sampleFactor;
  const value = clamp01(raw);
  return Object.freeze({ value, sampleSize: n, agreement });
}

export function calculateAgreement(evidence: readonly Evidence[]): number {
  if (evidence.length < 2) return 1;
  const counts = new Map<string, number>();
  for (const e of evidence) counts.set(e.claim, (counts.get(e.claim) ?? 0) + 1);
  const majority = Math.max(...counts.values());
  return majority / evidence.length;
}

function mean(xs: readonly number[]): number {
  if (!xs.length) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}
function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
