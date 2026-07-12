/**
 * Graph Runtime — Metrics, telemetry, health.
 * Zero external dependencies. Callers can attach richer collectors via
 * the runtime configuration.
 */

export interface GraphMetrics {
  counter(name: string, value?: number, labels?: Record<string, string>): void;
  histogram(name: string, value: number, labels?: Record<string, string>): void;
  gauge(name: string, value: number, labels?: Record<string, string>): void;
  snapshot(): Readonly<GraphMetricsSnapshot>;
  reset(): void;
}

export interface GraphMetricsSnapshot {
  counters: Record<string, number>;
  histograms: Record<string, { count: number; sum: number; min: number; max: number }>;
  gauges: Record<string, number>;
}

const keyOf = (name: string, labels?: Record<string, string>): string => {
  if (!labels) return name;
  const parts = Object.keys(labels).sort().map((k) => `${k}=${labels[k]}`);
  return parts.length ? `${name}{${parts.join(",")}}` : name;
};

export function createInMemoryMetrics(): GraphMetrics {
  const counters: Record<string, number> = {};
  const gauges: Record<string, number> = {};
  const histograms: Record<string, { count: number; sum: number; min: number; max: number }> = {};
  return {
    counter(name, value = 1, labels) {
      const k = keyOf(name, labels);
      counters[k] = (counters[k] ?? 0) + value;
    },
    histogram(name, value, labels) {
      const k = keyOf(name, labels);
      const h = histograms[k] ?? { count: 0, sum: 0, min: Infinity, max: -Infinity };
      h.count += 1;
      h.sum += value;
      if (value < h.min) h.min = value;
      if (value > h.max) h.max = value;
      histograms[k] = h;
    },
    gauge(name, value, labels) {
      gauges[keyOf(name, labels)] = value;
    },
    snapshot() {
      return { counters: { ...counters }, gauges: { ...gauges }, histograms: { ...histograms } };
    },
    reset() {
      for (const k of Object.keys(counters)) delete counters[k];
      for (const k of Object.keys(gauges)) delete gauges[k];
      for (const k of Object.keys(histograms)) delete histograms[k];
    },
  };
}

// ----- Telemetry -----
export type TelemetryLevel = "debug" | "info" | "warn" | "error";
export interface GraphTelemetry {
  log(level: TelemetryLevel, message: string, fields?: Record<string, unknown>): void;
  span<T>(name: string, fn: () => Promise<T> | T, fields?: Record<string, unknown>): Promise<T>;
}

export function createNoopTelemetry(): GraphTelemetry {
  return {
    log() {},
    async span(_name, fn) {
      return await fn();
    },
  };
}

export function createConsoleTelemetry(): GraphTelemetry {
  return {
    log(level, message, fields) {
      const line = fields ? `${message} ${JSON.stringify(fields)}` : message;
      // eslint-disable-next-line no-console
      (console[level] ?? console.log)(`[graph] ${line}`);
    },
    async span(name, fn, fields) {
      const start = Date.now();
      try {
        return await fn();
      } finally {
        // eslint-disable-next-line no-console
        console.debug(`[graph] span ${name} ${Date.now() - start}ms`, fields ?? {});
      }
    },
  };
}

// ----- Health -----
export type HealthStatus = "healthy" | "degraded" | "unhealthy";
export interface HealthCheckResult {
  name: string;
  status: HealthStatus;
  details?: Record<string, unknown>;
}
export interface AggregatedHealth {
  status: HealthStatus;
  checks: HealthCheckResult[];
}

export function aggregateHealth(checks: HealthCheckResult[]): AggregatedHealth {
  let status: HealthStatus = "healthy";
  for (const c of checks) {
    if (c.status === "unhealthy") {
      status = "unhealthy";
      break;
    }
    if (c.status === "degraded") status = "degraded";
  }
  return { status, checks };
}
