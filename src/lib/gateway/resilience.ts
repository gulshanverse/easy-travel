/** Provider Gateway (P-1.4) — retry, circuit breaker, rate limiting,
 *  concurrency control, budget control and timeout helpers.
 *
 *  Distributed state is delegated to the P-1.1 cache/rate-limit port when
 *  provided; the in-process implementations below are the deterministic
 *  default used in tests and single-node deployments.
 */
import {
  ProviderBudgetExceededError,
  ProviderCircuitOpenError,
  ProviderConcurrencyExceededError,
  ProviderRateLimitedError,
  ProviderTimeoutError,
  isRetryable,
} from "./errors";
import type { CircuitState, ProviderCircuitPolicy, ProviderRetryPolicy } from "./types";

/* ------------------------------------------------------------------ */
/* Timeouts                                                            */
/* ------------------------------------------------------------------ */

export interface TimeoutBudget {
  readonly connectionTimeoutMs: number;
  readonly requestTimeoutMs: number;
  readonly providerTimeoutMs: number;
  readonly totalDeadlineAt: number;
}

export function createTimeoutBudget(input: {
  connectionTimeoutMs: number;
  requestTimeoutMs: number;
  totalDeadlineMs: number;
  now?: number;
}): TimeoutBudget {
  const now = input.now ?? Date.now();
  return Object.freeze({
    connectionTimeoutMs: input.connectionTimeoutMs,
    requestTimeoutMs: input.requestTimeoutMs,
    providerTimeoutMs: Math.min(input.requestTimeoutMs, input.totalDeadlineMs),
    totalDeadlineAt: now + input.totalDeadlineMs,
  });
}

export function remainingMs(budget: TimeoutBudget, now = Date.now()): number {
  return Math.max(0, budget.totalDeadlineAt - now);
}

