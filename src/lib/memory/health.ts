/**
 * Memory Engine — Health checks (EBP §11).
 */
import type { MemoryStore } from "./store/types";
import type { MemoryMetrics } from "./metrics";

export type HealthStatus = "healthy" | "degraded" | "down";

export interface HealthReport {
  status: HealthStatus;
  checks: Record<string, { status: HealthStatus; detail?: string }>;
  timestamp: string;
}

export class MemoryHealthChecks {
  constructor(
    private store: MemoryStore,
    private metrics: MemoryMetrics,
  ) {}

  async check(): Promise<HealthReport> {
    const checks: HealthReport["checks"] = {};
    // Store liveness
    try {
      await this.store.countByOwner("__health__");
      checks.store = { status: "healthy" };
    } catch (err) {
      checks.store = { status: "down", detail: String(err) };
    }
    // Retrieval latency sanity
    const snap = this.metrics.snapshot();
    const p95 = percentile(snap.retrievalLatencyMs, 95);
    if (p95 > 5000) checks.retrievalLatency = { status: "degraded", detail: `p95=${p95}ms` };
    else checks.retrievalLatency = { status: "healthy", detail: `p95=${p95}ms` };
    // Error rate
    const totalErrs = Object.values(snap.errors).reduce((a, b) => a + b, 0);
    checks.errorRate =
      totalErrs > 100
        ? { status: "degraded", detail: `${totalErrs} errors` }
        : { status: "healthy" };
    const worst = Object.values(checks).reduce<HealthStatus>(
      (acc, c) => (rank(c.status) > rank(acc) ? c.status : acc),
      "healthy",
    );
    return { status: worst, checks, timestamp: new Date().toISOString() };
  }
}

function rank(s: HealthStatus): number {
  return s === "healthy" ? 0 : s === "degraded" ? 1 : 2;
}

function percentile(xs: number[], p: number): number {
  if (!xs.length) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}
