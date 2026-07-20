/** CTOR — CapabilityRuntime facade. */
import { DEFAULT_CTOR_CONFIG, mergeCTORConfig, type CTORConfig } from "./config";
import { DEFAULT_CTOR_POLICIES, mergePolicies, type CTORPolicies } from "./policies";
import { CTOREventBus, type CTOREventListener } from "./events";
import { CTORMetrics, type CTORMetricsSnapshot } from "./metrics";
import { noopCTORTelemetry, type CTORTelemetrySink } from "./telemetry";
import { CapabilityManager } from "./manager";
import { createCapabilityManager } from "./factory";
import { collectCTORHealth, type CTORHealthDeps, type CTORHealthReport } from "./health";
import type {
  CTORDecisionPort, CTORGoalPort, CTORGraphPort, CTORJourneyPort, CTORKernelPort,
  CTORMemoryPort, CTORPromptPort, CTORProviderPort, CTORSpatialPort, CTORTrustPort,
} from "./ports";

export interface CapabilityRuntimeOptions {
  readonly config?: Partial<CTORConfig>;
  readonly policies?: Partial<CTORPolicies>;
  readonly telemetry?: CTORTelemetrySink;
  readonly now?: () => number;
  readonly ports?: {
    memory?: CTORMemoryPort; prompt?: CTORPromptPort; kernel?: CTORKernelPort;
    provider?: CTORProviderPort; graph?: CTORGraphPort; journey?: CTORJourneyPort;
    decision?: CTORDecisionPort; trust?: CTORTrustPort; goal?: CTORGoalPort;
    spatial?: CTORSpatialPort;
  };
}

export class CapabilityRuntime {
  readonly config: CTORConfig;
  readonly policies: CTORPolicies;
  readonly events = new CTOREventBus();
  readonly metrics = new CTORMetrics();
  readonly manager: CapabilityManager;
  private readonly telemetry: CTORTelemetrySink;
  private readonly portDeps: CTORHealthDeps;
  private readonly managers = new Map<string, CapabilityManager>();

  constructor(options: CapabilityRuntimeOptions = {}) {
    this.config = mergeCTORConfig(options.config);
    this.policies = mergePolicies(options.policies);
    this.telemetry = options.telemetry ?? noopCTORTelemetry;
    this.portDeps = options.ports ?? {};
    this.manager = createCapabilityManager({
      events: this.events, metrics: this.metrics, telemetry: this.telemetry,
      policies: this.policies, maxConcurrency: this.config.maxConcurrency, now: options.now,
    });
    this.managers.set("default", this.manager);
  }

  createManager(id: string): CapabilityManager {
    const m = createCapabilityManager({
      events: this.events, metrics: this.metrics, telemetry: this.telemetry,
      policies: this.policies, maxConcurrency: this.config.maxConcurrency,
    });
    this.managers.set(id, m);
    return m;
  }
  listManagers(): readonly string[] { return [...this.managers.keys()]; }
  metricsSnapshot(): CTORMetricsSnapshot { return this.metrics.snapshot(); }
  onEvent(l: CTOREventListener): () => void { return this.events.on(l); }
  health(): Promise<CTORHealthReport> { return collectCTORHealth(this.manager, this.portDeps); }
  shutdown(): void {
    for (const m of this.managers.values()) m.clear();
    this.managers.clear();
    this.events.clear();
  }
}

export function createCapabilityRuntime(options: CapabilityRuntimeOptions = {}): CapabilityRuntime {
  return new CapabilityRuntime(options);
}
export const CapabilityRuntimeFacade = CapabilityRuntime;

export { DEFAULT_CTOR_CONFIG, DEFAULT_CTOR_POLICIES };
