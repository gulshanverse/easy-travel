/**
 * IAM Platform — Password Platform.
 * Hashing is abstracted behind `PasswordHasher`; bcrypt/Argon2 adapters can be
 * injected without touching this module. Plain passwords are never stored,
 * logged, returned or placed in events.
 */
import type { PasswordConfig } from "./config";
import { pbkdf2, randomBytes, sha256, timingSafeEqual, toBase64Url, fromBase64Url } from "./crypto";
import { PasswordPolicyError, PasswordReuseError } from "./errors";
import type { PasswordHistoryEntry } from "./types";

/* ------------------------------------------------------------------ */
/* Hashing                                                             */
/* ------------------------------------------------------------------ */

export interface PasswordHasher {
  readonly algorithm: string;
  hash(password: string): Promise<string>;
  verify(password: string, stored: string): Promise<boolean>;
  /** True when `stored` was produced by weaker parameters and should be rehashed. */
  needsRehash(stored: string): boolean;
}

/** Default Edge-compatible hasher (PBKDF2-HMAC-SHA256). */
export class Pbkdf2PasswordHasher implements PasswordHasher {
  readonly algorithm = "pbkdf2-sha256";
  constructor(private readonly iterations = 210_000) {}

  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const derived = await pbkdf2(password, salt, this.iterations);
    return `${this.algorithm}$${this.iterations}$${toBase64Url(salt)}$${toBase64Url(derived)}`;
  }

  async verify(password: string, stored: string): Promise<boolean> {
    const [alg, iter, salt, digest] = stored.split("$");
    if (alg !== this.algorithm || !iter || !salt || !digest) return false;
    const derived = await pbkdf2(password, fromBase64Url(salt), Number(iter));
    return timingSafeEqual(toBase64Url(derived), digest);
  }

  needsRehash(stored: string): boolean {
    const [alg, iter] = stored.split("$");
    return alg !== this.algorithm || Number(iter) < this.iterations;
  }
}

/**
 * Contract for externally provided bcrypt/Argon2 implementations. Adapters
 * implement this and are injected at composition time; IAM never bundles a
 * native hashing dependency.
 */
export interface ExternalHasherAdapter {
  readonly algorithm: "bcrypt" | "argon2id";
  hashRaw(password: string): Promise<string>;
  verifyRaw(password: string, stored: string): Promise<boolean>;
}

export class AdapterPasswordHasher implements PasswordHasher {
  readonly algorithm: string;
  constructor(private readonly adapter: ExternalHasherAdapter) {
    this.algorithm = adapter.algorithm;
  }
  hash(password: string): Promise<string> {
    return this.adapter.hashRaw(password);
  }
  verify(password: string, stored: string): Promise<boolean> {
    return this.adapter.verifyRaw(password, stored);
  }
  needsRehash(stored: string): boolean {
    return !stored.startsWith(this.algorithm);
  }
}

/* ------------------------------------------------------------------ */
/* Policy, validation and strength                                     */
/* ------------------------------------------------------------------ */

export interface PasswordValidationResult {
  readonly valid: boolean;
  readonly violations: readonly string[];
  readonly strength: PasswordStrength;
}

export interface PasswordStrength {
  readonly score: number;
  readonly label: "very_weak" | "weak" | "fair" | "strong" | "very_strong";
  readonly entropyBits: number;
}

/** Deterministic strength analyser — no dictionaries, no network. */
export function analyzePasswordStrength(password: string): PasswordStrength {
  const classes =
    (/[a-z]/.test(password) ? 26 : 0) +
    (/[A-Z]/.test(password) ? 26 : 0) +
    (/\d/.test(password) ? 10 : 0) +
    (/[^A-Za-z0-9]/.test(password) ? 32 : 0);
  const entropyBits = classes > 0 ? Math.round(password.length * Math.log2(classes)) : 0;
  const unique = new Set(password).size;
  const repeatPenalty = password.length > 0 && unique / password.length < 0.5 ? 15 : 0;
  const sequential = /(?:abc|bcd|cde|123|234|345|qwe|asd)/i.test(password) ? 10 : 0;
  const score = Math.max(0, Math.min(100, entropyBits - repeatPenalty - sequential));
  const label: PasswordStrength["label"] =
    score < 25 ? "very_weak" : score < 45 ? "weak" : score < 65 ? "fair" : score < 90 ? "strong" : "very_strong";
  return Object.freeze({ score, label, entropyBits });
}

export interface BreachCheckPort {
  /** Provider-independent breach lookup. Returns occurrence count. */
  occurrences(passwordSha256: string): Promise<number>;
}

export class PasswordValidator {
  constructor(
    private readonly policy: PasswordConfig,
    private readonly breachCheck?: BreachCheckPort,
  ) {}

  validate(password: string): PasswordValidationResult {
    const v: string[] = [];
    if (password.length < this.policy.minLength)
      v.push(`must be at least ${this.policy.minLength} characters`);
    if (password.length > this.policy.maxLength)
      v.push(`must be at most ${this.policy.maxLength} characters`);
    if (this.policy.requireUppercase && !/[A-Z]/.test(password)) v.push("must contain an uppercase letter");
    if (this.policy.requireLowercase && !/[a-z]/.test(password)) v.push("must contain a lowercase letter");
    if (this.policy.requireDigit && !/\d/.test(password)) v.push("must contain a digit");
    if (this.policy.requireSymbol && !/[^A-Za-z0-9]/.test(password))
      v.push("must contain a symbol");
    return Object.freeze({
      valid: v.length === 0,
      violations: Object.freeze(v),
      strength: analyzePasswordStrength(password),
    });
  }

  assert(password: string): void {
    const result = this.validate(password);
    if (!result.valid)
      throw new PasswordPolicyError(`password rejected: ${result.violations.join("; ")}`, {
        violations: result.violations,
      });
  }

  async assertNotBreached(password: string): Promise<void> {
    if (!this.policy.breachCheckEnabled || !this.breachCheck) return;
    const count = await this.breachCheck.occurrences(await sha256(password));
    if (count > 0)
      throw new PasswordPolicyError("password appears in a known breach corpus", { count });
  }
}

/** Reuse protection over the persisted password history. */
export async function assertNoReuse(
  password: string,
  history: readonly PasswordHistoryEntry[],
  hasher: PasswordHasher,
  depth: number,
): Promise<void> {
  const recent = [...history].sort((a, b) => b.createdAt - a.createdAt).slice(0, depth);
  for (const entry of recent) {
    if (await hasher.verify(password, entry.hash)) throw new PasswordReuseError(depth);
  }
}

export function passwordExpiresAt(changedAt: number, policy: PasswordConfig): number | null {
  return policy.expirationDays === null ? null : changedAt + policy.expirationDays * 86_400_000;
}

export function isPasswordExpired(changedAt: number | null, policy: PasswordConfig, at: number): boolean {
  if (changedAt === null || policy.expirationDays === null) return false;
  return at >= changedAt + policy.expirationDays * 86_400_000;
}