/** Never let an external provider block indefinitely. */
export async function withTimeout<T>(
  work: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  ctx: { providerId?: string; capability?: string } = {},
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new ProviderTimeoutError(`provider exceeded ${timeoutMs}ms`, ctx));
    }, timeoutMs);
  });
  try {
    return await Promise.race([work(controller.signal), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/* Retry                                                               */
/* ------------------------------------------------------------------ */

export interface RetryAttempt {
  readonly attempt: number;
  readonly delayMs: number;
  readonly error?: string;
}

export interface RetryDecision {
  readonly retry: boolean;
  readonly delayMs: number;
  readonly reason: string;
}

/** Deterministic exponential backoff; jitter derives from the attempt index. */
export function exponentialBackoff(
  attempt: number,
  policy: ProviderRetryPolicy,
): number {
  const raw = policy.baseDelayMs * Math.pow(2, Math.max(0, attempt - 1));
  const capped = Math.min(raw, policy.maxDelayMs);
  if (!policy.jitter) return capped;
  // Deterministic pseudo-jitter (no Math.random): stable across replays.
  const factor = 0.5 + ((attempt * 2654435761) % 1000) / 2000;
  return Math.min(policy.maxDelayMs, Math.round(capped * factor));
}

export class RetryBudget {
  private spent = 0;
  constructor(private readonly limit: number) {}
  tryConsume(): boolean {
    if (this.spent >= this.limit) return false;
    this.spent++;
    return true;
  }
  remaining(): number {
    return Math.max(0, this.limit - this.spent);
  }
  reset(): void {
    this.spent = 0;
  }
}

export function decideRetry(input: {
  error: unknown;
  attempt: number;
  policy: ProviderRetryPolicy;
  idempotent: boolean;
  hasIdempotencyKey: boolean;
  budget: RetryBudget;
}): RetryDecision {
  const { error, attempt, policy, idempotent, hasIdempotencyKey, budget } = input;
  if (attempt >= policy.maxAttempts)
    return { retry: false, delayMs: 0, reason: "max attempts reached" };
  if (!isRetryable(error)) return { retry: false, delayMs: 0, reason: "permanent error" };
  if (!idempotent && !hasIdempotencyKey && !policy.retryNonIdempotent)
    return { retry: false, delayMs: 0, reason: "non-idempotent operation" };
  if (!budget.tryConsume()) return { retry: false, delayMs: 0, reason: "retry budget exhausted" };
  return { retry: true, delayMs: exponentialBackoff(attempt, policy), reason: "retryable error" };
}

/* ------------------------------------------------------------------ */
/* Circuit breaker                                                     */
/* ------------------------------------------------------------------ */

export interface CircuitSnapshot {
  readonly state: CircuitState;
  readonly failures: number;
  readonly successes: number;
  readonly openedAt?: number;
}

export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failures = 0;
  private successes = 0;
  private openedAt?: number;

  constructor(private readonly policy: ProviderCircuitPolicy) {}

  snapshot(): CircuitSnapshot {
    const snap: { state: CircuitState; failures: number; successes: number; openedAt?: number } = {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
    };
    if (this.openedAt !== undefined) snap.openedAt = this.openedAt;
    return Object.freeze(snap);
  }

  /** Half-open probes are admitted once the open duration has elapsed. */
  allows(now = Date.now()): boolean {
    if (this.state === "closed") return true;
    if (this.state === "half-open") return true;
    if (this.openedAt !== undefined && now - this.openedAt >= this.policy.openDurationMs) {
      this.state = "half-open";
      this.successes = 0;
      return true;
    }
    return false;
  }

  assert(providerId: string, now = Date.now()): void {
    if (!this.allows(now))
      throw new ProviderCircuitOpenError(`circuit open for provider ${providerId}`, { providerId });
  }

  onSuccess(): CircuitState {
    if (this.state === "half-open") {
      this.successes++;
      if (this.successes >= this.policy.successThreshold) this.close();
    } else {
      this.failures = 0;
    }
    return this.state;
  }

  onFailure(now = Date.now()): CircuitState {
    this.failures++;
    if (this.state === "half-open" || this.failures >= this.policy.failureThreshold) {
      this.state = "open";
      this.openedAt = now;
      this.successes = 0;
    }
    return this.state;
  }

  private close(): void {
    this.state = "closed";
    this.failures = 0;
    this.successes = 0;
    delete (this as { openedAt?: number }).openedAt;
  }

  reset(): void {
    this.close();
  }
}

/* ------------------------------------------------------------------ */
/* Rate limiting                                                       */
/* ------------------------------------------------------------------ */

/** Distributed counter port — backed by P-1.1 cache in production. */
export interface RateCounterPort {
  increment(key: string, windowMs: number): Promise<number>;
}

export class InMemoryRateCounter implements RateCounterPort {
  private windows = new Map<string, { count: number; resetAt: number }>();
  async increment(key: string, windowMs: number): Promise<number> {
    const now = Date.now();
    const entry = this.windows.get(key);
    if (!entry || entry.resetAt <= now) {
      this.windows.set(key, { count: 1, resetAt: now + windowMs });
      return 1;
    }
    entry.count++;
    return entry.count;
  }
  clear(): void {
    this.windows.clear();
  }
}

export type RateLimitDimension = "provider" | "capability" | "credential" | "user" | "tenant";

export interface RateLimitCheck {
  readonly dimension: RateLimitDimension;
  readonly key: string;
  readonly limit: number;
  readonly windowMs: number;
}

export class RateLimiter {
  constructor(private readonly counter: RateCounterPort = new InMemoryRateCounter()) {}

  async check(checks: readonly RateLimitCheck[], ctx: { providerId?: string } = {}): Promise<void> {
    for (const c of checks) {
      if (c.limit <= 0) continue;
      const used = await this.counter.increment(`${c.dimension}:${c.key}`, c.windowMs);
      if (used > c.limit)
        throw new ProviderRateLimitedError(
          `rate limit exceeded on ${c.dimension} '${c.key}' (${c.limit}/${c.windowMs}ms)`,
          ctx,
        );
    }
  }
}

/* ------------------------------------------------------------------ */
/* Concurrency control                                                 */
/* ------------------------------------------------------------------ */

export class ConcurrencyLimiter {
  private active = new Map<string, number>();
  private queues = new Map<string, (() => void)[]>();

  constructor(private readonly maxQueueDepth = 1024) {}

  current(key: string): number {
    return this.active.get(key) ?? 0;
  }
  queueDepth(key: string): number {
    return this.queues.get(key)?.length ?? 0;
  }

  async acquire(key: string, limit: number, signal?: AbortSignal): Promise<() => void> {
    if (limit <= 0) return () => undefined;
    if (this.current(key) < limit) {
      this.active.set(key, this.current(key) + 1);
      return () => this.release(key);
    }
    const queue = this.queues.get(key) ?? [];
    if (queue.length >= this.maxQueueDepth)
      throw new ProviderConcurrencyExceededError(`backpressure: queue full for '${key}'`);
    await new Promise<void>((resolve, reject) => {
      const onAbort = () => reject(new ProviderConcurrencyExceededError("request cancelled"));
      queue.push(() => {
        signal?.removeEventListener("abort", onAbort);
        resolve();
      });
      this.queues.set(key, queue);
      signal?.addEventListener("abort", onAbort, { once: true });
    });
    this.active.set(key, this.current(key) + 1);
    return () => this.release(key);
  }

  private release(key: string): void {
    this.active.set(key, Math.max(0, this.current(key) - 1));
    const queue = this.queues.get(key);
    const next = queue?.shift();
    if (next) next();
  }

  clear(): void {
    this.active.clear();
    this.queues.clear();
  }
}

/* ------------------------------------------------------------------ */
/* Budget control                                                      */
/* ------------------------------------------------------------------ */

export interface BudgetScope {
  readonly providerId: string;
  readonly capability: string;
  readonly userId?: string;
  readonly day: string;
  readonly month: string;
}

export interface BudgetLimits {
  readonly dailyBudget?: number;
  readonly monthlyBudget?: number;
  readonly perUserBudget?: number;
  readonly perProviderBudget?: number;
  readonly perCapabilityBudget?: number;
}

export function budgetScope(input: {
  providerId: string;
  capability: string;
  userId?: string;
  now?: number;
}): BudgetScope {
  const d = new Date(input.now ?? Date.now());
  const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  const scope: {
    providerId: string;
    capability: string;
    userId?: string;
    day: string;
    month: string;
  } = {
    providerId: input.providerId,
    capability: input.capability,
    day: `${month}-${String(d.getUTCDate()).padStart(2, "0")}`,
    month,
  };
  if (input.userId) scope.userId = input.userId;
  return Object.freeze(scope);
}

export class BudgetController {
  private spend = new Map<string, number>();
  private rejections = 0;

  spent(key: string): number {
    return this.spend.get(key) ?? 0;
  }
  rejectionCount(): number {
    return this.rejections;
  }

  /** Validate an estimated cost, then record it. Throws when policy requires. */
  authorize(scope: BudgetScope, limits: BudgetLimits, estimatedCost: number): void {
    const checks: [string, number | undefined][] = [
      [`day:${scope.day}`, limits.dailyBudget],
      [`month:${scope.month}`, limits.monthlyBudget],
      [`user:${scope.userId ?? "-"}:${scope.day}`, scope.userId ? limits.perUserBudget : undefined],
      [`provider:${scope.providerId}:${scope.month}`, limits.perProviderBudget],
      [`capability:${scope.capability}:${scope.month}`, limits.perCapabilityBudget],
    ];
    for (const [key, limit] of checks) {
      if (limit === undefined) continue;
      if (this.spent(key) + estimatedCost > limit) {
        this.rejections++;
        throw new ProviderBudgetExceededError(
          `budget exceeded for ${key} (limit ${limit})`,
          { providerId: scope.providerId, capability: scope.capability },
        );
      }
    }
    for (const [key, limit] of checks) {
      if (limit === undefined) continue;
      this.spend.set(key, this.spent(key) + estimatedCost);
    }
  }

  /** Reconcile estimated cost with actual cost once known. */
  settle(scope: BudgetScope, estimatedCost: number, actualCost: number): void {
    const delta = actualCost - estimatedCost;
    if (delta === 0) return;
    const keys = [
      `day:${scope.day}`,
      `month:${scope.month}`,
      `user:${scope.userId ?? "-"}:${scope.day}`,
      `provider:${scope.providerId}:${scope.month}`,
      `capability:${scope.capability}:${scope.month}`,
    ];
    for (const key of keys) {
      if (!this.spend.has(key)) continue;
      this.spend.set(key, Math.max(0, this.spent(key) + delta));
    }
  }

  reset(): void {
    this.spend.clear();
    this.rejections = 0;
  }
}
