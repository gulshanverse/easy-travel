/** WAR — WorkflowRuntime facade. */
import { mergeWorkflowRuntimeConfig, type WorkflowRuntimeConfig } from "./config";
import { WorkflowEventBus, type WorkflowEventListener } from "./events";
import { WorkflowMetrics, type WorkflowMetricsSnapshot } from "./metrics";
import { noopWorkflowTelemetry, type WorkflowTelemetrySink } from "./telemetry";
import { SystemClock, type WorkflowClock } from "./clock";
import { createWorkflowManager } from "./factory";
import { WorkflowManager } from "./manager";
import { collectWorkflowHealth, type WorkflowHealthReport } from "./health";
import { builtinWorkflows } from "./builtins";
import { noopAgentPort, noopCtorPort, noopIntegrationPort, type WorkflowAgentPort, type WorkflowCtorPort, type WorkflowIntegrationPort } from "./ports";
import type { WorkflowDefinition, WorkflowExecution, WorkflowInstance, WorkflowStatistics, WorkflowVariables } from "./types";

export interface WorkflowRuntimeOptions {
  readonly config?: Partial<WorkflowRuntimeConfig>;
  readonly telemetry?: WorkflowTelemetrySink;
  readonly clock?: WorkflowClock;
  readonly registerBuiltins?: boolean;
  readonly ports?: {
    ctor?: WorkflowCtorPort;
    agent?: WorkflowAgentPort;
    integration?: WorkflowIntegrationPort;
  };
}

export class WorkflowRuntime {
  readonly config: WorkflowRuntimeConfig;
  readonly events = new WorkflowEventBus();
  readonly metrics = new WorkflowMetrics();
  readonly clock: WorkflowClock;
  readonly manager: WorkflowManager;
  private readonly ports: { ctor: WorkflowCtorPort; agent: WorkflowAgentPort; integration: WorkflowIntegrationPort };

  constructor(options: WorkflowRuntimeOptions = {}) {
    this.config = mergeWorkflowRuntimeConfig(options.config);
    this.clock = options.clock ?? new SystemClock();
    this.ports = {
      ctor: options.ports?.ctor ?? noopCtorPort,
      agent: options.ports?.agent ?? noopAgentPort,
      integration: options.ports?.integration ?? noopIntegrationPort,
    };
    this.manager = createWorkflowManager({
      config: this.config, events: this.events, metrics: this.metrics,
      telemetry: options.telemetry ?? noopWorkflowTelemetry,
      clock: this.clock, ...this.ports,
    });
    if (options.registerBuiltins !== false) {
      for (const def of builtinWorkflows()) this.manager.register(def);
    }
    this.clock.onAdvance?.(() => { void this.manager.tick(); });
  }

  register(def: WorkflowDefinition): WorkflowDefinition { return this.manager.register(def); }
  definitions(): readonly WorkflowDefinition[] { return this.manager.registry.list(); }
  create(definitionId: string, variables: WorkflowVariables = {}): WorkflowInstance { return this.manager.create(definitionId, variables); }
  start(instanceId: string): Promise<WorkflowExecution> { return this.manager.start(instanceId); }
  async run(definitionId: string, variables: WorkflowVariables = {}): Promise<WorkflowExecution> {
    return this.start(this.create(definitionId, variables).id);
  }
  pause(id: string): WorkflowInstance { return this.manager.pause(id); }
  resume(id: string): Promise<WorkflowExecution> { return this.manager.resume(id); }
  cancel(id: string, reason?: string): WorkflowInstance { return this.manager.cancel(id, reason); }
  archive(id: string): WorkflowInstance { return this.manager.archive(id); }
  signal(id: string, name: string, payload?: Readonly<Record<string, unknown>>): Promise<WorkflowExecution | undefined> {
    return this.manager.signal(id, name, payload);
  }
  schedule(definitionId: string, options: { delayMs?: number; intervalMs?: number; cron?: string; variables?: WorkflowVariables }): string {
    return this.manager.schedule(definitionId, options);
  }
  tick(now?: number): Promise<number> { return this.manager.tick(now); }
  instance(id: string): WorkflowInstance { return this.manager.get(id); }
  instances(): readonly WorkflowInstance[] { return this.manager.list(); }
  replay(id: string) { return this.manager.replay(id); }
  snapshot(id: string) { return this.manager.snapshot(id); }
  recover(id: string): WorkflowInstance { return this.manager.recover(id); }
  detectDeadWorkflows(): readonly WorkflowInstance[] { return this.manager.detectDeadWorkflows(); }
  statistics(): WorkflowStatistics { return this.manager.statistics(); }
  metricsSnapshot(): WorkflowMetricsSnapshot { return this.metrics.snapshot(); }
  onEvent(l: WorkflowEventListener): () => void { return this.events.on(l); }
  health(): Promise<WorkflowHealthReport> {
    return collectWorkflowHealth(this.manager, this.ports, () => this.clock.now());
  }
  shutdown(): void { this.manager.clear(); this.events.clear(); }
}

export function createWorkflowRuntime(options: WorkflowRuntimeOptions = {}): WorkflowRuntime {
  return new WorkflowRuntime(options);
}
export const WorkflowRuntimeFacade = WorkflowRuntime;
