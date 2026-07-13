/**
 * Journey telemetry — metrics, telemetry sinks, and health primitives.
 * Provider-independent; adapters live in the composition root.
 */

export type TelemetryLevel = "debug" | "info" | "warn" | "error";

export interface JourneyTelemetry {
  emit(level: TelemetryLevel, message: string, attrs?: Record<string, unknown>): void;
  startSpan(name: string, attrs?: Record<string, unknown>): JourneySpan;
}

export interface JourneySpan {
  end(attrs?: Record<string, unknown>): void;
  setAttribute(key: string, value: unknown): void;
}

export function createNoopTelemetry(): JourneyTelemetry {
  const span: JourneySpan = { end() {}, setAttribute() {} };
  return { emit() {}, startSpan() { return span; } };
}

export function createConsoleTelemetry(prefix = "journey"): JourneyTelemetry {
  return {
    emit(level, message, attrs) {
      const line = `[${prefix}] ${level.toUpperCase()} ${message}`;
      const payload = attrs ? { attrs } : undefined;
      // eslint-disable-next-line no-console
      (console[level === "warn" ? "warn" : level === "error" ? "error" : "log"] as (...a: unknown[]) => void)(line, payload ?? "");
    },
    startSpan(name, attrs) {
      const started = Date.now();
      return {
        end(endAttrs) {
          // eslint-disable-next-line no-console
          console.log(`[${prefix}] span ${name} ${Date.now() - started}ms`, { ...attrs, ...endAttrs });
        },
        setAttribute() {},
      };
    },
  };
}

// ---------- Metrics ----------
export interface JourneyMetrics {
  counter(name: string, value?: number, tags?: Record<string, string>): void;
  gauge(name: string, value: number, tags?: Record<string, string>): void;
  histogram(name: string, value: number, tags?: Record<string, string>): void;
  snapshot(): JourneyMetricsSnapshot;
}

export interface JourneyMetricsSnapshot {
  counters: Record<string, number>;
  gauges: Record<string, number>;
  histograms: Record<string, { count: number; sum: number; min: number; max: number }>;
}

export function createInMemoryMetrics(): JourneyMetrics {
  const counters = new Map<string, number>();
  const gauges = new Map<string, number>();
  const histograms = new Map<string, { count: number; sum: number; min: number; max: number }>();
  const key = (n: string, t?: Record<string, string>) =>
    t && Object.keys(t).length ? `${n}#${Object.entries(t).map(([k, v]) => `${k}=${v}`).sort().join(",")}` : n;
  return {
    counter(name, value = 1, tags) {
      const k = key(name, tags);
      counters.set(k, (counters.get(k) ?? 0) + value);
    },
    gauge(name, value, tags) { gauges.set(key(name, tags), value); },
    histogram(name, value, tags) {
      const k = key(name, tags);
      const h = histograms.get(k) ?? { count: 0, sum: 0, min: Infinity, max: -Infinity };
      h.count += 1;
      h.sum += value;
      if (value < h.min) h.min = value;
      if (value > h.max) h.max = value;
      histograms.set(k, h);
    },
    snapshot() {
      return {
        counters: Object.fromEntries(counters),
        gauges: Object.fromEntries(gauges),
        histograms: Object.fromEntries(histograms),
      };
    },
  };
}

// ---------- Health ----------
export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export interface HealthCheckResult {
  readonly name: string;
  readonly status: HealthStatus;
  readonly message?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface AggregatedHealth {
  readonly status: HealthStatus;
  readonly checks: readonly HealthCheckResult[];
  readonly at: string;
}

export function aggregateHealth(checks: readonly HealthCheckResult[]): AggregatedHealth {
  let status: HealthStatus = "healthy";
  for (const c of checks) {
    if (c.status === "unhealthy") { status = "unhealthy"; break; }
    if (c.status === "degraded") status = "degraded";
  }
  return { status, checks, at: new Date().toISOString() };
}
