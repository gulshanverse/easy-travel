/**
 * NCP — metrics registry (counters + latency histograms).
 * Observability only; never carries message content or PII.
 */
export interface NotificationHistogram {
  count: number;
  sum: number;
  min: number;
  max: number;
}

export interface NotificationMetricsSnapshot {
  readonly counters: Readonly<Record<string, number>>;
  readonly histograms: Readonly<Record<string, NotificationHistogram>>;
}

export const NCP_METRIC = Object.freeze({
  created: "ncp.notification.created",
  suppressed: "ncp.notification.suppressed",
  deduped: "ncp.notification.deduped",
  rateLimited: "ncp.notification.rate_limited",
  queued: "ncp.notification.queued",
  rendered: "ncp.template.rendered",
  renderFailed: "ncp.template.render_failed",
  sent: "ncp.delivery.sent",
  delivered: "ncp.delivery.delivered",
  failed: "ncp.delivery.failed",
  retried: "ncp.delivery.retried",
  deadLettered: "ncp.delivery.dead_lettered",
  read: "ncp.inapp.read",
  digestFlushed: "ncp.digest.flushed",
  dispatchLatency: "ncp.dispatch.latency_ms",
  sendLatency: "ncp.provider.latency_ms",
} as const);

export class NotificationMetrics {
  private readonly counters = new Map<string, number>();
  private readonly hist = new Map<string, NotificationHistogram>();

  inc(name: string, by = 1): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + by);
  }

  observe(name: string, value: number): void {
    const h = this.hist.get(name);
    if (!h) this.hist.set(name, { count: 1, sum: value, min: value, max: value });
    else {
      h.count++;
      h.sum += value;
      if (value < h.min) h.min = value;
      if (value > h.max) h.max = value;
    }
  }

  counter(name: string): number {
    return this.counters.get(name) ?? 0;
  }

  histogram(name: string): NotificationHistogram | undefined {
    const h = this.hist.get(name);
    return h ? { ...h } : undefined;
  }

  async timed<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const t0 = Date.now();
    try {
      return await fn();
    } finally {
      this.observe(name, Date.now() - t0);
    }
  }

  snapshot(): NotificationMetricsSnapshot {
    return Object.freeze({
      counters: Object.freeze(Object.fromEntries([...this.counters.entries()].sort())),
      histograms: Object.freeze(
        Object.fromEntries([...this.hist.entries()].sort().map(([k, v]) => [k, { ...v }])),
      ),
    });
  }

  clear(): void {
    this.counters.clear();
    this.hist.clear();
  }
}
