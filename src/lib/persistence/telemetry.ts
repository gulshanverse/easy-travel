/**
 * Persistence Platform — telemetry & metrics.
 * Deterministic, in-process counters/histograms. No vendor SDK.
 */

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export interface HealthCheckResult {
  readonly name: string;
  readonly status: HealthStatus;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface AggregatedHealth {
  readonly status: HealthStatus;
  readonly checks: readonly HealthCheckResult[];
}

export function aggregateHealth(checks: readonly HealthCheckResult[]): AggregatedHealth {
  const status: HealthStatus = checks.some((c) => c.status === "unhealthy")
    ? "unhealthy"
    : checks.some((c) => c.status === "degraded")
      ? "degraded"
      : "healthy";
  return Object.freeze({ status, checks: Object.freeze([...checks]) });
}

export interface PersistenceTelemetry {
  event(name: string, attrs?: Readonly<Record<string, unknown>>): void;
  error(name: string, err: unknown, attrs?: Readonly<Record<string, unknown>>): void;
}

export const noopTelemetry: PersistenceTelemetry = {
  event() {},
  error() {},
};

export interface LatencySummary {
  readonly count: number;
  readonly totalMs: number;
  readonly minMs: number;
  readonly maxMs: number;
  readonly avgMs: number;
  readonly p95Ms: number;
}

/** Simple counter + latency registry used by every persistence component. */
export class PersistenceMetrics {
  private readonly counters = new Map<string, number>();
  private readonly samples = new Map<string, number[]>();

  increment(name: string, by = 1): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + by);
  }
  counter(name: string): number {
    return this.counters.get(name) ?? 0;
  }
  observe(name: string, ms: number): void {
    const list = this.samples.get(name) ?? [];
    list.push(ms);
    if (list.length > 5_000) list.shift();
    this.samples.set(name, list);
  }
  latency(name: string): LatencySummary {
    const list = [...(this.samples.get(name) ?? [])].sort((a, b) => a - b);
    if (!list.length) return { count: 0, totalMs: 0, minMs: 0, maxMs: 0, avgMs: 0, p95Ms: 0 };
    const total = list.reduce((a, b) => a + b, 0);
    const idx = Math.min(list.length - 1, Math.floor(list.length * 0.95));
    return {
      count: list.length,
      totalMs: total,
      minMs: list[0]!,
      maxMs: list[list.length - 1]!,
      avgMs: total / list.length,
      p95Ms: list[idx]!,
    };
  }
  snapshot(): Readonly<Record<string, number>> {
    const out: Record<string, number> = {};
    for (const [k, v] of this.counters) out[k] = v;
    for (const [k] of this.samples) out[`${k}.p95_ms`] = Math.round(this.latency(k).p95Ms);
    return Object.freeze(out);
  }
  reset(): void {
    this.counters.clear();
    this.samples.clear();
  }

  /** Times an async operation, recording latency + success/failure counters. */
  async time<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const started = Date.now();
    try {
      const result = await fn();
      this.increment(`${name}.ok`);
      return result;
    } catch (err) {
      this.increment(`${name}.error`);
      throw err;
    } finally {
      this.observe(name, Date.now() - started);
    }
  }
}
