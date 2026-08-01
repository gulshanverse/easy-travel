/**
 * Identity Platform — User Travel Statistics (Sprint I-018).
 * Deterministic aggregation over saved journeys only. No estimation, no I/O.
 */
import { deepFreeze } from "./factories";
import type { Favorite, SavedJourney, TransportMode } from "./types";

export interface TravelStatistics {
  readonly userId: string;
  readonly computedAt: number;
  readonly tripsCompleted: number;
  readonly countriesVisited: number;
  readonly statesVisited: number;
  readonly citiesVisited: number;
  readonly railTrips: number;
  readonly flightTrips: number;
  readonly hotelNights: number;
  readonly averageBudgetMinorUnits: number;
  readonly averageDurationDays: number;
  readonly travelScore: number;
  readonly countries: readonly string[];
  readonly states: readonly string[];
  readonly cities: readonly string[];
  readonly favouriteModes: readonly TransportMode[];
}

/** Structured, optional travel facts a saved journey may carry in its payload. */
export interface JourneyTravelFacts {
  readonly country?: string;
  readonly countries?: readonly string[];
  readonly state?: string;
  readonly states?: readonly string[];
  readonly city?: string;
  readonly cities?: readonly string[];
  readonly modes?: readonly TransportMode[];
  readonly hotelNights?: number;
  readonly budgetMinorUnits?: number;
}

function strings(value: unknown): readonly string[] {
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .map((v) => v.trim());
  }
  return [];
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

export function journeyFacts(journey: SavedJourney): JourneyTravelFacts {
  const p = journey.payload as Record<string, unknown>;
  return Object.freeze({
    countries: [...strings(p.country), ...strings(p.countries)],
    states: [...strings(p.state), ...strings(p.states)],
    cities: [...strings(p.city), ...strings(p.cities)],
    modes: strings(p.modes) as readonly TransportMode[],
    hotelNights: num(p.hotelNights),
    budgetMinorUnits: num(p.budgetMinorUnits),
  });
}

/** Whole days between ISO dates, inclusive of the start day. */
export function durationDays(journey: SavedJourney): number {
  if (!journey.startDate || !journey.endDate) return 0;
  const start = Date.parse(`${journey.startDate}T00:00:00Z`);
  const end = Date.parse(`${journey.endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.round((end - start) / 86_400_000) + 1;
}

export interface ComputeStatisticsInput {
  readonly userId: string;
  readonly journeys: readonly SavedJourney[];
  readonly favorites?: readonly Favorite[];
  readonly at: number;
}

export function computeTravelStatistics(input: ComputeStatisticsInput): TravelStatistics {
  const completed = input.journeys.filter((j) => j.status === "completed");
  const countries = new Set<string>();
  const states = new Set<string>();
  const cities = new Set<string>();
  const modeCounts = new Map<TransportMode, number>();
  let hotelNights = 0;
  let budgetSum = 0;
  let budgetCount = 0;
  let durationSum = 0;
  let durationCount = 0;
  let railTrips = 0;
  let flightTrips = 0;

  for (const journey of completed) {
    const facts = journeyFacts(journey);
    for (const c of facts.countries ?? []) countries.add(c);
    for (const s of facts.states ?? []) states.add(s);
    for (const c of facts.cities ?? []) cities.add(c);
    for (const m of facts.modes ?? []) {
      modeCounts.set(m, (modeCounts.get(m) ?? 0) + 1);
      if (m === "train") railTrips++;
      if (m === "flight") flightTrips++;
    }
    hotelNights += facts.hotelNights ?? 0;
    if ((facts.budgetMinorUnits ?? 0) > 0) { budgetSum += facts.budgetMinorUnits ?? 0; budgetCount++; }
    const days = durationDays(journey);
    if (days > 0) { durationSum += days; durationCount++; }
  }

  for (const fav of input.favorites ?? []) {
    if (fav.kind === "mode") modeCounts.set(fav.mode, (modeCounts.get(fav.mode) ?? 0) + 1);
  }

  const averageBudget = budgetCount === 0 ? 0 : Math.round(budgetSum / budgetCount);
  const averageDuration = durationCount === 0
    ? 0
    : Number((durationSum / durationCount).toFixed(2));

  // Deterministic 0..100 composite. Each term saturates independently.
  const score = Math.round(
    Math.min(30, completed.length * 3) +
    Math.min(25, countries.size * 5) +
    Math.min(15, cities.size * 1.5) +
    Math.min(15, (railTrips + flightTrips) * 1.5) +
    Math.min(10, hotelNights * 0.5) +
    Math.min(5, states.size),
  );

  return deepFreeze({
    userId: input.userId,
    computedAt: input.at,
    tripsCompleted: completed.length,
    countriesVisited: countries.size,
    statesVisited: states.size,
    citiesVisited: cities.size,
    railTrips,
    flightTrips,
    hotelNights,
    averageBudgetMinorUnits: averageBudget,
    averageDurationDays: averageDuration,
    travelScore: Math.max(0, Math.min(100, score)),
    countries: Object.freeze([...countries].sort()),
    states: Object.freeze([...states].sort()),
    cities: Object.freeze([...cities].sort()),
    favouriteModes: Object.freeze(
      [...modeCounts.entries()]
        .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
        .map(([mode]) => mode),
    ),
  });
}

export function emptyTravelStatistics(userId: string, at: number): TravelStatistics {
  return computeTravelStatistics({ userId, journeys: [], favorites: [], at });
}
