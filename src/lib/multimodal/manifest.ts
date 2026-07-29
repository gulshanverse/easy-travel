/** MTIP — engine contract + capability manifest. */
import { MULTIMODAL_CAPABILITY_IDS, MULTIMODAL_CONTRACT_LIST, TRAVEL_MODES } from "./contracts";

export const MULTIMODAL_TRAVEL_ENGINE_CONTRACT = Object.freeze({
  id: "multimodal.travel.platform",
  name: "Multi-Modal Travel Intelligence Platform",
  version: "1.0.0",
  ownership: {
    owns: [
      "flight-runtime", "hotel-runtime", "maps-runtime", "weather-runtime",
      "transit-runtime", "currency-runtime", "timezone-runtime",
      "travel-connector-registry", "travel-connector-factory", "travel-connector-resolver",
      "travel-connector-health", "travel-connector-metrics", "travel-capability-contracts",
      "travel-response-normalization", "mock-travel-providers", "travel-presentation-models",
    ],
    doesNotOwn: [
      "transport", "credentials", "booking", "payments", "authentication", "persistence",
      "journey-planning-intelligence", "decision-logic", "agent-logic", "ctor", "ipcf",
      "workflow-runtime", "memory", "trust", "goal", "spatial", "studio",
      "knowledge-graph", "prompt-runtime", "ui-rendering", "railway",
    ],
  },
  dependencies: {
    frozenEngines: ["integration.runtime"],
    rule: "every outbound capability call is executed by IPCF; long-running work is owned by the Workflow Runtime; discovery and tool execution go through CTOR",
  },
  publicApis: [
    "createMultiModalTravelRuntime", "MultiModalTravelRuntime",
    "FlightRuntime", "HotelRuntime", "MapsRuntime", "WeatherRuntime",
    "TransitRuntime", "CurrencyRuntime", "TimezoneRuntime",
    "TravelConnectorRegistry", "TravelConnectorFactory", "TravelConnectorResolver",
    "TravelConnectorHealth", "MultiModalMetrics", "MultiModalEventBus",
    "normalizeTravelPayload", "MULTIMODAL_CONTRACTS", "MULTIMODAL_CONTRACT_LIST",
  ],
  modes: TRAVEL_MODES,
  capabilities: MULTIMODAL_CAPABILITY_IDS,
  events: [
    "FlightUpdated", "WeatherChanged", "HotelPriceChanged", "TransitUpdated",
    "CurrencyUpdated", "TimezoneResolved", "TravelSegmentUpdated",
  ],
  adr: ["ADR-008", "ADR-013", "ADR-016", "ADR-017", "ADR-018"],
});

export const MULTIMODAL_TRAVEL_CAPABILITY_MANIFEST = Object.freeze({
  id: "multimodal.travel.capability",
  version: "1.0.0",
  category: "travel",
  capabilities: MULTIMODAL_CONTRACT_LIST,
  normalizedModels: [
    "NormalizedFlight", "NormalizedAirport", "NormalizedHotel", "NormalizedRoom",
    "NormalizedWeather", "NormalizedForecast", "NormalizedTransit", "NormalizedMapRoute",
    "NormalizedLocation", "NormalizedCurrency", "NormalizedExchangeRate", "NormalizedTimezone",
    "NormalizedPlace", "NormalizedTravelSegment", "NormalizedTravelCost", "NormalizedTravelDuration",
  ],
  providers: [
    { id: "mock-flight", mode: "flight", functional: true, kind: "mock" },
    { id: "mock-hotel", mode: "hotel", functional: true, kind: "mock" },
    { id: "mock-maps", mode: "maps", functional: true, kind: "mock" },
    { id: "mock-weather", mode: "weather", functional: true, kind: "mock" },
    { id: "mock-transit", mode: "transit", functional: true, kind: "mock" },
    { id: "mock-currency", mode: "currency", functional: true, kind: "mock" },
    { id: "mock-timezone", mode: "timezone", functional: true, kind: "mock" },
  ],
  observability: [
    "capability-usage", "connector-usage", "provider-health", "latency-metrics",
    "structured-logging", "tracing-spans", "health-checks",
  ],
  outOfScope: [
    "real-provider-apis", "booking", "payments", "authentication-ui",
    "streaming", "voice", "mobile-ui", "persistence", "network-requests",
  ],
});
