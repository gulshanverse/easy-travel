/**
 * Trust & Evidence Engine — trust policies.
 * A policy transforms a raw score into a level, threshold and explanation.
 * Policies are pure; no I/O.
 */
import type { TrustConfig } from "./config";
import type { TrustLevel, TrustReason } from "./types";

export interface TrustPolicy {
  readonly id: string;
  readonly description: string;
  readonly threshold: number;
  readonly requiredLevel: TrustLevel;
}

export const DEFAULT_POLICIES: readonly TrustPolicy[] = Object.freeze([
  Object.freeze({ id: "policy.default", description: "Default trust policy", threshold: 0.5, requiredLevel: "medium" }),
  Object.freeze({ id: "policy.strict",  description: "Booking-critical trust", threshold: 0.9, requiredLevel: "verified" }),
  Object.freeze({ id: "policy.lax",     description: "Exploration / discovery", threshold: 0.25, requiredLevel: "low" }),
]);

export function levelFor(score: number, cfg: TrustConfig): TrustLevel {
  const { thresholds } = cfg;
  if (score >= thresholds.verified) return "verified";
  if (score >= thresholds.high) return "high";
  if (score >= thresholds.medium) return "medium";
  if (score >= thresholds.low) return "low";
  return "unknown";
}

export function levelSatisfies(actual: TrustLevel, required: TrustLevel): boolean {
  const order: Record<TrustLevel, number> = { unknown: 0, low: 1, medium: 2, high: 3, verified: 4 };
  return order[actual] >= order[required];
}

export function policyReasons(score: number, policy: TrustPolicy, cfg: TrustConfig): {
  reasons: readonly TrustReason[];
  antiReasons: readonly TrustReason[];
} {
  const level = levelFor(score, cfg);
  const reasons: TrustReason[] = [];
  const antiReasons: TrustReason[] = [];
  if (score >= policy.threshold) {
    reasons.push({ code: "policy.threshold.met", message: `Score ${score.toFixed(3)} >= ${policy.threshold}`, weight: 1 });
  } else {
    antiReasons.push({ code: "policy.threshold.miss", message: `Score ${score.toFixed(3)} < ${policy.threshold}`, weight: 1 });
  }
  if (!levelSatisfies(level, policy.requiredLevel)) {
    antiReasons.push({ code: "policy.level.miss", message: `Level ${level} < required ${policy.requiredLevel}`, weight: 1 });
  }
  return { reasons: Object.freeze(reasons), antiReasons: Object.freeze(antiReasons) };
}
