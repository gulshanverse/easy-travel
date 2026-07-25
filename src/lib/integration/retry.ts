/** IPCF — retry scheduler with exponential backoff + optional jitter. */
import { newRetryId } from "./ids";
import type { ConnectorRetryPolicy } from "./types";

export interface RetryAttempt {
  readonly id: string;
  readonly attempt: number;
  readonly delayMs: number;
}
export interface RetryOutcome<T> {
  readonly value: T;
  readonly attempts: number;
}

export function computeBackoff(policy: ConnectorRetryPolicy, attempt: number): number {
  const raw = policy.baseDelayMs * 2 ** Math.max(0, attempt - 1);
  const capped = Math.min(policy.maxDelayMs, raw);
  if (!policy.jitter) return capped;
  const jitter = capped * 0.25;
  // deterministic pseudo-jitter based on attempt for testability
  const seed = ((attempt * 2654435761) >>> 0) / 0xffffffff;
  return Math.round(capped - jitter / 2 + seed * jitter);
}

export interface RetryOptions {
  readonly policy: ConnectorRetryPolicy;
  readonly onSchedule?: (attempt: RetryAttempt) => void;
  readonly isRetryable?: (err: unknown) => boolean;
  readonly sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function withRetry<T>(op: (attempt: number) => Promise<T>, opts: RetryOptions): Promise<RetryOutcome<T>> {
  const { policy } = opts;
  const isRetryable = opts.isRetryable ?? (() => true);
  const sleep = opts.sleep ?? defaultSleep;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    try {
      const value = await op(attempt);
      return { value, attempts: attempt };
    } catch (e) {
      lastErr = e;
      if (attempt >= policy.maxAttempts || !isRetryable(e)) throw e;
      const delayMs = computeBackoff(policy, attempt);
      const schedule: RetryAttempt = { id: newRetryId(), attempt: attempt + 1, delayMs };
      opts.onSchedule?.(schedule);
      await sleep(delayMs);
    }
  }
  throw lastErr;
}
