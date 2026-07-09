/**
 * Runtime Core — Health checks and diagnostics.
 *
 * Aggregates health across the ServiceRegistry, CapabilityRuntime, and
 * EventBus, and produces a diagnostic snapshot (metrics + capability stats)
 * suitable for /healthz style endpoints.
 */

import type { CapabilityRuntime } from "./capability-runtime";
import type { EventBus } from "./event-bus";
import type { RuntimeMetrics } from "./metrics";
import type { ServiceRegistry } from "./service-registry";

export interface RuntimeHealth {
  status: "healthy" | "degraded" | "unhealthy";
  checks: { name: string; status: "pass" | "warn" | "fail"; detail?: string }[];
  timestamp: number;
}

export interface RuntimeDiagnostics {
  health: RuntimeHealth;
  metrics: ReturnType<RuntimeMetrics["snapshot"]>;
  capabilities: ReturnType<CapabilityRuntime["health"]>;
  services: number;
  eventHandlers: number;
}

export class RuntimeHealthChecks {
  constructor(
    private readonly registry: ServiceRegistry,
    private readonly capabilities: CapabilityRuntime,
    private readonly eventBus: EventBus,
    private readonly metrics: RuntimeMetrics,
  ) {}

  async check(): Promise<RuntimeHealth> {
    const checks: RuntimeHealth["checks"] = [];
    const services = await this.registry.health();
    for (const [id, svc] of Object.entries(services)) {
      checks.push({
        name: `service:${id}`,
        status: svc.status === "healthy" ? "pass" : svc.status === "degraded" ? "warn" : "fail",
        detail: svc.detail,
      });
    }
    const caps = this.capabilities.list().length;
    checks.push({
      name: "capabilities",
      status: "pass",
      detail: `registered=${caps} inflight=${this.capabilities.inflightCount()}`,
    });
    checks.push({
      name: "event_bus",
      status: "pass",
      detail: `handlers=${this.eventBus.totalHandlers()}`,
    });
    const failing = checks.filter((c) => c.status === "fail").length;
    const warning = checks.filter((c) => c.status === "warn").length;
    const status: RuntimeHealth["status"] =
      failing > 0 ? "unhealthy" : warning > 0 ? "degraded" : "healthy";
    return { status, checks, timestamp: Date.now() };
  }

  async diagnostics(): Promise<RuntimeDiagnostics> {
    return {
      health: await this.check(),
      metrics: this.metrics.snapshot(),
      capabilities: this.capabilities.health(),
      services: this.registry.size(),
      eventHandlers: this.eventBus.totalHandlers(),
    };
  }
}
