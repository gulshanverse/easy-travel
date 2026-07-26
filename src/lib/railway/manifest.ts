/** RICS — engine contract + capability manifest. */
import { RAILWAY_CAPABILITY_IDS, RAILWAY_CONTRACT_LIST } from "./contracts";

export const RAILWAY_CONNECTOR_ENGINE_CONTRACT = Object.freeze({
  id: "railway.connector.suite",
  name: "Railway Intelligence Connector Suite",
  version: "1.0.0",
  ownership: {
    owns: [
      "railway-connector-runtime", "railway-connector-registry",
      "railway-connector-manager", "railway-connector-factory",
      "railway-connector-resolver", "railway-connector-health",
      "railway-connector-metrics", "railway-capability-contracts",
      "railway-provider-adapters", "railway-response-normalization",
      "mock-railway-dataset",
    ],
    doesNotOwn: [
      "transport", "credentials", "ticket-booking", "payments", "authentication",
      "journey-planning-intelligence", "decision-logic", "agent-logic", "ctor",
      "memory", "trust", "goal", "spatial", "studio", "knowledge-graph",
      "prompt-runtime", "persistence", "ui-rendering", "maps", "hotels",
      "flights", "weather", "notifications",
    ],
  },
  dependencies: {
    frozenEngines: ["integration.runtime"],
    rule: "every outbound capability call is executed by IPCF; adapters are reachable only from the IPCF executor hook",
  },
  publicApis: [
    "createRailwayConnectorRuntime", "RailwayConnectorRuntime", "RailwayConnectorRegistry",
    "RailwayConnectorManager", "RailwayConnectorFactory", "RailwayConnectorResolver",
    "RailwayConnectorHealth", "RailwayConnectorMetrics",
    "createMockRailProvider", "normalizeRailwayPayload",
    "RAILWAY_CONTRACTS", "RAILWAY_CONTRACT_LIST",
  ],
  capabilities: RAILWAY_CAPABILITY_IDS,
  adr: ["ADR-008", "ADR-011", "ADR-012"],
});

export const RAILWAY_CONNECTOR_CAPABILITY_MANIFEST = Object.freeze({
  id: "railway.connector.capability",
  version: "1.0.0",
  category: "railway",
  capabilities: RAILWAY_CONTRACT_LIST,
  normalizedModels: [
    "NormalizedStation", "NormalizedStationMetadata", "NormalizedTrain",
    "NormalizedTrainMetadata", "NormalizedSchedule", "NormalizedRoute",
    "NormalizedJourney", "NormalizedFare", "NormalizedSeatAvailability",
    "NormalizedCoachLayout", "NormalizedPlatform", "NormalizedPNR",
    "NormalizedJourneyHistory", "NormalizedLiveStatus", "NormalizedAlert",
    "NormalizedDelay", "NormalizedCancellation", "NormalizedDiversion",
  ],
  providers: [
    { id: "mock-rail", functional: true, kind: "mock" },
    { id: "national-reservation", functional: false, kind: "national" },
    { id: "national-enquiry", functional: false, kind: "national" },
    { id: "grievance-alerts", functional: false, kind: "national" },
    { id: "international-template", functional: false, kind: "international" },
  ],
  observability: [
    "connector-metrics", "request-metrics", "response-metrics",
    "normalization-metrics", "latency-metrics", "health-checks", "structured-logging",
  ],
  outOfScope: [
    "booking", "payments", "captcha", "user-authentication",
    "production-credentials", "external-sdks", "network-requests",
  ],
});
