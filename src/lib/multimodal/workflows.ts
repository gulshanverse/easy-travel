/** MTIP — built-in multimodal workflow blueprints (ADR-018).
 *
 *  These are pure, immutable data structures. They are structurally compatible
 *  with the Workflow Runtime's `WorkflowDefinition` input, but MTIP does not
 *  import the Workflow Runtime. Every step targets a CTOR capability id
 *  (`multimodal.*`), and CTOR executes it through IPCF against mock providers.
 */
import { ctorCapabilityId } from "./ctor";

export type MultiModalWorkflowStepKind = "capability" | "timer" | "signal" | "noop";

export interface MultiModalWorkflowStepBlueprint {
  readonly id: string;
  readonly name: string;
  readonly kind: MultiModalWorkflowStepKind;
  readonly dependsOn: readonly string[];
  readonly capabilityId?: string;
  readonly signalName?: string;
  readonly delayMs?: number;
  readonly input?: Readonly<Record<string, unknown>>;
}

export interface MultiModalWorkflowTriggerBlueprint {
  readonly kind: "manual" | "event" | "signal" | "schedule";
  readonly name?: string;
  readonly intervalMs?: number;
  readonly delayMs?: number;
}

export interface MultiModalWorkflowBlueprint {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly mode: string;
  readonly triggers: readonly MultiModalWorkflowTriggerBlueprint[];
  readonly steps: readonly MultiModalWorkflowStepBlueprint[];
}

const step = (s: MultiModalWorkflowStepBlueprint): MultiModalWorkflowStepBlueprint =>
  Object.freeze({
    ...s,
    dependsOn: Object.freeze([...s.dependsOn]),
    input: Object.freeze({ ...(s.input ?? {}) }),
  });

const blueprint = (b: MultiModalWorkflowBlueprint): MultiModalWorkflowBlueprint =>
  Object.freeze({
    ...b,
    triggers: Object.freeze(b.triggers.map((t) => Object.freeze({ ...t }))),
    steps: Object.freeze(b.steps.map(step)),
  });

const cap = ctorCapabilityId;

export const FLIGHT_MONITORING_WORKFLOW = blueprint({
  id: "multimodal.workflow.flight-monitoring",
  name: "Flight Monitoring",
  version: "1.0.0",
  description: "Polls flight status and delay information through CTOR to IPCF.",
  mode: "flight",
  triggers: [{ kind: "schedule", intervalMs: 10 * 60_000 }],
  steps: [
    {
      id: "status",
      name: "Fetch flight status",
      kind: "capability",
      capabilityId: cap("flight_status"),
      dependsOn: [],
    },
    {
      id: "delay",
      name: "Fetch delay information",
      kind: "capability",
      capabilityId: cap("flight_delay_information"),
      dependsOn: ["status"],
    },
    {
      id: "record",
      name: "Record flight change",
      kind: "capability",
      capabilityId: "workflow.record.change",
      dependsOn: ["delay"],
    },
  ],
});

export const WEATHER_MONITORING_WORKFLOW = blueprint({
  id: "multimodal.workflow.weather-monitoring",
  name: "Weather Monitoring",
  version: "1.0.0",
  description: "Watches destination weather and travel alerts.",
  mode: "weather",
  triggers: [{ kind: "schedule", intervalMs: 30 * 60_000 }],
  steps: [
    {
      id: "current",
      name: "Fetch current weather",
      kind: "capability",
      capabilityId: cap("weather"),
      dependsOn: [],
    },
    {
      id: "forecast",
      name: "Fetch hourly forecast",
      kind: "capability",
      capabilityId: cap("forecast_hourly"),
      dependsOn: [],
    },
    {
      id: "alerts",
      name: "Fetch travel alerts",
      kind: "capability",
      capabilityId: cap("travel_alerts"),
      dependsOn: ["current", "forecast"],
    },
    {
      id: "record",
      name: "Record weather change",
      kind: "capability",
      capabilityId: "workflow.record.change",
      dependsOn: ["alerts"],
    },
  ],
});

export const HOTEL_PRICE_MONITORING_WORKFLOW = blueprint({
  id: "multimodal.workflow.hotel-price-monitoring",
  name: "Hotel Price Monitoring",
  version: "1.0.0",
  description: "Tracks hotel availability and nightly pricing changes.",
  mode: "hotel",
  triggers: [{ kind: "schedule", intervalMs: 60 * 60_000 }],
  steps: [
    {
      id: "availability",
      name: "Fetch availability",
      kind: "capability",
      capabilityId: cap("hotel_availability"),
      dependsOn: [],
    },
    {
      id: "pricing",
      name: "Fetch pricing",
      kind: "capability",
      capabilityId: cap("hotel_pricing"),
      dependsOn: ["availability"],
    },
    {
      id: "record",
      name: "Record price delta",
      kind: "capability",
      capabilityId: "workflow.record.change",
      dependsOn: ["pricing"],
    },
  ],
});

