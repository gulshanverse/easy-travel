/** MTIP — observability metrics: capability usage, connector usage, latency,
 *  provider health and normalization counters. */

export interface TravelLatencyStats {
  readonly count: number;
  readonly totalMs: number;
  readonly avgMs: number;
  readonly minMs: number;
  readonly maxMs: number;
}

export interface TravelUsageStats {
  readonly requests: number;
  readonly successes: number;
  readonly failures: number;
  readonly avgLatencyMs: number;
}

export interface MultiModalMetricsSnapshot {
  readonly connectorsRegistered: number;
  readonly connectorsEnabled: number;
  readonly requests: number;
  readonly responsesOk: number;
  readonly responsesFailed: number;
  readonly normalizations: number;
  readonly normalizationFailures: number;
  readonly fallbacks: number;
  readonly resolutionFailures: number;
  readonly eventsPublished: number;
  readonly latency: TravelLatencyStats;
  readonly byCapability: Readonly<Record<string, TravelUsageStats>>;
  readonly byProvider: Readonly<Record<string, TravelUsageStats>>;
  readonly byMode: Readonly<Record<string, TravelUsageStats>>;
}

interface MutableStats { requests: number; successes: number; failures: number; totalMs: number }

export class MultiModalMetrics {
  private connectorsRegistered = 0;
  private connectorsEnabled = 0;
  private requests = 0;
  private ok = 0;
  private failed = 0;
  private normalizations = 0;
  private normalizationFailures = 0;
  private fallbacks = 0;
  private resolutionFailures = 0;
  private eventsPublished = 0;
  private latencyCount = 0;
  private latencyTotal = 0;
  private latencyMin = Number.POSITIVE_INFINITY;
  private latencyMax = 0;
  private readonly capability = new Map<string, MutableStats>();
  private readonly provider = new Map<string, MutableStats>();
  private readonly mode = new Map<string, MutableStats>();

  connectorRegistered(): void { this.connectorsRegistered += 1; }
  connectorEnabled(): void { this.connectorsEnabled += 1; }
  normalization(ok = true): void {
    this.normalizations += 1;
    if (!ok) this.normalizationFailures += 1;
  }
  fallback(): void { this.fallbacks += 1; }
  resolutionFailure(): void { this.resolutionFailures += 1; }
  eventPublished(): void { this.eventsPublished += 1; }

  request(capability: string, providerId: string, mode: string): void {
    this.requests += 1;
    this.bucket(this.capability, capability).requests += 1;
    this.bucket(this.provider, providerId).requests += 1;
    this.bucket(this.mode, mode).requests += 1;
  }

  response(capability: string, providerId: string, mode: string, success: boolean, latencyMs: number): void {
    if (success) this.ok += 1; else this.failed += 1;
    this.latencyCount += 1;
    this.latencyTotal += latencyMs;
    this.latencyMin = Math.min(this.latencyMin, latencyMs);
    this.latencyMax = Math.max(this.latencyMax, latencyMs);
    const buckets = [
      this.bucket(this.capability, capability),
      this.bucket(this.provider, providerId),
      this.bucket(this.mode, mode),
    ];
    for (const b of buckets) {
      if (success) b.successes += 1; else b.failures += 1;
      b.totalMs += latencyMs;
    }
  }

  snapshot(): MultiModalMetricsSnapshot {
    return Object.freeze({
      connectorsRegistered: this.connectorsRegistered,
      connectorsEnabled: this.connectorsEnabled,
      requests: this.requests,
      responsesOk: this.ok,
      responsesFailed: this.failed,
      normalizations: this.normalizations,
      normalizationFailures: this.normalizationFailures,
      fallbacks: this.fallbacks,
      resolutionFailures: this.resolutionFailures,
      eventsPublished: this.eventsPublished,
      latency: Object.freeze({
        count: this.latencyCount,
        totalMs: this.latencyTotal,
        avgMs: this.latencyCount === 0 ? 0 : this.latencyTotal / this.latencyCount,
        minMs: this.latencyCount === 0 ? 0 : this.latencyMin,
        maxMs: this.latencyMax,
      }),
      byCapability: this.freezeMap(this.capability),
      byProvider: this.freezeMap(this.provider),
      byMode: this.freezeMap(this.mode),
    });
  }

  reset(): void {
    this.connectorsRegistered = 0; this.connectorsEnabled = 0;
    this.requests = 0; this.ok = 0; this.failed = 0;
    this.normalizations = 0; this.normalizationFailures = 0;
    this.fallbacks = 0; this.resolutionFailures = 0; this.eventsPublished = 0;
    this.latencyCount = 0; this.latencyTotal = 0;
    this.latencyMin = Number.POSITIVE_INFINITY; this.latencyMax = 0;
    this.capability.clear(); this.provider.clear(); this.mode.clear();
  }

  private bucket(map: Map<string, MutableStats>, key: string): MutableStats {
    let s = map.get(key);
    if (!s) { s = { requests: 0, successes: 0, failures: 0, totalMs: 0 }; map.set(key, s); }
    return s;
  }
  private freezeMap(map: Map<string, MutableStats>): Readonly<Record<string, TravelUsageStats>> {
    const out: Record<string, TravelUsageStats> = {};
    for (const [k, v] of map) {
      const done = v.successes + v.failures;
      out[k] = Object.freeze({
        requests: v.requests,
        successes: v.successes,
        failures: v.failures,
        avgLatencyMs: done === 0 ? 0 : v.totalMs / done,
      });
    }
    return Object.freeze(out);
  }
}
