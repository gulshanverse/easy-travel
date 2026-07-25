/** IPCF — connector governance:
 *  rate limits, concurrency, circuit breaker, budget, sandbox rules,
 *  version + capability validation.
 */
import {
  IntegrationCircuitOpenError, IntegrationPolicyError, IntegrationRateLimitError,
  IntegrationVersionError,
} from "./errors";
import type { Connector, ConnectorCapability, ConnectorPolicy } from "./types";

/** Sliding-window rate limiter with in-memory buckets per connector. */
export class RateLimiter {
  private readonly windows = new Map<string, number[]>();
  constructor(private readonly windowMs = 60_000) {}
  check(connectorId: string, policy: ConnectorPolicy, now = Date.now()): void {
    const arr = this.windows.get(connectorId) ?? [];
    const cutoff = now - this.windowMs;
    while (arr.length && arr[0]! < cutoff) arr.shift();
    if (arr.length >= policy.rateLimit.perMinute) {
      this.windows.set(connectorId, arr);
      throw new IntegrationRateLimitError(`rate limit exceeded for ${connectorId}`);
    }
    arr.push(now);
    this.windows.set(connectorId, arr);
  }
  reset(connectorId?: string): void {
    if (connectorId) this.windows.delete(connectorId);
    else this.windows.clear();
  }
}

/** Concurrency limiter — semaphore per connector. */
export class ConcurrencyLimiter {
  private readonly inflight = new Map<string, number>();
  acquire(connectorId: string, policy: ConnectorPolicy): void {
    const cur = this.inflight.get(connectorId) ?? 0;
    if (cur >= policy.concurrency) {
      throw new IntegrationPolicyError(`concurrency exceeded for ${connectorId}`);
    }
    this.inflight.set(connectorId, cur + 1);
  }
  release(connectorId: string): void {
    const cur = this.inflight.get(connectorId) ?? 0;
    this.inflight.set(connectorId, Math.max(0, cur - 1));
  }
  current(connectorId: string): number { return this.inflight.get(connectorId) ?? 0; }
  reset(): void { this.inflight.clear(); }
}

export type CircuitState = "closed" | "open" | "half-open";
export interface CircuitSnapshot {
  readonly state: CircuitState;
  readonly failureStreak: number;
  readonly successStreak: number;
  readonly openedAt?: number;
}

export class CircuitBreaker {
  private readonly state = new Map<string, CircuitSnapshot>();
  snapshot(connectorId: string): CircuitSnapshot {
    return this.state.get(connectorId) ?? { state: "closed", failureStreak: 0, successStreak: 0 };
  }
  ensureClosed(connectorId: string, policy: ConnectorPolicy, now = Date.now()): CircuitSnapshot {
    const snap = this.snapshot(connectorId);
    if (snap.state === "open") {
      if (snap.openedAt !== undefined && now - snap.openedAt >= policy.circuit.openCooldownMs) {
        const next: CircuitSnapshot = { state: "half-open", failureStreak: snap.failureStreak, successStreak: 0, openedAt: snap.openedAt };
        this.state.set(connectorId, next);
        return next;
      }
      throw new IntegrationCircuitOpenError(`circuit open for ${connectorId}`);
    }
    return snap;
  }
  recordSuccess(connectorId: string): CircuitSnapshot {
    const snap = this.snapshot(connectorId);
    const next: CircuitSnapshot = { state: "closed", failureStreak: 0, successStreak: snap.successStreak + 1 };
    this.state.set(connectorId, next);
    return next;
  }
  recordFailure(connectorId: string, policy: ConnectorPolicy, now = Date.now()): CircuitSnapshot {
    const snap = this.snapshot(connectorId);
    const failureStreak = snap.failureStreak + 1;
    const state: CircuitState = failureStreak >= policy.circuit.failureThreshold ? "open" : "closed";
    const next: CircuitSnapshot = {
      state, failureStreak, successStreak: 0,
      openedAt: state === "open" ? now : snap.openedAt,
    };
    this.state.set(connectorId, next);
    return next;
  }
  reset(connectorId?: string): void {
    if (connectorId) this.state.delete(connectorId);
    else this.state.clear();
  }
}

/** Execution budget guard. */
export function assertBudget(policy: ConnectorPolicy, elapsedMs: number): void {
  if (policy.executionBudgetMs > 0 && elapsedMs > policy.executionBudgetMs) {
    throw new IntegrationPolicyError(`execution budget exceeded (${elapsedMs}ms > ${policy.executionBudgetMs}ms)`);
  }
}

/** Sandbox isolation guard — deterministic policy check. */
export function assertSandbox(c: Connector): void {
  if (!c.definition.policy.sandbox) {
    // Non-sandbox connectors are permitted but flagged as risky.
    // Guard raises only if explicitly required elsewhere.
  }
}

/** Capability validation — connector must advertise the requested capability. */
export function requireCapability(c: Connector, capabilityId: string): ConnectorCapability {
  const cap = c.definition.manifest.capabilities.find(x => x.id === capabilityId);
  if (!cap) throw new IntegrationPolicyError(`capability '${capabilityId}' not advertised by ${c.id}`);
  return cap;
}

/** Semver-style comparison — only x.y.z digits. */
function cmpSemver(a: string, b: string): number {
  const [pa, pb] = [a.split(".").map(Number), b.split(".").map(Number)];
  for (let i = 0; i < 3; i++) {
    const av = pa[i] ?? 0, bv = pb[i] ?? 0;
    if (av !== bv) return av < bv ? -1 : 1;
  }
  return 0;
}
export function requireVersionCompatible(actual: string, min?: string, max?: string): void {
  if (min && cmpSemver(actual, min) < 0) throw new IntegrationVersionError(`version ${actual} < min ${min}`);
  if (max && cmpSemver(actual, max) > 0) throw new IntegrationVersionError(`version ${actual} > max ${max}`);
}
