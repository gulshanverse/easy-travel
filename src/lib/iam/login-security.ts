/**
 * IAM Platform — Login Security: attempts, lockout, brute-force protection,
 * rate limiting and deterministic risk scoring.
 */
import type { LoginSecurityConfig } from "./config";
import { newLoginAttemptId } from "./ids";
import type { CollectionStore } from "./stores";
import type { AuthenticationMethod, LoginAttempt } from "./types";

export interface RiskSignals {
  readonly newDevice: boolean;
  readonly untrustedDevice: boolean;
  readonly newCountry: boolean;
  readonly recentFailures: number;
  readonly guest: boolean;
}

export interface RiskAssessment {
  readonly score: number;
  readonly suspicious: boolean;
  readonly factors: readonly string[];
}

/** Deterministic, explainable risk score in [0,100]. */
export function assessRisk(signals: RiskSignals, threshold: number): RiskAssessment {
  const factors: string[] = [];
  let score = 0;
  if (signals.newDevice) {
    score += 25;
    factors.push("new device");
  }
  if (signals.untrustedDevice) {
    score += 15;
    factors.push("untrusted device");
  }
  if (signals.newCountry) {
    score += 30;
    factors.push("new country");
  }
  if (signals.recentFailures > 0) {
    score += Math.min(30, signals.recentFailures * 10);
    factors.push(`${signals.recentFailures} recent failure(s)`);
  }
  if (signals.guest) {
    score += 5;
    factors.push("guest session");
  }
  score = Math.min(100, score);
  return Object.freeze({ score, suspicious: score >= threshold, factors: Object.freeze(factors) });
}

export interface LockoutState {
  readonly locked: boolean;
  readonly until: number | null;
  readonly failures: number;
}

export class LoginSecurityManager {
  private readonly rateWindow = new Map<string, number[]>();

  constructor(
    private readonly config: LoginSecurityConfig,
    private readonly attempts: CollectionStore<LoginAttempt>,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async record(input: {
    identifier: string;
    userId: string | null;
    success: boolean;
    method: AuthenticationMethod;
    reason?: string | null;
    riskScore?: number;
    ip?: string | null;
    country?: string | null;
    deviceFingerprint?: string | null;
  }): Promise<LoginAttempt> {
    const attempt: LoginAttempt = Object.freeze({
      id: newLoginAttemptId(),
      identifier: input.identifier,
      userId: input.userId,
      success: input.success,
      method: input.method,
      reason: input.reason ?? null,
      riskScore: input.riskScore ?? 0,
      ip: input.ip ?? null,
      country: input.country ?? null,
      deviceFingerprint: input.deviceFingerprint ?? null,
      at: this.now(),
    });
    await this.attempts.put(attempt);
    return attempt;
  }

  async recentFailures(identifier: string, at: number = this.now()): Promise<number> {
    const window = at - this.config.attemptWindowMs;
    const rows = await this.attempts.where(
      (a) => a.identifier === identifier && !a.success && a.at >= window,
    );
    return rows.length;
  }

  async lockoutState(identifier: string, at: number = this.now()): Promise<LockoutState> {
    const failures = await this.recentFailures(identifier, at);
    if (failures < this.config.maxFailedAttempts)
      return Object.freeze({ locked: false, until: null, failures });
    const last = (await this.attempts.where((a) => a.identifier === identifier && !a.success))
      .map((a) => a.at)
      .reduce((max, v) => Math.max(max, v), 0);
    const until = last + this.config.lockoutDurationMs;
    return Object.freeze({ locked: at < until, until, failures });
  }

  /** Fixed-window rate limiter keyed by identifier or IP. */
  rateLimit(key: string, at: number = this.now()): boolean {
    const window = at - 60_000;
    const hits = (this.rateWindow.get(key) ?? []).filter((t) => t > window);
    if (hits.length >= this.config.rateLimitPerMinute) {
      this.rateWindow.set(key, hits);
      return false;
    }
    hits.push(at);
    this.rateWindow.set(key, hits);
    return true;
  }

  async attemptsFor(identifier: string): Promise<readonly LoginAttempt[]> {
    return [...(await this.attempts.where((a) => a.identifier === identifier))].sort(
      (a, b) => b.at - a.at,
    );
  }

  async knownCountries(userId: string): Promise<readonly string[]> {
    const rows = await this.attempts.where((a) => a.userId === userId && a.success && a.country !== null);
    return Object.freeze([...new Set(rows.map((r) => r.country as string))]);
  }
}
