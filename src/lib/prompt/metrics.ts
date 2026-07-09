/**
 * Metrics registry. In-memory implementation is a functional default; a
 * Prometheus/OTel adapter can implement the same interface.
 */
export interface Counter {
  inc(delta?: number, labels?: Record<string, string>): void;
  value(labels?: Record<string, string>): number;
}
export interface Histogram {
  observe(value: number, labels?: Record<string, string>): void;
  snapshot(labels?: Record<string, string>): { count: number; sum: number; min: number; max: number; p50: number; p95: number };
}

export interface PromptMetrics {
  counter(name: string): Counter;
  histogram(name: string): Histogram;
  snapshot(): Record<string, unknown>;
}

class InMemoryCounter implements Counter {
  private buckets = new Map<string, number>();
  inc(delta = 1, labels: Record<string, string> = {}): void {
    const k = labelKey(labels);
    this.buckets.set(k, (this.buckets.get(k) ?? 0) + delta);
  }
  value(labels: Record<string, string> = {}): number {
    return this.buckets.get(labelKey(labels)) ?? 0;
  }
  serialise(): Record<string, number> {
    return Object.fromEntries(this.buckets);
  }
}

class InMemoryHistogram implements Histogram {
  private buckets = new Map<string, number[]>();
  observe(value: number, labels: Record<string, string> = {}): void {
    const k = labelKey(labels);
    let arr = this.buckets.get(k);
    if (!arr) { arr = []; this.buckets.set(k, arr); }
    arr.push(value);
    if (arr.length > 5_000) arr.splice(0, arr.length - 5_000);
  }
  snapshot(labels: Record<string, string> = {}): { count: number; sum: number; min: number; max: number; p50: number; p95: number } {
    const arr = this.buckets.get(labelKey(labels)) ?? [];
    if (!arr.length) return { count: 0, sum: 0, min: 0, max: 0, p50: 0, p95: 0 };
    const sorted = [...arr].sort((a, b) => a - b);
    const sum = arr.reduce((s, x) => s + x, 0);
    return {
      count: arr.length,
      sum,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
    };
  }
  serialise(): Record<string, ReturnType<InMemoryHistogram["snapshot"]>> {
    const out: Record<string, ReturnType<InMemoryHistogram["snapshot"]>> = {};
    for (const k of this.buckets.keys()) {
      const labels = JSON.parse(k || "{}") as Record<string, string>;
      out[k] = this.snapshot(labels);
    }
    return out;
  }
}

function labelKey(labels: Record<string, string>): string {
  const keys = Object.keys(labels).sort();
  if (!keys.length) return "";
  return JSON.stringify(Object.fromEntries(keys.map((k) => [k, labels[k]])));
}

export class InMemoryPromptMetrics implements PromptMetrics {
  private counters = new Map<string, InMemoryCounter>();
  private histograms = new Map<string, InMemoryHistogram>();
  counter(name: string): Counter {
    let c = this.counters.get(name);
    if (!c) { c = new InMemoryCounter(); this.counters.set(name, c); }
    return c;
  }
  histogram(name: string): Histogram {
    let h = this.histograms.get(name);
    if (!h) { h = new InMemoryHistogram(); this.histograms.set(name, h); }
    return h;
  }
  snapshot(): Record<string, unknown> {
    return {
      counters: Object.fromEntries(
        [...this.counters.entries()].map(([n, c]) => [n, c.serialise()]),
      ),
      histograms: Object.fromEntries(
        [...this.histograms.entries()].map(([n, h]) => [n, h.serialise()]),
      ),
    };
  }
}

export const defaultPromptMetrics: PromptMetrics = new InMemoryPromptMetrics();

// Canonical metric names.
export const METRIC_NAMES = {
  runsTotal: "prompt.runs.total",
  runsFailed: "prompt.runs.failed",
  runsCancelled: "prompt.runs.cancelled",
  cacheHits: "prompt.cache.hits",
  cacheMisses: "prompt.cache.misses",
  tokensInput: "prompt.tokens.input",
  tokensOutput: "prompt.tokens.output",
  costEstimate: "prompt.cost.estimate",
  latencyMs: "prompt.latency.ms",
  compileMs: "prompt.compile.ms",
  streamChunks: "prompt.stream.chunks",
} as const;
