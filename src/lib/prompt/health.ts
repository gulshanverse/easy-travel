/**
 * Health checks and diagnostics for the prompt runtime.
 */
import type { PromptMetrics } from "./metrics";
import type { PromptRegistry } from "./registry";
import type { PromptCache } from "./cache";

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  checks: { name: string; status: "pass" | "warn" | "fail"; detail?: string }[];
  timestamp: number;
}

export class PromptHealthChecks {
  constructor(
    private readonly registry: PromptRegistry,
    private readonly cache: PromptCache,
    private readonly metrics: PromptMetrics,
  ) {}

  async check(): Promise<HealthStatus> {
    const checks: HealthStatus["checks"] = [];
    // Registry check
    const size = this.registry.size();
    checks.push({
      name: "registry",
      status: size > 0 ? "pass" : "warn",
      detail: `registered=${size}`,
    });
    // Cache check
    const cacheStats = this.cache.stats();
    checks.push({
      name: "cache",
      status: "pass",
      detail: `compiled=${cacheStats.compiled.size} context=${cacheStats.context.size}`,
    });
    // Metrics availability
    checks.push({ name: "metrics", status: "pass" });

    const failing = checks.filter((c) => c.status === "fail").length;
    const warning = checks.filter((c) => c.status === "warn").length;
    const status: HealthStatus["status"] =
      failing > 0 ? "unhealthy" : warning > 0 ? "degraded" : "healthy";
    return { status, checks, timestamp: Date.now() };
  }
}
