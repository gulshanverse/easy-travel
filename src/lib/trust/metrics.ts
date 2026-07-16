/**
 * Trust & Evidence Engine — in-memory metrics registry.
 * Counters + histograms are deterministic and reset-friendly for tests.
 */
export interface TrustMetricsSnapshot {
  readonly counters: Readonly<Record<string, number>>;
  readonly histograms: Readonly<Record<string, { count: number; sum: number; min: number; max: number }>>;
}

export class TrustMetrics {
  private readonly counters = new Map<string, number>();
  private readonly hist = new Map<string, { count: number; sum: number; min: number; max: number }>();

  inc(name: string, by = 1): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + by);
  }
  observe(name: string, value: number): void {
    const h = this.hist.get(name);
    if (!h) this.hist.set(name, { count: 1, sum: value, min: value, max: value });
    else { h.count++; h.sum += value; if (value < h.min) h.min = value; if (value > h.max) h.max = value; }
  }
  snapshot(): TrustMetricsSnapshot {
    return {
      counters: Object.fromEntries(this.counters),
      histograms: Object.fromEntries(
        Array.from(this.hist.entries()).map(([k, v]) => [k, { ...v }]),
      ),
    };
  }
  reset(): void { this.counters.clear(); this.hist.clear(); }
}
