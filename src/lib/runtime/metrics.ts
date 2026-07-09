/**
 * Runtime Core — Metrics.
 *
 * Minimal metrics facade (counter / histogram / gauge). Adapters plug into
 * OpenTelemetry or Prometheus. The in-memory implementation is used for
 * tests, health snapshots, and diagnostic dumps.
 */

export interface RuntimeMetrics {
  incr(name: string, value?: number, tags?: Record<string, string>): void;
  observe(name: string, value: number, tags?: Record<string, string>): void;
  gauge(name: string, value: number, tags?: Record<string, string>): void;
  snapshot(): MetricsSnapshot;
}

export interface MetricsSnapshot {
  counters: Record<string, number>;
  histograms: Record<string, { count: number; sum: number; min: number; max: number; avg: number }>;
  gauges: Record<string, number>;
}

function keyOf(name: string, tags?: Record<string, string>): string {
  if (!tags) return name;
  const parts = Object.keys(tags)
    .sort()
    .map((k) => `${k}=${tags[k]}`)
    .join(",");
  return parts ? `${name}{${parts}}` : name;
}

export class InMemoryMetrics implements RuntimeMetrics {
  private counters = new Map<string, number>();
  private histograms = new Map<string, { count: number; sum: number; min: number; max: number }>();
  private gauges = new Map<string, number>();

  incr(name: string, value = 1, tags?: Record<string, string>): void {
    const k = keyOf(name, tags);
    this.counters.set(k, (this.counters.get(k) ?? 0) + value);
  }

  observe(name: string, value: number, tags?: Record<string, string>): void {
    const k = keyOf(name, tags);
    const h = this.histograms.get(k);
    if (!h) {
      this.histograms.set(k, { count: 1, sum: value, min: value, max: value });
    } else {
      h.count += 1;
      h.sum += value;
      h.min = Math.min(h.min, value);
      h.max = Math.max(h.max, value);
    }
  }

  gauge(name: string, value: number, tags?: Record<string, string>): void {
    this.gauges.set(keyOf(name, tags), value);
  }

  snapshot(): MetricsSnapshot {
    const histograms: MetricsSnapshot["histograms"] = {};
    for (const [k, v] of this.histograms) {
      histograms[k] = { ...v, avg: v.count === 0 ? 0 : v.sum / v.count };
    }
    return {
      counters: Object.fromEntries(this.counters),
      histograms,
      gauges: Object.fromEntries(this.gauges),
    };
  }

  reset(): void {
    this.counters.clear();
    this.histograms.clear();
    this.gauges.clear();
  }
}

export const defaultRuntimeMetrics: RuntimeMetrics = new InMemoryMetrics();
