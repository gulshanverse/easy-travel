/** IPCF — metrics. */
export interface IntegrationMetricsSnapshot {
  readonly connectors: { registered: number; validated: number; enabled: number; disabled: number; retired: number };
  readonly invocations: { total: number; ok: number; failed: number; retried: number; timedOut: number };
  readonly latencyMs: { count: number; sum: number; min: number; max: number; avg: number };
  readonly authentication: { attempts: number; ok: number; failed: number };
  readonly webhooks: { registered: number; received: number; failed: number };
  readonly polling: { scheduled: number; triggered: number; failed: number };
  readonly retries: { scheduled: number; exhausted: number };
  readonly circuit: { opened: number; halfOpened: number; closed: number };
  readonly rateLimits: { exceeded: number };
  readonly dlq: { queued: number };
  readonly transformations: { request: number; response: number };
  readonly normalizations: { request: number; response: number };
}

export class IntegrationMetrics {
  private c = { registered: 0, validated: 0, enabled: 0, disabled: 0, retired: 0 };
  private i = { total: 0, ok: 0, failed: 0, retried: 0, timedOut: 0 };
  private l = { count: 0, sum: 0, min: Number.POSITIVE_INFINITY, max: 0 };
  private a = { attempts: 0, ok: 0, failed: 0 };
  private w = { registered: 0, received: 0, failed: 0 };
  private p = { scheduled: 0, triggered: 0, failed: 0 };
  private r = { scheduled: 0, exhausted: 0 };
  private cb = { opened: 0, halfOpened: 0, closed: 0 };
  private rl = { exceeded: 0 };
  private dlq = { queued: 0 };
  private tr = { request: 0, response: 0 };
  private nr = { request: 0, response: 0 };

  connectorRegistered() { this.c.registered++; }
  connectorValidated() { this.c.validated++; }
  connectorEnabled() { this.c.enabled++; }
  connectorDisabled() { this.c.disabled++; }
  connectorRetired() { this.c.retired++; }
  invocation(ok: boolean, latencyMs: number, opts: { retried?: boolean; timedOut?: boolean } = {}) {
    this.i.total++;
    if (ok) this.i.ok++; else this.i.failed++;
    if (opts.retried) this.i.retried++;
    if (opts.timedOut) this.i.timedOut++;
    this.l.count++;
    this.l.sum += latencyMs;
    this.l.min = Math.min(this.l.min, latencyMs);
    this.l.max = Math.max(this.l.max, latencyMs);
  }
  authAttempt(ok: boolean) { this.a.attempts++; if (ok) this.a.ok++; else this.a.failed++; }
  webhookRegistered() { this.w.registered++; }
  webhookReceived() { this.w.received++; }
  webhookFailed() { this.w.failed++; }
  pollingScheduled() { this.p.scheduled++; }
  pollingTriggered() { this.p.triggered++; }
  pollingFailed() { this.p.failed++; }
  retryScheduled() { this.r.scheduled++; }
  retryExhausted() { this.r.exhausted++; }
  circuitOpened() { this.cb.opened++; }
  circuitHalfOpened() { this.cb.halfOpened++; }
  circuitClosed() { this.cb.closed++; }
  rateLimited() { this.rl.exceeded++; }
  dlqQueued() { this.dlq.queued++; }
  transformRequest() { this.tr.request++; }
  transformResponse() { this.tr.response++; }
  normalizeRequest() { this.nr.request++; }
  normalizeResponse() { this.nr.response++; }

  snapshot(): IntegrationMetricsSnapshot {
    const avg = this.l.count === 0 ? 0 : this.l.sum / this.l.count;
    const min = this.l.count === 0 ? 0 : this.l.min;
    return Object.freeze({
      connectors: { ...this.c },
      invocations: { ...this.i },
      latencyMs: { count: this.l.count, sum: this.l.sum, min, max: this.l.max, avg },
      authentication: { ...this.a },
      webhooks: { ...this.w },
      polling: { ...this.p },
      retries: { ...this.r },
      circuit: { ...this.cb },
      rateLimits: { ...this.rl },
      dlq: { ...this.dlq },
      transformations: { ...this.tr },
      normalizations: { ...this.nr },
    });
  }
}
