/** RICS — provider-independent railway capability contracts.
 *  A contract describes WHAT a railway capability accepts and returns.
 *  It never names a provider and never encodes transport details.
 */

export const RAILWAY_CAPABILITY_IDS = Object.freeze([
  "search_station",
  "station_information",
  "search_train",
  "train_metadata",
  "train_schedule",
  "route_lookup",
  "plan_route",
  "journey_summary",
  "fare_information",
  "seat_availability",
  "coach_layout",
  "platform_information",
  "check_pnr",
  "journey_history",
  "live_status",
  "service_alerts",
  "cancellation_information",
  "diversion_information",
  "delay_information",
] as const);

export type RailwayCapabilityId = (typeof RAILWAY_CAPABILITY_IDS)[number];

export interface RailwayCapabilityContract {
  readonly id: RailwayCapabilityId;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly inputs: readonly string[];
  readonly required: readonly string[];
  readonly output: string;
  readonly cacheable: boolean;
  readonly volatility: "static" | "slow" | "live";
}

const c = (x: RailwayCapabilityContract): RailwayCapabilityContract => Object.freeze({
  ...x,
  inputs: Object.freeze([...x.inputs]),
  required: Object.freeze([...x.required]),
});

export const RAILWAY_CONTRACTS: Readonly<Record<RailwayCapabilityId, RailwayCapabilityContract>> = Object.freeze({
  search_station: c({
    id: "search_station", name: "Station Search", version: "1.0.0",
    description: "Find stations by free-text query, code or city.",
    inputs: ["query", "limit"], required: ["query"],
    output: "NormalizedStation[]", cacheable: true, volatility: "static",
  }),
  station_information: c({
    id: "station_information", name: "Station Metadata", version: "1.0.0",
    description: "Full metadata for a single station.",
    inputs: ["stationCode"], required: ["stationCode"],
    output: "NormalizedStationMetadata", cacheable: true, volatility: "static",
  }),
  search_train: c({
    id: "search_train", name: "Train Search", version: "1.0.0",
    description: "Find trains serving an origin/destination pair or matching a query.",
    inputs: ["fromCode", "toCode", "query", "limit"], required: [],
    output: "NormalizedTrain[]", cacheable: true, volatility: "slow",
  }),
  train_metadata: c({
    id: "train_metadata", name: "Train Metadata", version: "1.0.0",
    description: "Composition and profile of a single train.",
    inputs: ["trainNumber"], required: ["trainNumber"],
    output: "NormalizedTrainMetadata", cacheable: true, volatility: "slow",
  }),
  train_schedule: c({
    id: "train_schedule", name: "Train Schedule", version: "1.0.0",
    description: "Ordered timetable of stops for a train.",
    inputs: ["trainNumber"], required: ["trainNumber"],
    output: "NormalizedSchedule", cacheable: true, volatility: "slow",
  }),
  route_lookup: c({
    id: "route_lookup", name: "Route Lookup", version: "1.0.0",
    description: "Leg-by-leg route of a train with distances and durations.",
    inputs: ["trainNumber"], required: ["trainNumber"],
    output: "NormalizedRoute", cacheable: true, volatility: "slow",
  }),
  plan_route: c({
    id: "plan_route", name: "Journey Planning", version: "1.0.0",
    description: "Plan journeys between two stations, direct or with transfers.",
    inputs: ["fromCode", "toCode", "date", "maxTransfers", "limit"], required: ["fromCode", "toCode"],
    output: "NormalizedJourney[]", cacheable: false, volatility: "slow",
  }),
  journey_summary: c({
    id: "journey_summary", name: "Journey Summary", version: "1.0.0",
    description: "Best single journey option between two stations.",
    inputs: ["fromCode", "toCode", "date"], required: ["fromCode", "toCode"],
    output: "NormalizedJourney[]", cacheable: false, volatility: "slow",
  }),
  fare_information: c({
    id: "fare_information", name: "Fare Information", version: "1.0.0",
    description: "Fare breakdown for a train, class and station pair.",
    inputs: ["trainNumber", "fromCode", "toCode", "travelClass"], required: ["trainNumber"],
    output: "NormalizedFare", cacheable: true, volatility: "slow",
  }),
  seat_availability: c({
    id: "seat_availability", name: "Seat Availability", version: "1.0.0",
    description: "Availability, waitlist and confirmation probability.",
    inputs: ["trainNumber", "date", "travelClass", "quota"], required: ["trainNumber"],
    output: "NormalizedSeatAvailability", cacheable: false, volatility: "live",
  }),
  coach_layout: c({
    id: "coach_layout", name: "Coach Layout", version: "1.0.0",
    description: "Seat map for a coach of a train.",
    inputs: ["trainNumber", "coach"], required: ["trainNumber"],
    output: "NormalizedCoachLayout", cacheable: true, volatility: "slow",
  }),
  platform_information: c({
    id: "platform_information", name: "Platform Information", version: "1.0.0",
    description: "Expected platform for a train at a station.",
    inputs: ["stationCode", "trainNumber"], required: ["stationCode", "trainNumber"],
    output: "NormalizedPlatform", cacheable: false, volatility: "live",
  }),
  check_pnr: c({
    id: "check_pnr", name: "PNR Status", version: "1.0.0",
    description: "Booking status for a passenger name record.",
    inputs: ["pnr"], required: ["pnr"],
    output: "NormalizedPNR", cacheable: false, volatility: "live",
  }),
  journey_history: c({
    id: "journey_history", name: "Journey History", version: "1.0.0",
    description: "Past and upcoming journeys for an opaque traveller reference.",
    inputs: ["reference", "limit"], required: ["reference"],
    output: "NormalizedJourneyHistory", cacheable: false, volatility: "slow",
  }),
  live_status: c({
    id: "live_status", name: "Live Running Status", version: "1.0.0",
    description: "Current running position and delay of a train.",
    inputs: ["trainNumber", "date"], required: ["trainNumber"],
    output: "NormalizedLiveStatus", cacheable: false, volatility: "live",
  }),
  service_alerts: c({
    id: "service_alerts", name: "Service Alerts", version: "1.0.0",
    description: "Network, station or train scoped service alerts.",
    inputs: ["scope", "reference", "limit"], required: [],
    output: "NormalizedAlert[]", cacheable: false, volatility: "live",
  }),
  cancellation_information: c({
    id: "cancellation_information", name: "Cancellation Information", version: "1.0.0",
    description: "Full or partial cancellation of a train service.",
    inputs: ["trainNumber", "date"], required: ["trainNumber"],
    output: "NormalizedCancellation", cacheable: false, volatility: "live",
  }),
  diversion_information: c({
    id: "diversion_information", name: "Diversion Information", version: "1.0.0",
    description: "Route diversions and skipped stations for a service.",
    inputs: ["trainNumber", "date"], required: ["trainNumber"],
    output: "NormalizedDiversion", cacheable: false, volatility: "live",
  }),
  delay_information: c({
    id: "delay_information", name: "Delay Information", version: "1.0.0",
    description: "Delay in minutes with a coded reason.",
    inputs: ["trainNumber", "stationCode"], required: ["trainNumber"],
    output: "NormalizedDelay", cacheable: false, volatility: "live",
  }),
});

export const RAILWAY_CONTRACT_LIST: readonly RailwayCapabilityContract[] =
  Object.freeze(RAILWAY_CAPABILITY_IDS.map((id) => RAILWAY_CONTRACTS[id]));

export function isRailwayCapability(x: string): x is RailwayCapabilityId {
  return (RAILWAY_CAPABILITY_IDS as readonly string[]).includes(x);
}

export function requireContract(id: string): RailwayCapabilityContract {
  if (!isRailwayCapability(id)) {
    throw new Error(`unknown railway capability: ${id}`);
  }
  return RAILWAY_CONTRACTS[id];
}
