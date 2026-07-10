/**
 * Provider Runtime — Retry runtime.
 * Exponential backoff with jitter and a retry budget.
 */
import type { RetryPolicy } from "./config";
import { ProviderCancellationError } from "./errors";

export interface RetryContext {
  attempt: number;
  elapsedMs: number;
}

export interface RetryOutcome<T> { value: T; attempts: number }

export interface RetryOptions {
  policy: RetryPolicy;
  signal?: AbortSignal;
  isRetryable?: (err: unknown) => boolean;
  onRetry?: (err: unknown, ctx: RetryContext) => void | Promise<void>;
}

function defaultIsRetryable(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { retryable?: boolean }).retryable === true;
}

function computeDelay(policy: RetryPolicy, attempt: number): number {
  const raw = Math.min(policy.maxDelayMs, policy.initialDelayMs * Math.pow(policy.multiplier, attempt - 1));
  if (!policy.jitter) return raw;
  return raw / 2 + Math.random() * (raw / 2);
}

export async function withRetry<T>(
  fn: (ctx: RetryContext) => Promise<T>,
  options: RetryOptions,
): Promise<RetryOutcome<T>> {
  const { policy, signal } = options;
  const isRetryable = options.isRetryable ?? defaultIsRetryable;
  const started = Date.now();
  let lastError: unknown;
  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    if (signal?.aborted) throw new ProviderCancellationError();
    const elapsed = Date.now() - started;
    if (elapsed > policy.retryBudgetMs && attempt > 1) break;
    try {
      const value = await fn({ attempt, elapsedMs: elapsed });
      return { value, attempts: attempt };
    } catch (err) {
      lastError = err;
      if (attempt >= policy.maxAttempts || !isRetryable(err)) throw err;
      const delay = computeDelay(policy, attempt);
      await options.onRetry?.(err, { attempt, elapsedMs: elapsed });
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, delay);
        if (signal) {
          const onAbort = () => { clearTimeout(t); reject(new ProviderCancellationError()); };
          signal.addEventListener("abort", onAbort, { once: true });
        }
      });
    }
  }
  throw lastError;
}
