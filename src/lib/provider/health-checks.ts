/**
 * Provider Runtime — Aggregated health checks + diagnostics.
 */
import type { ProviderHealthManager } from "./health";
import type { ModelRegistry } from "./model-registry";
import type { ProviderRegistry } from "./registry";
import type { UsageTracker } from "./cost";
import type { MetricsSnapshot, ProviderMetrics } from "./metrics";

export interface ProviderRuntimeHealth {
  status: "ok" | "degraded" | "critical";
  providers: number;
  models: number;
  ready: number;
  degraded: number;
  unavailable: number;
  metrics: MetricsSnapshot;
  usage: ReturnType<UsageTracker["snapshot"]>;
  providerStates: Record<string, string>;
}

export class ProviderHealthChecks {
  constructor(
    private readonly providers: ProviderRegistry,
    private readonly models: ModelRegistry,
    private readonly health: ProviderHealthManager,
    private readonly metrics: ProviderMetrics,
    private readonly usage: UsageTracker,
  ) {}

  check(): ProviderRuntimeHealth {
    const all = this.providers.list();
    let ready = 0, degraded = 0, unavailable = 0;
    const providerStates: Record<string, string> = {};
    for (const p of all) {
      const s = this.health.snapshot(p.config.id);
      providerStates[p.config.id] = s.state;
      if (s.state === "healthy") ready += 1;
      else if (s.state === "degraded") degraded += 1;
      else if (s.state === "unavailable") unavailable += 1;
    }
    const status: ProviderRuntimeHealth["status"] =
      unavailable > 0 && ready === 0 ? "critical" : degraded + unavailable > 0 ? "degraded" : "ok";
    return {
      status,
      providers: all.length,
      models: this.models.size(),
      ready,
      degraded,
      unavailable,
      metrics: this.metrics.snapshot(),
      usage: this.usage.snapshot(),
      providerStates,
    };
  }
}
