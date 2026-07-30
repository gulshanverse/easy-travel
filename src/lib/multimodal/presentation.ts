/** MTIP — Journey Studio presentation models (immutable, UI-independent).
 *  No React, no rendering, no DOM. Pure data derived from normalized models.
 */
import { newTravelCardId } from "./ids";
import { freezeModel } from "./models";
import type {
  NormalizedAirport,
  NormalizedCurrencyConversion,
  NormalizedExchangeRate,
  NormalizedFlight,
  NormalizedFlightStatus,
  NormalizedHotel,
  NormalizedMapRoute,
  NormalizedTransit,
  NormalizedTravelCost,
  NormalizedTravelSegment,
  NormalizedWeather,
} from "./models";

export const TRAVEL_CARD_KINDS = Object.freeze([
  "flight",
  "airport",
  "hotel",
  "weather",
  "transit",
  "currency",
  "travel-summary",
  "travel-cost",
  "travel-timeline",
  "travel-segment",
] as const);
export type TravelCardKind = (typeof TRAVEL_CARD_KINDS)[number];

export interface TravelCardBase {
  readonly id: string;
  readonly kind: TravelCardKind;
  readonly title: string;
  readonly subtitle?: string;
  readonly body?: string;
  readonly tags: readonly string[];
  readonly createdAt: number;
  readonly data: Readonly<Record<string, unknown>>;
}

export interface FlightCard extends TravelCardBase {
  readonly kind: "flight";
}
export interface AirportCard extends TravelCardBase {
  readonly kind: "airport";
}
export interface HotelCard extends TravelCardBase {
  readonly kind: "hotel";
}
export interface WeatherCard extends TravelCardBase {
  readonly kind: "weather";
}
export interface TransitCard extends TravelCardBase {
  readonly kind: "transit";
}
export interface CurrencyCard extends TravelCardBase {
  readonly kind: "currency";
}
export interface TravelSummaryCard extends TravelCardBase {
  readonly kind: "travel-summary";
}
export interface TravelCostCard extends TravelCardBase {
  readonly kind: "travel-cost";
}
export interface TravelSegmentCard extends TravelCardBase {
  readonly kind: "travel-segment";
}

export interface TravelTimelineItem {
  readonly id: string;
  readonly label: string;
  readonly mode: string;
  readonly startAt: number;
  readonly endAt: number;
  readonly cardId?: string;
  readonly order: number;
}
export interface TravelTimelineCard extends TravelCardBase {
  readonly kind: "travel-timeline";
  readonly items: readonly TravelTimelineItem[];
}

export type TravelCard =
  | FlightCard
  | AirportCard
  | HotelCard
  | WeatherCard
  | TransitCard
  | CurrencyCard
  | TravelSummaryCard
  | TravelCostCard
  | TravelSegmentCard
  | TravelTimelineCard;

function card<K extends TravelCardKind>(
  kind: K,
  input: {
    title: string;
    subtitle?: string;
    body?: string;
    tags?: readonly string[];
    data?: Readonly<Record<string, unknown>>;
    id?: string;
    createdAt?: number;
  },
): TravelCardBase & { kind: K } {
  return freezeModel({
    id: input.id ?? newTravelCardId(),
    kind,
    title: input.title,
    subtitle: input.subtitle,
    body: input.body,
    tags: [...(input.tags ?? []), "multimodal", kind],
    createdAt: input.createdAt ?? Date.now(),
    data: { ...(input.data ?? {}) },
  }) as TravelCardBase & { kind: K };
}

