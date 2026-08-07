/**
 * IAM Platform — in-memory metrics registry (counters + latency histograms).
 * Metrics are observability only; they never carry credential material.
 */
export interface IamHistogram {
  count: number;
  sum: number;
  min: number;
  max: number;
}

export interface IamMetricsSnapshot {
  readonly counters: Readonly<Record<string, number>>;
  readonly histograms: Readonly<Record<string, IamHistogram>>;
}

export class IamMetrics {
  private readonly counters = new Map<string, number>();
  private readonly hist = new Map<string, IamHistogram>();

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
  histogram(name: string): IamHistogram | undefined {
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
  snapshot(): IamMetricsSnapshot {
    return Object.freeze({
      counters: Object.fromEntries(this.counters),
      histograms: Object.fromEntries([...this.hist].map(([k, v]) => [k, { ...v }])),
    });
  }
  reset(): void {
    this.counters.clear();
    this.hist.clear();
  }
}

export const IAM_METRIC = Object.freeze({
  loginSuccess: "iam.auth.login.success",
  loginFailure: "iam.auth.login.failure",
  loginLatency: "iam.auth.login.latency_ms",
  logout: "iam.auth.logout",
  reauth: "iam.auth.reauthentication",
  guestSessions: "iam.auth.guest_sessions",
  passwordChanges: "iam.password.changes",
  passwordRejections: "iam.password.rejections",
  passwordHashLatency: "iam.password.hash.latency_ms",
  tokensIssued: "iam.token.issued",
  tokensRotated: "iam.token.rotated",
  tokensRevoked: "iam.token.revoked",
  tokenValidations: "iam.token.validations",
  tokenFailures: "iam.token.failures",
  sessionsStarted: "iam.session.started",
  sessionsRevoked: "iam.session.revoked",
  sessionsExpired: "iam.session.expired",
  devicesRegistered: "iam.device.registered",
  devicesTrusted: "iam.device.trusted",
  devicesRevoked: "iam.device.revoked",
  permissionChecks: "iam.permission.checks",
  permissionDenials: "iam.permission.denials",
  roleAssignments: "iam.role.assignments",
  apiKeysIssued: "iam.apikey.issued",
  apiKeysRotated: "iam.apikey.rotated",
  apiKeysRevoked: "iam.apikey.revoked",
  lockouts: "iam.security.lockouts",
  suspiciousLogins: "iam.security.suspicious",
  rateLimited: "iam.security.rate_limited",
  auditRecords: "iam.audit.records",
});
