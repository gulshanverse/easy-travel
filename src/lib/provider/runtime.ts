/**
 * Provider Runtime — Top-level facade.
 *
 * Consumers use ONLY this class. Internal subsystems (registry, selector,
 * router, health, pipeline, credentials, metrics, telemetry) stay private
 * to the runtime module. Every future engine (Journey, Recommendation,
 * Knowledge Graph, etc.) MUST route AI provider calls through this façade.
 */
import type { CredentialManager } from "./credentials";
import { UsageTracker } from "./cost";
import { loadProviderConfiguration, type ProviderConfiguration } from "./config";
import { defaultProviderEventPublisher, type ProviderEventPublisher } from "./events";
import { ProviderHealthManager } from "./health";
import { ProviderHealthChecks } from "./health-checks";
import { ProviderManager } from "./manager";
import { defaultProviderMetrics, type ProviderMetrics } from "./metrics";
import { ModelRegistry } from "./model-registry";
import { ExecutionPipeline } from "./pipeline";
import { ProviderRegistry } from "./registry";
import { ProviderRouter } from "./router";
import { ProviderSelector } from "./selector";
import { defaultProviderTelemetry, type ProviderTelemetry } from "./telemetry";
import type { ExecutionRequest, ExecutionResult } from "./types";

export interface ProviderRuntimeOptions {
  config?: Partial<ProviderConfiguration>;
  publisher?: ProviderEventPublisher;
  telemetry?: ProviderTelemetry;
  metrics?: ProviderMetrics;
  credentials?: CredentialManager;
}

export class ProviderRuntime {
  readonly config: ProviderConfiguration;
  readonly publisher: ProviderEventPublisher;
  readonly telemetry: ProviderTelemetry;
  readonly metrics: ProviderMetrics;
  readonly providers: ProviderRegistry;
  readonly models: ModelRegistry;
  readonly manager: ProviderManager;
  readonly health: ProviderHealthManager;
  readonly selector: ProviderSelector;
  readonly router: ProviderRouter;
  readonly usage: UsageTracker;
  readonly pipeline: ExecutionPipeline;
  readonly healthChecks: ProviderHealthChecks;
  readonly credentials?: CredentialManager;

  constructor(opts: ProviderRuntimeOptions = {}) {
    this.config = loadProviderConfiguration(opts.config);
    this.publisher = opts.publisher ?? defaultProviderEventPublisher;
    this.telemetry = opts.telemetry ?? defaultProviderTelemetry;
    this.metrics = opts.metrics ?? defaultProviderMetrics;
    this.credentials = opts.credentials;

    this.providers = new ProviderRegistry(this.publisher);
    this.models = new ModelRegistry();
    this.manager = new ProviderManager(this.providers);
    this.health = new ProviderHealthManager(this.config.health, this.config.circuitBreaker, this.publisher);
    this.selector = new ProviderSelector(this.providers, this.models, this.health);
    this.router = new ProviderRouter(this.selector, this.config.fallback);
    this.usage = new UsageTracker();

    this.pipeline = new ExecutionPipeline({
      config: this.config,
      registry: this.providers,
      models: this.models,
      router: this.router,
      health: this.health,
      credentials: this.credentials,
      publisher: this.publisher,
      telemetry: this.telemetry,
      metrics: this.metrics,
      usage: this.usage,
    });

    this.healthChecks = new ProviderHealthChecks(
      this.providers,
      this.models,
      this.health,
      this.metrics,
      this.usage,
    );
  }

  execute<T = unknown>(request: ExecutionRequest): Promise<ExecutionResult<T>> {
    return this.pipeline.run<T>(request);
  }
}

export function createDefaultProviderRuntime(opts: ProviderRuntimeOptions = {}): ProviderRuntime {
  return new ProviderRuntime(opts);
}
