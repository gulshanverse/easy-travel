/** IPCF — runtime factory (dependency wiring). */
import { AuthenticationRegistry } from "./auth";
import { mergeIntegrationConfig, type IntegrationConfig } from "./config";
import { DeadLetterQueue } from "./dlq";
import { IntegrationEventBus } from "./events";
import { EventNormalizer, EventRouter } from "./event-router";
import { CircuitBreaker, ConcurrencyLimiter, RateLimiter } from "./governance";
import { IntegrationMetrics } from "./metrics";
import { PollingRegistry, PollingScheduler } from "./polling";
import {
  noopAgentPort, noopCtorPort, noopKernelPort, noopProviderPort, noopSecretProvider,
  type IntegrationAgentPort, type IntegrationCtorPort, type IntegrationKernelPort,
  type IntegrationProviderPort, type IntegrationSecretProvider,
} from "./ports";
import { mergeIntegrationPolicies, type IntegrationPolicies } from "./policies";
import { createPipelineHooks, type PipelineHooks } from "./pipeline";
import { ConnectorRegistry } from "./registry";
import { ConnectorManager } from "./manager";
import { noopIntegrationTelemetry, type IntegrationTelemetrySink } from "./telemetry";
import type { ConnectorExecutor } from "./types";
import { WebhookManager, WebhookRegistry } from "./webhook";

export interface IntegrationFactoryOptions {
  readonly config?: Partial<IntegrationConfig>;
  readonly policies?: Partial<IntegrationPolicies>;
  readonly telemetry?: IntegrationTelemetrySink;
  readonly kernel?: IntegrationKernelPort;
  readonly agent?: IntegrationAgentPort;
  readonly ctor?: IntegrationCtorPort;
  readonly provider?: IntegrationProviderPort;
  readonly secrets?: IntegrationSecretProvider;
  readonly defaultExecutor?: ConnectorExecutor;
}

export interface IntegrationDeps {
  readonly config: IntegrationConfig;
  readonly policies: IntegrationPolicies;
  readonly telemetry: IntegrationTelemetrySink;
  readonly events: IntegrationEventBus;
  readonly metrics: IntegrationMetrics;
  readonly registry: ConnectorRegistry;
  readonly auth: AuthenticationRegistry;
  readonly rateLimiter: RateLimiter;
  readonly concurrency: ConcurrencyLimiter;
  readonly circuit: CircuitBreaker;
  readonly hooks: PipelineHooks;
  readonly webhookRegistry: WebhookRegistry;
  readonly webhookManager: WebhookManager;
  readonly pollingRegistry: PollingRegistry;
  readonly pollingScheduler: PollingScheduler;
  readonly eventNormalizer: EventNormalizer;
  readonly eventRouter: EventRouter;
  readonly dlq: DeadLetterQueue;
  readonly kernel: IntegrationKernelPort;
  readonly agent: IntegrationAgentPort;
  readonly ctor: IntegrationCtorPort;
  readonly provider: IntegrationProviderPort;
  readonly secrets: IntegrationSecretProvider;
  readonly manager: ConnectorManager;
}

export function createIntegrationDeps(options: IntegrationFactoryOptions = {}): IntegrationDeps {
  const config = mergeIntegrationConfig(options.config);
  const policies = mergeIntegrationPolicies(options.policies);
  const telemetry = options.telemetry ?? noopIntegrationTelemetry;
  const events = new IntegrationEventBus();
  events.setHistoryLimit(config.eventHistoryLimit);
  const metrics = new IntegrationMetrics();
  const registry = new ConnectorRegistry();
  const auth = new AuthenticationRegistry();
  const rateLimiter = new RateLimiter();
  const concurrency = new ConcurrencyLimiter();
  const circuit = new CircuitBreaker();
  const hooks = createPipelineHooks(options.defaultExecutor);
  const webhookRegistry = new WebhookRegistry();
  const webhookManager = new WebhookManager(webhookRegistry, config.webhookMaxDeliveries);
  const pollingRegistry = new PollingRegistry();
  const pollingScheduler = new PollingScheduler(pollingRegistry, config.pollingMinIntervalMs);
  const eventNormalizer = new EventNormalizer();
  const eventRouter = new EventRouter();
  const dlq = new DeadLetterQueue(config.dlqMaxEntries);
  const kernel = options.kernel ?? noopKernelPort;
  const agent = options.agent ?? noopAgentPort;
  const ctor = options.ctor ?? noopCtorPort;
  const provider = options.provider ?? noopProviderPort;
  const secrets = options.secrets ?? noopSecretProvider;

  const manager = new ConnectorManager({
    config, policies, registry, events, metrics, telemetry,
    auth, rateLimiter, concurrency, circuit, hooks, ctor, agent,
  });

  return {
    config, policies, telemetry, events, metrics, registry, auth,
    rateLimiter, concurrency, circuit, hooks,
    webhookRegistry, webhookManager, pollingRegistry, pollingScheduler,
    eventNormalizer, eventRouter, dlq,
    kernel, agent, ctor, provider, secrets, manager,
  };
}
