/** IPCF — public runtime facade. */
import { collectIntegrationHealth, type IntegrationHealthReport } from "./health";
import { createIntegrationDeps, type IntegrationDeps, type IntegrationFactoryOptions } from "./factory";
import type { IntegrationEventListener } from "./events";
import type { IntegrationMetricsSnapshot } from "./metrics";
import type { ConnectorManager } from "./manager";

export class IntegrationRuntime {
  readonly deps: IntegrationDeps;
  constructor(options: IntegrationFactoryOptions = {}) {
    this.deps = createIntegrationDeps(options);
  }
  get manager(): ConnectorManager { return this.deps.manager; }
  get registry() { return this.deps.registry; }
  get webhooks() { return this.deps.webhookManager; }
  get polling() { return this.deps.pollingScheduler; }
  get events() { return this.deps.events; }
  get metrics() { return this.deps.metrics; }
  get dlq() { return this.deps.dlq; }
  get auth() { return this.deps.auth; }
  get hooks() { return this.deps.hooks; }
  get eventRouter() { return this.deps.eventRouter; }
  get eventNormalizer() { return this.deps.eventNormalizer; }

  onEvent(l: IntegrationEventListener): () => void { return this.deps.events.on(l); }
  metricsSnapshot(): IntegrationMetricsSnapshot { return this.deps.metrics.snapshot(); }
  health(): Promise<IntegrationHealthReport> { return collectIntegrationHealth(this.deps); }
  shutdown(): void {
    this.deps.registry.clear();
    this.deps.webhookRegistry.clear();
    this.deps.webhookManager.clear();
    this.deps.pollingRegistry.clear();
    this.deps.dlq.clear();
    this.deps.eventRouter.clear();
    this.deps.events.clear();
    this.deps.rateLimiter.reset();
    this.deps.circuit.reset();
    this.deps.concurrency.reset();
  }
}

export function createIntegrationRuntime(options: IntegrationFactoryOptions = {}): IntegrationRuntime {
  return new IntegrationRuntime(options);
}

export const IntegrationRuntimeFacade = IntegrationRuntime;
