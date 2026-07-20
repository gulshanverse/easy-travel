/** CTOR — factory for CapabilityManager wiring. */
import type { CTOREventBus } from "./events";
import type { CTORMetrics } from "./metrics";
import type { CTORTelemetrySink } from "./telemetry";
import type { CTORPolicies } from "./policies";
import { CapabilityManager } from "./manager";
import { CapabilityRegistry, ToolRegistry } from "./registry";
import { WorkflowScheduler } from "./workflow";

export interface CreateCapabilityManagerInput {
  readonly events: CTOREventBus;
  readonly metrics: CTORMetrics;
  readonly telemetry: CTORTelemetrySink;
  readonly policies: CTORPolicies;
  readonly maxConcurrency?: number;
  readonly now?: () => number;
}
export function createCapabilityManager(i: CreateCapabilityManagerInput): CapabilityManager {
  return new CapabilityManager({
    capabilities: new CapabilityRegistry(),
    tools: new ToolRegistry(),
    events: i.events, metrics: i.metrics, telemetry: i.telemetry, policies: i.policies,
    scheduler: new WorkflowScheduler(i.maxConcurrency ?? i.policies.maxConcurrency),
    now: i.now,
  });
}

export class CapabilityFactory {
  static create(i: CreateCapabilityManagerInput): CapabilityManager { return createCapabilityManager(i); }
}
