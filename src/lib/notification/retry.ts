/**
 * NCP — retry policy. Exponential backoff with deterministic jitter derived
 * from a stable hash, so replays produce identical schedules.
 */
import type { RetryConfig } from "./config";
import { fingerprint } from "./ids";
import type { FailureKind } from "./types";

export const RETRYABLE_FAILURES: readonly FailureKind[] = Object.freeze([
  "transient",
  "throttled",
  "provider_error",
]);

export function isRetryable(kind: FailureKind): boolean {
  return RETRYABLE_FAILURES.includes(kind);
}

/** Deterministic jitter in [-ratio, +ratio] derived from the seed. */
export function jitterFactor(seed: string, ratio: number): number {
  if (ratio <= 0) return 1;
  const hash = parseInt(fingerprint(seed), 16);
  const normalized = (hash % 1000) / 1000; // [0,1)
  return 1 + (normalized * 2 - 1) * ratio;
}

export function backoffDelayMs(config: RetryConfig, attempt: number, seed: string): number {
  const exponent = Math.max(0, attempt - 1);
  const raw = config.baseDelayMs * Math.pow(config.factor, exponent);
  const jittered = raw * jitterFactor(`${seed}:${attempt}`, config.jitterRatio);
  return Math.min(config.maxDelayMs, Math.max(0, Math.round(jittered)));
}

export interface RetryDecision {
  readonly retry: boolean;
  readonly nextAttemptAt: number | null;
  readonly attempt: number;
  readonly reason: string;
}

export function decideRetry(input: {
  config: RetryConfig;
  attempt: number;
  failureKind: FailureKind;
  at: number;
  seed: string;
}): RetryDecision {
  if (!isRetryable(input.failureKind)) {
    return Object.freeze({
      retry: false,
      nextAttemptAt: null,
      attempt: input.attempt,
      reason: `permanent failure (${input.failureKind})`,
    });
  }
  if (input.attempt >= input.config.maxAttempts) {
    return Object.freeze({
      retry: false,
      nextAttemptAt: null,
      attempt: input.attempt,
      reason: "max attempts exhausted",
    });
  }
  const delay = backoffDelayMs(input.config, input.attempt, input.seed);
  return Object.freeze({
    retry: true,
    nextAttemptAt: input.at + delay,
    attempt: input.attempt + 1,
    reason: `retry in ${delay}ms`,
  });
}
