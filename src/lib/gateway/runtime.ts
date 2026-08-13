import {
  GatewayCache,
  InMemoryGatewayCache,
  IdempotencyManager,
  InMemoryIdempotencyStore,
} from "./caching";
import { CredentialResolver, InMemorySecretBackend, type SecretBackend } from "./credentials";
import { GatewayPipeline } from "./pipeline";
import { loadGatewayConfiguration, type GatewayConfiguration } from "./policies";
import { ProviderGatewayManager, type GatewayInvocationResult } from "./manager";
import { ProviderFactory, ProviderHealthManager, ProviderRegistry, ProviderResolver } from "./registry";
import { BudgetController, ConcurrencyLimiter, RateLimiter, InMemoryRateCounter } from "./resilience";
import { GatewayEventBus, ProviderMetrics } from "./observability";
import { NormalizationRegistry } from "./normalization";
import type { GatewayPorts } from "./ports";
import type { ProviderAdapter } from "./adapter";
import type { ProviderRequest, ProviderResponse } from "./types";

export interface ProviderGatewayRuntimeOptions {
  readonly configuration?: Partial<GatewayConfiguration>;
  readonly secretBackend?: SecretBackend;
  readonly ports?: GatewayPorts;
  readonly cache?: GatewayCache;
  readonly idempotency?: IdempotencyManager;
  readonly rateLimiter?: RateLimiter;
}

export class ProviderGatewayRuntime {
  readonly configuration: GatewayConfiguration;
  readonly registry: ProviderRegistry;
  readonly resolver: ProviderResolver;
  readonly healthManager: ProviderHealthManager;
  readonly manager: ProviderGatewayManager;
  readonly metrics: ProviderMetrics;

  constructor(options: ProviderGatewayRuntimeOptions = {}) {
    this.configuration = loadGatewayConfiguration(options.configuration);
    this.registry = new ProviderRegistry();
    this.resolver = new ProviderResolver(this.registry);
    this.healthManager = new ProviderHealthManager(this.registry);
    this.metrics = new ProviderMetrics();

    const cache = options.cache ?? new GatewayCache(new InMemoryGatewayCache());
    const idempotency = options.idempotency ?? new IdempotencyManager(new InMemoryIdempotencyStore());
    const rateLimiter = options.rateLimiter ?? new RateLimiter(new InMemoryRateCounter());
    const pipeline = new GatewayPipeline({
      config: this.configuration,
      cache,
      idempotency,
      credentials: new CredentialResolver(options.secretBackend ?? new InMemorySecretBackend()),
      rateLimiter,
      concurrency: new ConcurrencyLimiter(),
      budget: new BudgetController(),
      metrics: this.metrics,
      events: new GatewayEventBus(),
      normalization: new NormalizationRegistry(),
      ports: options.ports,
    });
    this.manager = new ProviderGatewayManager({
      registry: this.registry,
      resolver: this.resolver,
      pipeline,
    });
  }

  async register(adapter: ProviderAdapter): Promise<void> {
    await this.registry.register(adapter);
  }

  async unregister(providerId: string): Promise<boolean> {
    return this.registry.unregister(providerId);
  }

  async invoke(request: ProviderRequest): Promise<GatewayInvocationResult> {
    return this.manager.invoke(request);
  }

  async probe(providerId: string) {
    return this.healthManager.probe(providerId);
  }

  provider(providerId: string) {
    return this.registry.require(providerId);
  }

  providers() {
    return this.registry.list();
  }

  health(providerId: string) {
    return this.registry.get(providerId)?.health;
  }

  metricsFor(providerId: string) {
    return this.metrics.snapshot(providerId);
  }
}

export const createProviderGatewayRuntime = (options?: ProviderGatewayRuntimeOptions) =>
  new ProviderGatewayRuntime(options);

export type { GatewayInvocationResult } from "./manager";
export type { ProviderResponse };
export { ProviderFactory };
