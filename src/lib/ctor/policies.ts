/** CTOR — execution policies (deterministic). */
import type { RetryPolicy, StepPolicy } from "./types";

export interface CTORPolicies {
  readonly defaultTimeoutMs: number;
  readonly defaultRetry: RetryPolicy;
  readonly maxConcurrency: number;
  readonly executionBudgetMs?: number;
  readonly failurePolicy: "fail-fast" | "collect";
}
export const DEFAULT_CTOR_POLICIES: CTORPolicies = Object.freeze({
  defaultTimeoutMs: 30_000,
  defaultRetry: Object.freeze({ maxAttempts: 1, backoffMs: 100, factor: 2 }),
  maxConcurrency: 32,
  failurePolicy: "fail-fast" as const,
});
export function mergePolicies(patch: Partial<CTORPolicies> = {}): CTORPolicies {
  return Object.freeze({ ...DEFAULT_CTOR_POLICIES, ...patch });
}
/** Deterministic exponential backoff (no jitter). */
export function computeBackoffMs(attempt: number, policy: RetryPolicy): number {
  if (attempt <= 1) return 0;
  return Math.floor(policy.backoffMs * Math.pow(policy.factor, attempt - 2));
}
export function resolveStepPolicy(step: StepPolicy | undefined, base: CTORPolicies): Required<Omit<StepPolicy, "priority">> & { priority: number } {
  return {
    timeoutMs: step?.timeoutMs ?? base.defaultTimeoutMs,
    retry: step?.retry ?? base.defaultRetry,
    required: step?.required ?? true,
    priority: step?.priority ?? 0,
  };
}
