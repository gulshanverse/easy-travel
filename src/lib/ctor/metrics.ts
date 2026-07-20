/** CTOR — metrics. */
export interface CTORMetricsSnapshot {
  readonly capabilities: { registered: number; active: number; removed: number };
  readonly tools: { registered: number; invocations: number; failures: number };
  readonly workflows: { started: number; completed: number; failed: number; cancelled: number; durationMsTotal: number };
  readonly execution: { retries: number; timeouts: number; cancelled: number };
  readonly latency: { workflowP50: number; workflowP95: number; workflowMax: number };
}

export class CTORMetrics {
  private capsReg = 0; private capsActive = 0; private capsRemoved = 0;
  private toolsReg = 0; private toolInv = 0; private toolFail = 0;
  private wfStarted = 0; private wfCompleted = 0; private wfFailed = 0; private wfCancelled = 0;
  private wfDurations: number[] = [];
  private retries = 0; private timeouts = 0; private cancelled = 0;

  capabilityRegistered() { this.capsReg++; this.capsActive++; }
  capabilityRemoved() { this.capsRemoved++; this.capsActive = Math.max(0, this.capsActive - 1); }
  toolRegistered() { this.toolsReg++; }
  toolInvoked(ok: boolean) { this.toolInv++; if (!ok) this.toolFail++; }
  workflowStarted() { this.wfStarted++; }
  workflowCompleted(ms: number) { this.wfCompleted++; this.wfDurations.push(ms); if (this.wfDurations.length > 1024) this.wfDurations.shift(); }
  workflowFailed(ms: number) { this.wfFailed++; this.wfDurations.push(ms); }
  workflowCancelled() { this.wfCancelled++; }
  retry() { this.retries++; }
  timeout() { this.timeouts++; }
  cancel() { this.cancelled++; }

  snapshot(): CTORMetricsSnapshot {
    const sorted = [...this.wfDurations].sort((a, b) => a - b);
    const pct = (p: number) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : 0;
    return {
      capabilities: { registered: this.capsReg, active: this.capsActive, removed: this.capsRemoved },
      tools: { registered: this.toolsReg, invocations: this.toolInv, failures: this.toolFail },
      workflows: {
        started: this.wfStarted, completed: this.wfCompleted,
        failed: this.wfFailed, cancelled: this.wfCancelled,
        durationMsTotal: this.wfDurations.reduce((a, b) => a + b, 0),
      },
      execution: { retries: this.retries, timeouts: this.timeouts, cancelled: this.cancelled },
      latency: { workflowP50: pct(0.5), workflowP95: pct(0.95), workflowMax: sorted.at(-1) ?? 0 },
    };
  }
  reset() {
    this.capsReg = this.capsActive = this.capsRemoved = 0;
    this.toolsReg = this.toolInv = this.toolFail = 0;
    this.wfStarted = this.wfCompleted = this.wfFailed = this.wfCancelled = 0;
    this.wfDurations = []; this.retries = this.timeouts = this.cancelled = 0;
  }
}
