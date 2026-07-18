/** Spatial Intelligence Engine — SpatialRuntime facade. */
import { mergeSpatialConfig, type SpatialConfig } from "./config";
import { SpatialEventBus, type SpatialEventListener } from "./events";
import { createSpatialManager } from "./factory";
import { collectSpatialHealth, type SpatialHealthDeps, type SpatialHealthReport } from "./health";
import { SpatialManager } from "./manager";
import { SpatialMetrics, type SpatialMetricsSnapshot } from "./metrics";
import type {
  SpatialDecisionPort, SpatialGoalPort, SpatialGraphPort, SpatialJourneyPort,
  SpatialKernelPort, SpatialMemoryPort, SpatialPromptPort, SpatialProviderPort,
  SpatialTrustPort,
} from "./ports";
import { DEFAULT_SPATIAL_POLICIES, type SpatialPolicies } from "./policies";
import { SpatialRegistry } from "./registry";
import { noopSpatialTelemetry, type SpatialTelemetrySink } from "./telemetry";

export interface SpatialRuntimeOptions {
  readonly config?: Partial<SpatialConfig>;
  readonly policies?: SpatialPolicies;
  readonly telemetry?: SpatialTelemetrySink;
  readonly ports?: {
    readonly memory?: SpatialMemoryPort;
    readonly journey?: SpatialJourneyPort;
    readonly decision?: SpatialDecisionPort;
    readonly goal?: SpatialGoalPort;
    readonly trust?: SpatialTrustPort;
    readonly graph?: SpatialGraphPort;
    readonly prompt?: SpatialPromptPort;
    readonly provider?: SpatialProviderPort;
    readonly kernel?: SpatialKernelPort;
  };
  readonly now?: () => number;
}

export class SpatialRuntime {
  readonly config: SpatialConfig;
  readonly policies: SpatialPolicies;
  readonly events = new SpatialEventBus();
  readonly metrics = new SpatialMetrics();
  readonly registry: SpatialRegistry;
  readonly manager: SpatialManager;
  private readonly telemetry: SpatialTelemetrySink;
  private readonly portDeps: SpatialHealthDeps;

  constructor(options: SpatialRuntimeOptions = {}) {
    this.config = mergeSpatialConfig(options.config);
    this.policies = options.policies ?? DEFAULT_SPATIAL_POLICIES;
    this.telemetry = options.telemetry ?? noopSpatialTelemetry;
    this.portDeps = options.ports ?? {};
    this.registry = new SpatialRegistry(this.policies);
    this.manager = createSpatialManager({
      config: this.config, telemetry: this.telemetry,
      events: this.events, metrics: this.metrics, now: options.now,
    });
    this.registry.register("default", this.manager);
  }

  createManager(id: string): SpatialManager {
    const m = createSpatialManager({
      config: this.config, telemetry: this.telemetry,
      events: this.events, metrics: this.metrics,
    });
    this.registry.register(id, m);
    return m;
  }

  metricsSnapshot(): SpatialMetricsSnapshot { return this.metrics.snapshot(); }
  onEvent(l: SpatialEventListener): () => void { return this.events.on(l); }
  health(): Promise<SpatialHealthReport> { return collectSpatialHealth(this.manager, this.portDeps); }

  shutdown(): void {
    for (const m of this.registry.list()) m.clear();
    this.registry.clear();
    this.events.clear();
  }
}

export function createSpatialRuntime(options: SpatialRuntimeOptions = {}): SpatialRuntime {
  return new SpatialRuntime(options);
}

export const SpatialRuntimeFacade = SpatialRuntime;
