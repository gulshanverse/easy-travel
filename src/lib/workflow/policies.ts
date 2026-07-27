/** WAR — automation policies: retry, budgets, concurrency, rate limits, priority. */
import type { WorkflowPolicy, WorkflowRetryPolicy } from "./types";
import { WorkflowPolicyError } from "./errors";

export const DEFAULT_WORKFLOW_RETRY_POLICY: WorkflowRetryPolicy = Object.freeze({
  maxAttempts: 3,
  initialDelayMs: 0,
  multiplier: 2,
  maxDelayMs: 30_000,
});

export const DEFAULT_WORKFLOW_POLICY: WorkflowPolicy = Object.freeze({
  maxConcurrentInstances: 1_000,
  maxStepConcurrency: 8,
  executionBudgetMs: 60 * 60 * 1000,
  defaultTimeoutMs: 15_000,
  retry: DEFAULT_WORKFLOW_RETRY_POLICY,
  priority: 5,
  rateLimitPerMinute: 600,
  cancellable: true,
  permissions: Object.freeze(["workflow.execute"]) as readonly string[],
});

export function mergeWorkflowPolicy(partial?: Partial<WorkflowPolicy>): WorkflowPolicy {
  const retry = Object.freeze({ ...DEFAULT_WORKFLOW_RETRY_POLICY, ...(partial?.retry ?? {}) });
  return Object.freeze({ ...DEFAULT_WORKFLOW_POLICY, ...(partial ?? {}), retry });
}

export function resolveRetryPolicy(
  step: Partial<WorkflowRetryPolicy> | undefined,
  policy: WorkflowPolicy,
): WorkflowRetryPolicy {
  return Object.freeze({ ...policy.retry, ...(step ?? {}) });
}

export function computeBackoffMs(attempt: number, retry: WorkflowRetryPolicy): number {
  if (attempt <= 1) return 0;
  const raw = retry.initialDelayMs * Math.pow(retry.multiplier, attempt - 2);
  return Math.max(0, Math.min(retry.maxDelayMs, Math.round(raw)));
}

/** Deterministic, in-memory token-bucket-free rate limiter (fixed window). */
export class WorkflowRateLimiter {
  private readonly windows = new Map<string, { start: number; count: number }>();
  constructor(private readonly windowMs = 60_000) {}
  allow(key: string, limit: number, now: number): boolean {
    const w = this.windows.get(key);
    if (!w || now - w.start >= this.windowMs) {
      this.windows.set(key, { start: now, count: 1 });
      return true;
    }
    if (w.count >= limit) return false;
    w.count += 1;
    return true;
  }
  clear(): void {
    this.windows.clear();
  }
}

export class WorkflowConcurrencyLimiter {
  private readonly inFlight = new Map<string, number>();
  acquire(key: string, limit: number): void {
    const n = this.inFlight.get(key) ?? 0;
    if (n >= limit)
      throw new WorkflowPolicyError(`Concurrency limit reached for ${key} (${limit})`);
    this.inFlight.set(key, n + 1);
  }
  release(key: string): void {
    const n = this.inFlight.get(key) ?? 0;
    if (n <= 1) this.inFlight.delete(key);
    else this.inFlight.set(key, n - 1);
  }
  count(key: string): number {
    return this.inFlight.get(key) ?? 0;
  }
  clear(): void {
    this.inFlight.clear();
  }
}

export function assertPermitted(policy: WorkflowPolicy, granted: readonly string[]): void {
  for (const p of policy.permissions) {
    if (!granted.includes(p) && !granted.includes("*")) {
      throw new WorkflowPolicyError(`Missing workflow permission: ${p}`);
    }
  }
}
