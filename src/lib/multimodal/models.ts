/** MTIP — immutable normalized travel models.
 *  Every model is frozen at construction; models never reference a provider.
 */

export interface NormalizedTravelCost {
  readonly amount: number;
  readonly currency: string;
  readonly label: string;
  readonly refundable: boolean;
  readonly breakdown: Readonly<Record<string, number>>;
}
export interface NormalizedTravelDuration {
  readonly minutes: number;
  readonly humanized: string;
  readonly mode: string;
  readonly confidence: number;
}
export interface NormalizedLocation {
  readonly id: string;
  readonly name: string;
  readonly lat: number;
  readonly lon: number;
  readonly country: string;
  readonly region: string;
  readonly timezone: string;
}
export interface NormalizedPlace {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly location: NormalizedLocation;
  readonly rating: number;
  readonly tags: readonly string[];
}
export interface NormalizedRegion {
  readonly id: string;
  readonly name: string;
  readonly country: string;
  readonly level: "country" | "state" | "city" | "district";
  readonly parents: readonly string[];
}
export interface NormalizedAirport {
  readonly code: string;
  readonly name: string;
  readonly city: string;
  readonly country: string;
  readonly lat: number;
  readonly lon: number;
  readonly timezone: string;
  readonly terminals: number;
}
export interface NormalizedFlight {
  readonly flightNumber: string;
  readonly carrier: string;
  readonly fromCode: string;
  readonly toCode: string;
  readonly departureMinutes: number;
  readonly arrivalMinutes: number;
  readonly durationMinutes: number;
  readonly stops: number;
  readonly aircraft: string;
  readonly cabins: readonly string[];
  readonly cost: NormalizedTravelCost;
}
export interface NormalizedFlightStatus {
  readonly flightNumber: string;
  readonly state:
    | "scheduled"
    | "boarding"
    | "departed"
    | "en_route"
    | "landed"
    | "delayed"
    | "cancelled";
  readonly delayMinutes: number;
  readonly gate: string;
  readonly terminal: string;
  readonly updatedAt: number;
}
export interface NormalizedFlightScheduleLeg {
  readonly day: string;
  readonly departureMinutes: number;
  readonly arrivalMinutes: number;
}
export interface NormalizedFlightSchedule {
  readonly flightNumber: string;
  readonly fromCode: string;
  readonly toCode: string;
  readonly legs: readonly NormalizedFlightScheduleLeg[];
}
export interface NormalizedFlightMetadata {
  readonly flightNumber: string;
  readonly carrier: string;
  readonly aircraft: string;
  readonly seats: number;
  readonly cabins: readonly string[];
  readonly wifi: boolean;
}
export interface NormalizedFlightDelay {
  readonly flightNumber: string;
  readonly delayMinutes: number;
  readonly cause: string;
  readonly confidence: number;
}
export interface NormalizedRoom {
  readonly id: string;
  readonly hotelId: string;
  readonly name: string;
  readonly capacity: number;
  readonly bedType: string;
  readonly cost: NormalizedTravelCost;
}
export interface NormalizedHotel {
  readonly id: string;
  readonly name: string;
  readonly city: string;
  readonly country: string;
  readonly stars: number;
  readonly rating: number;
  readonly lat: number;
  readonly lon: number;
  readonly amenities: readonly string[];
  readonly nightlyCost: NormalizedTravelCost;
}
export interface NormalizedHotelAvailability {
  readonly hotelId: string;
  readonly available: boolean;
  readonly roomsLeft: number;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly nights: number;
}
export interface NormalizedWeatherMeasure {
  readonly metric: string;
  readonly value: number;
  readonly unit: string;
  readonly at: number;
}
export interface NormalizedWeather {
  readonly place: string;
  readonly condition: string;
  readonly temperatureC: number;
  readonly feelsLikeC: number;
  readonly humidity: number;
  readonly windKph: number;
  readonly windBearing: number;
  readonly visibilityM: number;
  readonly rainProbability: number;
  readonly airQualityIndex: number;
  readonly observedAt: number;
}
export interface NormalizedForecastPoint {
  readonly at: number;
  readonly condition: string;
  readonly temperatureC: number;
  readonly rainProbability: number;
  readonly windKph: number;
}
export interface NormalizedForecast {
  readonly place: string;
  readonly granularity: "hourly" | "daily";
  readonly points: readonly NormalizedForecastPoint[];
}
export interface NormalizedWeatherAlert {
  readonly id: string;
  readonly place: string;
  readonly kind: "storm" | "rain" | "heat" | "wind" | "fog" | "advisory";
  readonly severity: "info" | "minor" | "moderate" | "severe";
  readonly message: string;
  readonly issuedAt: number;
}
export const TRANSIT_MODES = Object.freeze([
  "metro",
  "bus",
  "taxi",
  "auto",
  "walking",
  "cycling",
  "ferry",
  "ride_share",
] as const);
export type TransitModeKind = (typeof TRANSIT_MODES)[number];
export interface NormalizedTransit {
  readonly id: string;
  readonly kind: TransitModeKind;
  readonly from: string;
  readonly to: string;
  readonly duration: NormalizedTravelDuration;
  readonly cost: NormalizedTravelCost;
  readonly distanceKm: number;
  readonly transfers: number;
}
export interface NormalizedMapRouteStep {
  readonly seq: number;
  readonly instruction: string;
  readonly distanceKm: number;
  readonly minutes: number;
}
export interface NormalizedMapRoute {
  readonly id: string;
  readonly from: NormalizedLocation;
  readonly to: NormalizedLocation;
  readonly mode: string;
  readonly distanceKm: number;
  readonly duration: NormalizedTravelDuration;
  readonly steps: readonly NormalizedMapRouteStep[];
}
export interface NormalizedDistanceMatrixCell {
  readonly origin: string;
  readonly destination: string;
  readonly distanceKm: number;
  readonly minutes: number;
}
export interface NormalizedDistanceMatrix {
  readonly cells: readonly NormalizedDistanceMatrixCell[];
}
export interface NormalizedCurrency {
  readonly code: string;
  readonly name: string;
  readonly symbol: string;
  readonly decimals: number;
}
export interface NormalizedExchangeRate {
  readonly from: string;
  readonly to: string;
  readonly rate: number;
  readonly asOf: number;
}
export interface NormalizedCurrencyConversion {
  readonly from: string;
  readonly to: string;
  readonly amount: number;
  readonly converted: number;
  readonly rate: NormalizedExchangeRate;
}
export interface NormalizedTravelBudgetCurrency {
  readonly homeCurrency: string;
  readonly destinationCurrency: string;
  readonly homeAmount: number;
  readonly destinationAmount: number;
  readonly rate: number;
}
export interface NormalizedTimezone {
  readonly id: string;
  readonly place: string;
  readonly offsetMinutes: number;
  readonly abbreviation: string;
  readonly dst: boolean;
}
export interface NormalizedLocalTime {
  readonly place: string;
  readonly timezone: NormalizedTimezone;
  readonly instant: number;
  readonly localIso: string;
}
export interface NormalizedTravelSegment {
  readonly id: string;
  readonly mode: string;
  readonly from: string;
  readonly to: string;
  readonly startAt: number;
  readonly endAt: number;
  readonly duration: NormalizedTravelDuration;
  readonly cost: NormalizedTravelCost;
  readonly reference: string;
}

/** Deep-freeze helper used by every factory below. */
export function freezeModel<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  for (const v of Object.values(value as Record<string, unknown>)) freezeModel(v);
  return Object.freeze(value);
}

export function makeTravelCost(
  input: Partial<NormalizedTravelCost> & { amount: number; currency: string },
): NormalizedTravelCost {
  return freezeModel({
    amount: Math.round(input.amount * 100) / 100,
    currency: input.currency,
    label: input.label ?? "total",
    refundable: input.refundable ?? false,
    breakdown: { ...(input.breakdown ?? {}) },
  });
}

export function makeTravelDuration(
  minutes: number,
  mode = "unknown",
  confidence = 0.9,
): NormalizedTravelDuration {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  return freezeModel({
    minutes: m,
    humanized: h > 0 ? `${h}h ${m % 60}m` : `${m}m`,
    mode,
    confidence,
  });
}

export function makeTravelSegment(
  input: Omit<NormalizedTravelSegment, "duration"> & { duration?: NormalizedTravelDuration },
): NormalizedTravelSegment {
  return freezeModel({
    ...input,
    duration:
      input.duration ?? makeTravelDuration((input.endAt - input.startAt) / 60_000, input.mode),
  });
}
