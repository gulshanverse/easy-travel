/**
 * IAM Platform — immutable configuration with production assertions.
 */
import { IamConfigError } from "./errors";

export interface PasswordConfig {
  readonly minLength: number;
  readonly maxLength: number;
  readonly requireUppercase: boolean;
  readonly requireLowercase: boolean;
  readonly requireDigit: boolean;
  readonly requireSymbol: boolean;
  readonly expirationDays: number | null;
  readonly historyDepth: number;
  readonly breachCheckEnabled: boolean;
  readonly resetTokenTtlMs: number;
}

export interface TokenConfig {
  readonly accessTtlMs: number;
  readonly refreshTtlMs: number;
  readonly rotateRefreshOnUse: boolean;
  readonly issuer: string;
  readonly audience: string;
  readonly format: "jwt" | "opaque";
  readonly clockSkewMs: number;
}

export interface SessionConfig {
  readonly idleTimeoutMs: number;
  readonly absoluteTimeoutMs: number;
  readonly slidingExpiration: boolean;
  readonly maxConcurrentSessions: number;
  readonly rememberMeTtlMs: number;
  readonly guestTtlMs: number;
  readonly reauthenticationWindowMs: number;
}

export interface LoginSecurityConfig {
  readonly maxFailedAttempts: number;
  readonly lockoutDurationMs: number;
  readonly attemptWindowMs: number;
  readonly rateLimitPerMinute: number;
  readonly suspiciousRiskThreshold: number;
}

export interface IamConfig {
  readonly environment: "development" | "test" | "production";
  readonly password: PasswordConfig;
  readonly token: TokenConfig;
  readonly session: SessionConfig;
  readonly loginSecurity: LoginSecurityConfig;
  readonly mfaRequired: boolean;
  readonly auditEnabled: boolean;
  /** Persisted stores are mandatory outside development/test. */
  readonly persistenceRequired: boolean;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const DEFAULT_IAM_CONFIG: IamConfig = Object.freeze({
  environment: "development",
  password: Object.freeze({
    minLength: 12,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireDigit: true,
    requireSymbol: false,
    expirationDays: null,
    historyDepth: 5,
    breachCheckEnabled: false,
    resetTokenTtlMs: HOUR,
  }),
  token: Object.freeze({
    accessTtlMs: 15 * MINUTE,
    refreshTtlMs: 30 * DAY,
    rotateRefreshOnUse: true,
    issuer: "easytrip.iam",
    audience: "easytrip.app",
    format: "jwt" as const,
    clockSkewMs: 30_000,
  }),
  session: Object.freeze({
    idleTimeoutMs: 30 * MINUTE,
    absoluteTimeoutMs: 12 * HOUR,
    slidingExpiration: true,
    maxConcurrentSessions: 5,
    rememberMeTtlMs: 30 * DAY,
    guestTtlMs: 2 * HOUR,
    reauthenticationWindowMs: 5 * MINUTE,
  }),
  loginSecurity: Object.freeze({
    maxFailedAttempts: 5,
    lockoutDurationMs: 15 * MINUTE,
    attemptWindowMs: 15 * MINUTE,
    rateLimitPerMinute: 30,
    suspiciousRiskThreshold: 70,
  }),
  mfaRequired: false,
  auditEnabled: true,
  persistenceRequired: false,
});

function freezeDeep<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) freezeDeep(v);
    Object.freeze(value);
  }
  return value;
}

export function createIamConfig(patch: Partial<IamConfig> = {}): IamConfig {
  const cfg: IamConfig = {
    ...DEFAULT_IAM_CONFIG,
    ...patch,
    password: { ...DEFAULT_IAM_CONFIG.password, ...(patch.password ?? {}) },
    token: { ...DEFAULT_IAM_CONFIG.token, ...(patch.token ?? {}) },
    session: { ...DEFAULT_IAM_CONFIG.session, ...(patch.session ?? {}) },
    loginSecurity: { ...DEFAULT_IAM_CONFIG.loginSecurity, ...(patch.loginSecurity ?? {}) },
  };
  validateIamConfig(cfg);
  return freezeDeep(cfg);
}

export function validateIamConfig(cfg: IamConfig): void {
  if (cfg.password.minLength < 8)
    throw new IamConfigError("password.minLength must be at least 8");
  if (cfg.password.maxLength <= cfg.password.minLength)
    throw new IamConfigError("password.maxLength must exceed minLength");
  if (cfg.token.accessTtlMs <= 0 || cfg.token.refreshTtlMs <= 0)
    throw new IamConfigError("token TTLs must be positive");
  if (cfg.token.refreshTtlMs <= cfg.token.accessTtlMs)
    throw new IamConfigError("refresh TTL must exceed access TTL");
  if (cfg.session.maxConcurrentSessions < 1)
    throw new IamConfigError("session.maxConcurrentSessions must be >= 1");
  if (cfg.loginSecurity.maxFailedAttempts < 1)
    throw new IamConfigError("loginSecurity.maxFailedAttempts must be >= 1");
}

/** Production hardening: no ephemeral stores, rotation and audit mandatory. */
export function assertProductionIamConfig(cfg: IamConfig): void {
  validateIamConfig(cfg);
  if (cfg.environment !== "production") return;
  if (!cfg.persistenceRequired)
    throw new IamConfigError("production IAM requires persistenceRequired=true");
  if (!cfg.auditEnabled) throw new IamConfigError("production IAM requires auditEnabled=true");
  if (!cfg.token.rotateRefreshOnUse)
    throw new IamConfigError("production IAM requires refresh token rotation");
  if (cfg.password.minLength < 12)
    throw new IamConfigError("production IAM requires password.minLength >= 12");
}
