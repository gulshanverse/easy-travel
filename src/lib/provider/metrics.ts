/**
 * Provider Runtime — Metrics primitives.
 */
export interface ProviderMetrics {
  incr(name: string, value?: number, tags?: Record<string, string>): void;
  observe(name: string, value: number, tags?: Record<string, string>): void;
  gauge(name: string, value: number, tags?: Record<string, string>): void;
  snapshot(): MetricsSnapshot;
}

export interface MetricsSnapshot {
  counters: Record<string, number>;
  histograms: Record<string, { count: number; sum: number; min: number; max: number; p50: number; p95: number; p99: number }>;
  gauges: Record<string, number>;
}

const tagKey = (name: string, tags?: Record<string, string>): string => {
  if (!tags) return name;
  const keys = Object.keys(tags).sort();
  if (keys.length === 0) return name;
  return `${name}{${keys.map((k) => `${k}=${tags[k]}`).join(",")}}`;
};

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx]!;
}

export class InMemoryProviderMetrics implements ProviderMetrics {
  private counters = new Map<string, number>();
  private histograms = new Map<string, number[]>();
  private gauges = new Map<string, number>();
  private readonly cap: number;

  constructor(observationCap = 4096) { this.cap = observationCap; }

  incr(name: string, value = 1, tags?: Record<string, string>): void {
    const k = tagKey(name, tags);
    this.counters.set(k, (this.counters.get(k) ?? 0) + value);
  }
  observe(name: string, value: number, tags?: Record<string, string>): void {
    const k = tagKey(name, tags);
    let arr = this.histograms.get(k);
    if (!arr) { arr = []; this.histograms.set(k, arr); }
    arr.push(value);
    if (arr.length > this.cap) arr.shift();
  }
  gauge(name: string, value: number, tags?: Record<string, string>): void {
    this.gauges.set(tagKey(name, tags), value);
  }
  snapshot(): MetricsSnapshot {
    const histograms: MetricsSnapshot["histograms"] = {};
    for (const [k, arr] of this.histograms) {
      const sorted = [...arr].sort((a, b) => a - b);
      const sum = sorted.reduce((a, b) => a + b, 0);
      histograms[k] = {
        count: sorted.length,
        sum,
        min: sorted[0] ?? 0,
        max: sorted[sorted.length - 1] ?? 0,
        p50: percentile(sorted, 50),
        p95: percentile(sorted, 95),
        p99: percentile(sorted, 99),
      };
    }
    return {
      counters: Object.fromEntries(this.counters),
      histograms,
      gauges: Object.fromEntries(this.gauges),
    };
  }
}

export const defaultProviderMetrics: ProviderMetrics = new InMemoryProviderMetrics();
