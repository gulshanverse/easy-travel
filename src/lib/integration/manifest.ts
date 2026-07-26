/** IPCF — engine contract + capability manifest. */
import { CONNECTOR_CATEGORIES } from "./categories";

export const INTEGRATION_ENGINE_CONTRACT = Object.freeze({
  id: "integration.runtime",
  name: "Integration Platform & Connector Framework",
  version: "1.0.0",
  ownership: {
    owns: [
      "connector-runtime", "connector-registry", "connector-lifecycle",
      "connector-discovery", "connector-contracts", "authentication-abstractions",
      "secret-references", "rate-limiting", "retry-policies", "circuit-breakers",
      "webhook-runtime", "polling-runtime", "event-normalization",
      "request-response-transformation", "connector-health", "connector-versioning",
      "connector-capability-discovery", "connector-governance",
      "connector-sandbox", "connector-testing-framework",
    ],
    doesNotOwn: [
      "maps", "weather", "railway-provider-apis", "flights", "hotels", "payments",
      "notifications", "business-logic", "journey-planning",
      "decision-logic", "agent-logic", "ctor", "domain-intelligence",
      "memory", "trust", "goal", "spatial", "studio", "knowledge-graph",
      "prompt-runtime", "persistence", "ui-rendering",
    ],
  },
  dependencies: {
    frozenEngines: ["runtime.kernel", "agent.runtime", "ctor.runtime", "provider.runtime"],
    ports: [
      "IntegrationKernelPort", "IntegrationAgentPort",
      "IntegrationCtorPort", "IntegrationProviderPort",
      "IntegrationSecretProvider",
    ],
  },
  consumedEvents: [
    "AgentCapabilityRequested", "CTORToolInvoked", "ProviderExecutionRequested",
  ],
  publishedEvents: [
    "ConnectorRegistered", "ConnectorValidated", "ConnectorEnabled", "ConnectorDisabled",
    "ConnectorRetired", "ConnectorInvoked", "ConnectorFailed", "ConnectorRecovered",
    "ConnectorHealthChanged", "RequestNormalized", "ResponseNormalized",
    "WebhookRegistered", "WebhookReceived", "WebhookFailed",
    "PollingScheduled", "PollingTriggered", "PollingFailed",
    "RetryScheduled", "RetryExhausted", "DeadLetterQueued",
    "CircuitOpened", "CircuitHalfOpened", "CircuitClosed",
    "RateLimitExceeded",
  ],
  publicApis: [
    "createIntegrationRuntime", "IntegrationRuntime", "IntegrationRuntimeFacade",
    "ConnectorManager", "ConnectorRegistry",
    "WebhookRegistry", "WebhookManager",
    "PollingRegistry", "PollingScheduler",
    "AuthenticationRegistry",
    "RateLimiter", "ConcurrencyLimiter", "CircuitBreaker",
    "DeadLetterQueue", "EventRouter", "EventNormalizer",
    "makeConnector", "makeDefinition", "makeManifest", "makePolicy",
    "makeAuthentication", "makeCredentialRef", "makeCapability", "makeContract",
    "runPipeline", "normalizeResponse", "withRetry", "computeBackoff",
  ],
  ports: [
    "IntegrationKernelPort", "IntegrationAgentPort",
    "IntegrationCtorPort", "IntegrationProviderPort",
    "IntegrationSecretProvider",
  ],
  extensionPoints: [
    "PipelineHooks.requestTransformers",
    "PipelineHooks.responseTransformers",
    "PipelineHooks.executors",
    "AuthenticationRegistry",
    "IntegrationTelemetrySink",
    "IntegrationPolicies",
  ],
  adr: ["ADR-008", "ADR-009", "ADR-010"],
});

export const INTEGRATION_CAPABILITY_MANIFEST = Object.freeze({
  id: "integration.capability",
  version: "1.0.0",
  supportedConnectorCategories: CONNECTOR_CATEGORIES,
  authenticationMethods: [
    "api-key", "oauth2", "oauth2-pkce", "jwt", "bearer",
    "basic", "hmac", "service-account", "client-credentials", "anonymous",
  ],
  runtimeFeatures: [
    "connector-registration", "connector-lifecycle", "connector-discovery",
    "capability-lookup", "dependency-validation", "version-compatibility",
    "request-pipeline", "response-normalization",
    "webhook-runtime", "polling-runtime", "event-normalization",
    "dead-letter-queue", "retry-scheduler",
  ],
  governanceFeatures: [
    "rate-limiting", "concurrency-limiting", "circuit-breaker",
    "execution-budget", "sandbox-isolation", "capability-validation",
    "permission-policies",
  ],
  extensionHooks: [
    "PipelineHooks.requestTransformers",
    "PipelineHooks.responseTransformers",
    "PipelineHooks.executors",
    "AuthenticationRegistry.registerHook",
    "AuthenticationRegistry.registerRefresher",
    "IntegrationSecretProvider",
    "IntegrationTelemetrySink",
  ],
  futureIntegrations: [
    "persistent-connector-store", "connector-marketplace",
    "signed-connector-manifests", "distributed-rate-limits",
    "outbound-egress-proxy",
  ],
});