const money = (c: NormalizedTravelCost) => `${c.currency} ${c.amount}`;
const hhmm = (m: number) =>
  `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export function makeFlightCard(
  flight: NormalizedFlight,
  status?: NormalizedFlightStatus,
): FlightCard {
  return card("flight", {
    title: `${flight.carrier} ${flight.flightNumber}`,
    subtitle: `${flight.fromCode} → ${flight.toCode}`,
    body: `${hhmm(flight.departureMinutes)} – ${hhmm(flight.arrivalMinutes)} · ${flight.durationMinutes} min · ${flight.stops} stop(s) · ${money(flight.cost)}`,
    tags: ["flight", flight.carrier],
    data: { flight, status },
  }) as FlightCard;
}

export function makeAirportCard(airport: NormalizedAirport): AirportCard {
  return card("airport", {
    title: `${airport.code} · ${airport.name}`,
    subtitle: `${airport.city}, ${airport.country}`,
    body: `${airport.terminals} terminal(s) · ${airport.timezone}`,
    tags: ["airport", airport.code],
    data: { airport },
  }) as AirportCard;
}

export function makeHotelCard(hotel: NormalizedHotel): HotelCard {
  return card("hotel", {
    title: hotel.name,
    subtitle: `${hotel.city}, ${hotel.country}`,
    body: `${hotel.stars}★ · rating ${hotel.rating} · ${money(hotel.nightlyCost)} / night`,
    tags: ["hotel", hotel.city],
    data: { hotel },
  }) as HotelCard;
}

export function makeWeatherCard(weather: NormalizedWeather): WeatherCard {
  return card("weather", {
    title: `Weather · ${weather.place}`,
    subtitle: weather.condition,
    body: `${weather.temperatureC}°C (feels ${weather.feelsLikeC}°C) · wind ${weather.windKph} kph · rain ${Math.round(weather.rainProbability * 100)}% · AQI ${weather.airQualityIndex}`,
    tags: ["weather", weather.condition],
    data: { weather },
  }) as WeatherCard;
}

export function makeTransitCard(transit: NormalizedTransit): TransitCard {
  return card("transit", {
    title: `${transit.kind.replace("_", " ")} · ${transit.from} → ${transit.to}`,
    subtitle: `${transit.duration.minutes} min · ${transit.distanceKm} km`,
    body: `${transit.transfers} transfer(s) · ${money(transit.cost)}`,
    tags: ["transit", transit.kind],
    data: { transit },
  }) as TransitCard;
}

export function makeCurrencyCard(
  rate: NormalizedExchangeRate,
  conversion?: NormalizedCurrencyConversion,
): CurrencyCard {
  return card("currency", {
    title: `${rate.from} → ${rate.to}`,
    subtitle: `1 ${rate.from} = ${rate.rate} ${rate.to}`,
    body: conversion
      ? `${conversion.amount} ${conversion.from} = ${conversion.converted} ${conversion.to}`
      : undefined,
    tags: ["currency", rate.from, rate.to],
    data: { rate, conversion },
  }) as CurrencyCard;
}

export interface TravelSummaryInputModels {
  readonly place: string;
  readonly weather?: NormalizedWeather;
  readonly flights?: readonly NormalizedFlight[];
  readonly hotels?: readonly NormalizedHotel[];
  readonly route?: NormalizedMapRoute;
}

export function makeTravelSummaryCard(input: TravelSummaryInputModels): TravelSummaryCard {
  const parts: string[] = [];
  if (input.flights?.length) parts.push(`${input.flights.length} flight option(s)`);
  if (input.hotels?.length) parts.push(`${input.hotels.length} hotel option(s)`);
  if (input.weather) parts.push(`${input.weather.condition}, ${input.weather.temperatureC}°C`);
  if (input.route) parts.push(`${input.route.distanceKm} km route`);
  return card("travel-summary", {
    title: `Travel summary · ${input.place}`,
    subtitle: parts.join(" · ") || "No options resolved",
    tags: ["summary", input.place],
    data: {
      place: input.place,
      weather: input.weather,
      flights: input.flights ?? [],
      hotels: input.hotels ?? [],
      route: input.route,
    },
  }) as TravelSummaryCard;
}

export interface TravelCostLine {
  readonly label: string;
  readonly cost: NormalizedTravelCost;
}

export function makeTravelCostCard(
  lines: readonly TravelCostLine[],
  currency?: string,
): TravelCostCard {
  const cur = currency ?? lines[0]?.cost.currency ?? "USD";
  const total = lines
    .filter((l) => l.cost.currency === cur)
    .reduce((sum, l) => sum + l.cost.amount, 0);
  return card("travel-cost", {
    title: "Cost breakdown",
    subtitle: `${cur} ${Math.round(total * 100) / 100} total`,
    body: lines.map((l) => `${l.label}: ${money(l.cost)}`).join(" · "),
    tags: ["cost", cur],
    data: { currency: cur, total: Math.round(total * 100) / 100, lines },
  }) as TravelCostCard;
}

export function makeTravelSegmentCard(segment: NormalizedTravelSegment): TravelSegmentCard {
  return card("travel-segment", {
    title: `${segment.mode} · ${segment.from} → ${segment.to}`,
    subtitle: `${segment.duration.minutes} min`,
    body: `${money(segment.cost)} · ref ${segment.reference}`,
    tags: ["segment", segment.mode],
    data: { segment },
  }) as TravelSegmentCard;
}

export function makeTravelTimelineCard(
  segments: readonly NormalizedTravelSegment[],
  label = "Journey timeline",
): TravelTimelineCard {
  const ordered = [...segments].sort((a, b) => a.startAt - b.startAt || a.id.localeCompare(b.id));
  const items: TravelTimelineItem[] = ordered.map((s, i) => ({
    id: `tli_${s.id}`,
    label: `${s.mode}: ${s.from} → ${s.to}`,
    mode: s.mode,
    startAt: s.startAt,
    endAt: s.endAt,
    order: i,
  }));
  const base = card("travel-timeline", {
    title: label,
    subtitle: `${items.length} segment(s)`,
    tags: ["timeline"],
    data: { segments: ordered },
  });
  return freezeModel({ ...base, items }) as TravelTimelineCard;
}

/** Build the full set of presentation cards for a resolved travel context. */
export interface TravelPresentationInput {
  readonly place?: string;
  readonly flights?: readonly NormalizedFlight[];
  readonly airports?: readonly NormalizedAirport[];
  readonly hotels?: readonly NormalizedHotel[];
  readonly weather?: NormalizedWeather;
  readonly transit?: readonly NormalizedTransit[];
  readonly rate?: NormalizedExchangeRate;
  readonly conversion?: NormalizedCurrencyConversion;
  readonly segments?: readonly NormalizedTravelSegment[];
  readonly route?: NormalizedMapRoute;
}

export function buildTravelPresentation(input: TravelPresentationInput): readonly TravelCard[] {
  const cards: TravelCard[] = [];
  for (const f of input.flights ?? []) cards.push(makeFlightCard(f));
  for (const a of input.airports ?? []) cards.push(makeAirportCard(a));
  for (const h of input.hotels ?? []) cards.push(makeHotelCard(h));
  if (input.weather) cards.push(makeWeatherCard(input.weather));
  for (const t of input.transit ?? []) cards.push(makeTransitCard(t));
  if (input.rate) cards.push(makeCurrencyCard(input.rate, input.conversion));
  for (const s of input.segments ?? []) cards.push(makeTravelSegmentCard(s));
  if (input.segments?.length) cards.push(makeTravelTimelineCard(input.segments));
  const costLines: TravelCostLine[] = [
    ...(input.flights ?? []).map((f) => ({ label: `Flight ${f.flightNumber}`, cost: f.cost })),
    ...(input.hotels ?? []).map((h) => ({ label: `Hotel ${h.name}`, cost: h.nightlyCost })),
    ...(input.transit ?? []).map((t) => ({ label: `Transit ${t.kind}`, cost: t.cost })),
  ];
  if (costLines.length) cards.push(makeTravelCostCard(costLines));
  cards.push(
    makeTravelSummaryCard({
      place: input.place ?? input.weather?.place ?? "destination",
      weather: input.weather,
      flights: input.flights,
      hotels: input.hotels,
      route: input.route,
    }),
  );
  return Object.freeze(cards);
}
