/**
 * IAM Platform — Identity Risk Platform.
 *
 * Deterministic, explainable and fully offline: no machine learning, no
 * external fraud provider, no network. Risk NEVER overrides authorization —
 * it produces a decision that security policies may consume (ADR-026).
 */
import { newRiskEvaluationId } from "./ids";
import type { CollectionStore } from "./stores";

export type RiskLevel = "none" | "low" | "medium" | "high" | "critical";

export type RiskSignalKind =
  | "unknown_device"
  | "untrusted_device"
  | "new_session"
  | "repeated_failed_login"
  | "suspicious_pattern"
  | "abnormal_movement"
  | "account_state"
  | "credential_age"
  | "guest_principal";

export interface RiskSignal {
  readonly kind: RiskSignalKind;
  readonly present: boolean;
  readonly weight: number;
  readonly detail: string;
}

export interface RiskReason {
  readonly kind: RiskSignalKind;
  readonly contribution: number;
  readonly detail: string;
}

export interface RiskMetadata {
  readonly ip: string | null;
  readonly country: string | null;
  readonly deviceFingerprint: string | null;
  readonly sessionId: string | null;
}

export const EMPTY_RISK_METADATA: RiskMetadata = Object.freeze({
  ip: null,
  country: null,
  deviceFingerprint: null,
  sessionId: null,
});

export interface RiskEvaluation {
  readonly id: string;
  readonly userId: string | null;
  readonly score: number;
  readonly level: RiskLevel;
  readonly reasons: readonly RiskReason[];
  readonly signals: readonly RiskSignal[];
  readonly metadata: RiskMetadata;
  readonly at: number;
}

/** Consumable, advisory outcome. Never an authorization result. */
export interface IdentityRiskDecision {
  readonly evaluation: RiskEvaluation;
  readonly requireMfa: boolean;
  readonly requireReauthentication: boolean;
  readonly blockRecommended: boolean;
}

export interface RiskThresholds {
  readonly low: number;
  readonly medium: number;
  readonly high: number;
  readonly critical: number;
  readonly mfaAt: number;
  readonly reauthAt: number;
  readonly blockAt: number;
}

export const DEFAULT_RISK_THRESHOLDS: RiskThresholds = Object.freeze({
  low: 1,
  medium: 30,
  high: 60,
  critical: 85,
  mfaAt: 45,
  reauthAt: 60,
  blockAt: 90,
});

export const RISK_WEIGHTS: Readonly<Record<RiskSignalKind, number>> = Object.freeze({
  unknown_device: 25,
  untrusted_device: 15,
  new_session: 5,
  repeated_failed_login: 10,
  suspicious_pattern: 20,
  abnormal_movement: 30,
  account_state: 20,
  credential_age: 10,
  guest_principal: 5,
});

export interface RiskInput {
  readonly userId: string | null;
  readonly unknownDevice?: boolean;
  readonly untrustedDevice?: boolean;
  readonly newSession?: boolean;
  /** Count of failures inside the configured window. */
  readonly recentFailures?: number;
  readonly suspiciousPattern?: boolean;
  readonly abnormalMovement?: boolean;
  /** Non-active account states raise risk without granting or denying access. */
  readonly accountStateAbnormal?: boolean;
  /** Age of the current credential in milliseconds. */
  readonly credentialAgeMs?: number | null;
  readonly credentialMaxAgeMs?: number | null;
  readonly guest?: boolean;
  readonly metadata?: Partial<RiskMetadata>;
}

export function levelFor(score: number, t: RiskThresholds = DEFAULT_RISK_THRESHOLDS): RiskLevel {
  if (score >= t.critical) return "critical";
  if (score >= t.high) return "high";
  if (score >= t.medium) return "medium";
  if (score >= t.low) return "low";
  return "none";
}

/** Pure function: identical inputs always produce an identical evaluation. */
export function evaluateIdentityRisk(
  input: RiskInput,
  at: number,
  thresholds: RiskThresholds = DEFAULT_RISK_THRESHOLDS,
): RiskEvaluation {
  const failures = input.recentFailures ?? 0;
  const credentialStale =
    input.credentialAgeMs != null &&
    input.credentialMaxAgeMs != null &&
    input.credentialAgeMs > input.credentialMaxAgeMs;

  const signals: RiskSignal[] = [
    sig("unknown_device", Boolean(input.unknownDevice), RISK_WEIGHTS.unknown_device, "device not seen before"),
    sig("untrusted_device", Boolean(input.untrustedDevice), RISK_WEIGHTS.untrusted_device, "device is not trusted"),
    sig("new_session", Boolean(input.newSession), RISK_WEIGHTS.new_session, "new session established"),
    sig(
      "repeated_failed_login",
      failures > 0,
      Math.min(30, failures * RISK_WEIGHTS.repeated_failed_login),
      `${failures} recent failed attempt(s)`,
    ),
    sig("suspicious_pattern", Boolean(input.suspiciousPattern), RISK_WEIGHTS.suspicious_pattern, "suspicious authentication pattern"),
    sig("abnormal_movement", Boolean(input.abnormalMovement), RISK_WEIGHTS.abnormal_movement, "abnormal session movement"),
    sig("account_state", Boolean(input.accountStateAbnormal), RISK_WEIGHTS.account_state, "account is not in the active state"),
    sig("credential_age", credentialStale, RISK_WEIGHTS.credential_age, "credential exceeds its maximum age"),
    sig("guest_principal", Boolean(input.guest), RISK_WEIGHTS.guest_principal, "guest principal"),
  ];

  const reasons = signals
    .filter((s) => s.present)
    .map((s) => Object.freeze({ kind: s.kind, contribution: s.weight, detail: s.detail }));
  const score = Math.min(100, reasons.reduce((sum, r) => sum + r.contribution, 0));

  return Object.freeze({
    id: newRiskEvaluationId(),
    userId: input.userId,
    score,
    level: levelFor(score, thresholds),
    reasons: Object.freeze(reasons),
    signals: Object.freeze(signals),
    metadata: Object.freeze({ ...EMPTY_RISK_METADATA, ...(input.metadata ?? {}) }),
    at,
  });
}

export function decideIdentityRisk(
  evaluation: RiskEvaluation,
  thresholds: RiskThresholds = DEFAULT_RISK_THRESHOLDS,
): IdentityRiskDecision {
  return Object.freeze({
    evaluation,
    requireMfa: evaluation.score >= thresholds.mfaAt,
    requireReauthentication: evaluation.score >= thresholds.reauthAt,
    blockRecommended: evaluation.score >= thresholds.blockAt,
  });
}

/** Persisted risk history, used for explainability and audit. */
export class IdentityRiskManager {
  constructor(
    private readonly store: CollectionStore<RiskEvaluation>,
    private readonly thresholds: RiskThresholds = DEFAULT_RISK_THRESHOLDS,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async evaluate(input: RiskInput): Promise<IdentityRiskDecision> {
    const evaluation = evaluateIdentityRisk(input, this.now(), this.thresholds);
    await this.store.put(evaluation);
    return decideIdentityRisk(evaluation, this.thresholds);
  }

  async historyFor(userId: string): Promise<readonly RiskEvaluation[]> {
    return [...(await this.store.where((r) => r.userId === userId))].sort((a, b) => b.at - a.at);
  }

  async count(): Promise<number> {
    return this.store.count();
  }
}

function sig(kind: RiskSignalKind, present: boolean, weight: number, detail: string): RiskSignal {
  return Object.freeze({ kind, present, weight, detail });
}