export const TRANSIT_MONITORING_WORKFLOW = blueprint({
  id: "multimodal.workflow.transit-monitoring",
  name: "Transit Monitoring",
  version: "1.0.0",
  description: "Monitors local transport options for a leg of the journey.",
  mode: "transit",
  triggers: [{ kind: "schedule", intervalMs: 15 * 60_000 }],
  steps: [
    {
      id: "options",
      name: "Fetch local transport",
      kind: "capability",
      capabilityId: cap("local_transport"),
      dependsOn: [],
    },
    {
      id: "route",
      name: "Estimate route",
      kind: "capability",
      capabilityId: cap("route"),
      dependsOn: ["options"],
    },
    {
      id: "record",
      name: "Record transit change",
      kind: "capability",
      capabilityId: "workflow.record.change",
      dependsOn: ["route"],
    },
  ],
});

export const AIRPORT_DELAY_MONITORING_WORKFLOW = blueprint({
  id: "multimodal.workflow.airport-delay-monitoring",
  name: "Airport Delay Monitoring",
  version: "1.0.0",
  description: "Reacts to a delay signal by re-reading airport and flight state.",
  mode: "flight",
  triggers: [{ kind: "signal", name: "flight.delay" }],
  steps: [
    {
      id: "await",
      name: "Await delay signal",
      kind: "signal",
      signalName: "flight.delay",
      dependsOn: [],
    },
    {
      id: "airport",
      name: "Fetch airport metadata",
      kind: "capability",
      capabilityId: cap("search_airports"),
      dependsOn: ["await"],
    },
    {
      id: "delay",
      name: "Fetch delay information",
      kind: "capability",
      capabilityId: cap("flight_delay_information"),
      dependsOn: ["await"],
    },
    {
      id: "weather",
      name: "Fetch airport weather",
      kind: "capability",
      capabilityId: cap("weather"),
      dependsOn: ["airport"],
    },
    {
      id: "assess",
      name: "Assess delay impact",
      kind: "capability",
      capabilityId: "workflow.assess.delay",
      dependsOn: ["delay", "weather"],
    },
  ],
});

export const TRAVEL_REMINDER_WORKFLOW = blueprint({
  id: "multimodal.workflow.travel-reminder",
  name: "Travel Reminder",
  version: "1.0.0",
  description: "Composes a departure reminder using local time and weather.",
  mode: "timezone",
  triggers: [{ kind: "schedule", delayMs: 60_000 }],
  steps: [
    {
      id: "wait",
      name: "Wait until reminder window",
      kind: "timer",
      delayMs: 60_000,
      dependsOn: [],
    },
    {
      id: "localtime",
      name: "Resolve local time",
      kind: "capability",
      capabilityId: cap("local_time"),
      dependsOn: ["wait"],
    },
    {
      id: "weather",
      name: "Fetch weather",
      kind: "capability",
      capabilityId: cap("weather"),
      dependsOn: ["wait"],
    },
    {
      id: "record",
      name: "Record reminder",
      kind: "capability",
      capabilityId: "workflow.record.reminder",
      dependsOn: ["localtime", "weather"],
    },
  ],
});

export const TRAVEL_REPLANNING_WORKFLOW = blueprint({
  id: "multimodal.workflow.travel-replanning",
  name: "Travel Replanning",
  version: "1.0.0",
  description: "Rebuilds travel options after a disruption signal.",
  mode: "flight",
  triggers: [{ kind: "signal", name: "travel.disruption" }],
  steps: [
    {
      id: "await",
      name: "Await disruption signal",
      kind: "signal",
      signalName: "travel.disruption",
      dependsOn: [],
    },
    {
      id: "flights",
      name: "Search alternative flights",
      kind: "capability",
      capabilityId: cap("search_flights"),
      dependsOn: ["await"],
    },
    {
      id: "hotels",
      name: "Search alternative hotels",
      kind: "capability",
      capabilityId: cap("search_hotels"),
      dependsOn: ["await"],
    },
    {
      id: "transit",
      name: "Search local transport",
      kind: "capability",
      capabilityId: cap("local_transport"),
      dependsOn: ["await"],
    },
    {
      id: "summary",
      name: "Build travel summary",
      kind: "capability",
      capabilityId: cap("travel_summary"),
      dependsOn: ["flights", "hotels", "transit"],
    },
  ],
});

export const MULTIMODAL_WORKFLOW_BLUEPRINTS: readonly MultiModalWorkflowBlueprint[] = Object.freeze(
  [
    FLIGHT_MONITORING_WORKFLOW,
    WEATHER_MONITORING_WORKFLOW,
    HOTEL_PRICE_MONITORING_WORKFLOW,
    TRANSIT_MONITORING_WORKFLOW,
    AIRPORT_DELAY_MONITORING_WORKFLOW,
    TRAVEL_REMINDER_WORKFLOW,
    TRAVEL_REPLANNING_WORKFLOW,
  ],
);

export const MULTIMODAL_WORKFLOW_IDS: readonly string[] = Object.freeze(
  MULTIMODAL_WORKFLOW_BLUEPRINTS.map((b) => b.id),
);

export function multiModalWorkflowBlueprint(id: string): MultiModalWorkflowBlueprint | undefined {
  return MULTIMODAL_WORKFLOW_BLUEPRINTS.find((b) => b.id === id);
}

/** Capability ids referenced by a blueprint (excluding non-multimodal glue steps). */
export function blueprintCapabilityIds(b: MultiModalWorkflowBlueprint): readonly string[] {
  return Object.freeze(
    b.steps
      .map((s) => s.capabilityId)
      .filter((c): c is string => typeof c === "string" && c.startsWith("multimodal.")),
  );
}
