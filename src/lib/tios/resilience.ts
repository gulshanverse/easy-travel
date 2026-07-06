/**
 * TIOS Platform Resilience (Milestone 5.3).
 * Circuit breaker, retry, timeout, bulkhead, and graceful-degradation
 * primitives. Everything is small, dependency-free, and composable so
 * feature code never hardcodes retry loops.
 */

// ---------------- Retry ----------------
export interface RetryPolicy {
  maxAttempts: number;
  backoffMs: number;
  jitter?: boolean;
  retryable?: (err: unknown) => boolean;
}

export async function withRetry<T>(
  fn: () => Promise<T>, policy: RetryPolicy,
): Promise<T> {
  const attempts = Math.max(1, policy.maxAttempts);
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (policy.retryable && !policy.retryable(err)) throw err;
      if (i === attempts - 1) break;
      const delay =
        policy.backoffMs * (2 ** i) *
        (policy.jitter ? 0.5 + Math.random() : 1);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

// ---------------- Timeout ----------------
export class TimeoutError extends Error {
  constructor(ms: number) { super(`operation timed out after ${ms}ms`); this.name = "TimeoutError"; }
}

export async function withTimeout<T>(fn: () => Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, rej) => setTimeout(() => rej(new TimeoutError(ms)), ms)),
  ]);
}

// ---------------- Circuit Breaker ----------------
export type CircuitState = "closed" | "open" | "half-open";

export interface CircuitBreakerOptions {
  failureThreshold: number;   // consecutive failures before opening
  cooldownMs: number;         // time to wait before half-open probe
}

export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failures = 0;
  private openedAt = 0;

  constructor(private readonly id: string, private readonly opts: CircuitBreakerOptions) {}

  getState(): CircuitState {
    if (this.state === "open" && Date.now() - this.openedAt >= this.opts.cooldownMs) {
      this.state = "half-open";
    }
    return this.state;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const state = this.getState();
    if (state === "open") throw new Error(`circuit "${this.id}" is open`);
    try {
      const out = await fn();
      this.reset();
      return out;
    } catch (err) {
      this.recordFailure();
      throw err;
    }
  }

  private recordFailure(): void {
    this.failures += 1;
    if (this.failures >= this.opts.failureThreshold) {
      this.state = "open";
      this.openedAt = Date.now();
    }
  }

  private reset(): void {
    this.failures = 0;
    this.state = "closed";
  }
}

// ---------------- Fallback / Graceful Degradation ----------------
export async function withFallback<T>(
  primary: () => Promise<T>, fallback: (err: unknown) => Promise<T> | T,
): Promise<T> {
  try { return await primary(); }
  catch (err) { return await fallback(err); }
}

// ---------------- Bulkhead (concurrency isolation) ----------------
export class Bulkhead {
  private active = 0;
  private queue: Array<() => void> = [];
  constructor(private readonly max: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.max) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.active += 1;
    try { return await fn(); }
    finally {
      this.active -= 1;
      const next = this.queue.shift();
      if (next) next();
    }
  }
}

// ---------------- Cancellation Helper ----------------
export function abortableTimeout(ms: number): AbortSignal {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
}
