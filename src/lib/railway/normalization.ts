/** RICS — provider payload → normalized model mapping.
 *  Deterministic, total and provider-agnostic: given the documented
 *  provider shape, every capability produces a frozen normalized model.
 */
import type { RailwayCapabilityId } from "./contracts";
import { RailwayNormalizationError } from "./errors";
import { newRailJourneyId } from "./ids";
import type {
  NormalizedAlert, NormalizedCancellation, NormalizedCoachLayout, NormalizedDelay,
  NormalizedDiversion, NormalizedFare, NormalizedJourney, NormalizedJourneyHistory,
  NormalizedLiveStatus, NormalizedPlatform, NormalizedPNR, NormalizedRailwayPayload,
  NormalizedRoute, NormalizedSchedule, NormalizedSeatAvailability, NormalizedStation,
  NormalizedStationMetadata, NormalizedTrain, NormalizedTrainMetadata,
} from "./models";

const freeze = <T>(v: T): T => Object.freeze(v) as T;
const arr = <T>(v: readonly T[]): readonly T[] => Object.freeze([...v]) as readonly T[];

type Rec = Record<string, unknown>;

function obj(v: unknown, field: string): Rec {
  if (!v || typeof v !== "object") throw new RailwayNormalizationError(`${field} must be an object`);
  return v as Rec;
}
function list(v: unknown, field: string): unknown[] {
  if (!Array.isArray(v)) throw new RailwayNormalizationError(`${field} must be an array`);
  return v;
}
const s = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const n = (v: unknown, fallback = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const b = (v: unknown, fallback = false): boolean => (typeof v === "boolean" ? v : fallback);
const sarr = (v: unknown): readonly string[] =>
  Array.isArray(v) ? arr(v.filter((x): x is string => typeof x === "string")) : arr([]);
const opt = (v: unknown): string | undefined => (typeof v === "string" && v.length > 0 ? v : undefined);

export function normalizeStation(raw: unknown): NormalizedStation {
  const r = obj(raw, "station");
  const geo = obj(r.geo ?? {}, "station.geo");
  return freeze({
    code: s(r.stn_code),
    name: s(r.stn_name),
    city: s(r.city_name),
    region: s(r.region_name),
    country: s(r.country_code, "XX"),
    zone: s(r.zone_code),
    coordinates: freeze({ latitude: n(geo.lat), longitude: n(geo.lng) }),
    platforms: n(r.platform_count),
    categories: sarr(r.stn_categories),
  });
}

export function normalizeStationMetadata(raw: unknown): NormalizedStationMetadata {
  const r = obj(raw, "stationMetadata");
  return freeze({
    station: normalizeStation(r.station),
    elevationMeters: n(r.elevation_m),
    amenities: sarr(r.amenities),
    accessibility: sarr(r.accessibility),
    dailyFootfall: n(r.daily_footfall),
    openedYear: n(r.opened_year),
  });
}

export function normalizeTrain(raw: unknown): NormalizedTrain {
  const r = obj(raw, "train");
  const duration = n(r.duration_min);
  const distance = n(r.distance_km);
  return freeze({
    number: s(r.train_no),
    name: s(r.train_name),
    category: s(r.train_type, "express"),
    originCode: s(r.src_code),
    destinationCode: s(r.dstn_code),
    runsOn: sarr(r.running_days),
    classes: sarr(r.class_codes),
    distanceKm: distance,
    durationMinutes: duration,
    averageSpeedKmph: duration > 0 ? Number(((distance / duration) * 60).toFixed(2)) : 0,
  });
}

export function normalizeTrainMetadata(raw: unknown): NormalizedTrainMetadata {
  const r = obj(raw, "trainMetadata");
  return freeze({
    train: normalizeTrain(r.train),
    coaches: n(r.coach_count),
    pantry: b(r.has_pantry),
    rake: s(r.rake_id),
    introducedYear: n(r.introduced_year),
    punctualityPercent: n(r.punctuality_pct),
  });
}

export function normalizeSchedule(raw: unknown): NormalizedSchedule {
  const r = obj(raw, "schedule");
  const stops = list(r.schedule, "schedule.schedule").map((x) => {
    const st = obj(x, "stop");
    return freeze({
      sequence: n(st.seq),
      stationCode: s(st.stn_code),
      stationName: s(st.stn_name),
      arrival: opt(st.arr),
      departure: opt(st.dep),
      haltMinutes: n(st.halt_min),
      dayOffset: n(st.day),
      distanceKm: n(st.distance_km),
      platform: opt(st.pf),
    });
  });
  return freeze({ trainNumber: s(r.train_no), stops: arr(stops) });
}

export function normalizeRoute(raw: unknown): NormalizedRoute {
  const r = obj(raw, "route");
  const legs = list(r.legs, "route.legs").map((x) => {
    const l = obj(x, "leg");
    return freeze({
      fromCode: s(l.from_code),
      toCode: s(l.to_code),
      distanceKm: n(l.distance_km),
      durationMinutes: n(l.duration_min),
    });
  });
  return freeze({
    trainNumber: s(r.train_no),
    legs: arr(legs),
    totalDistanceKm: legs.reduce((a, l) => a + l.distanceKm, 0),
    totalDurationMinutes: legs.reduce((a, l) => a + l.durationMinutes, 0),
  });
}

export function normalizeJourneys(raw: unknown): readonly NormalizedJourney[] {
  const r = obj(raw, "journeys");
  return arr(list(r.journeys, "journeys.journeys").map((x) => {
    const j = obj(x, "journey");
    const segments = list(j.segments, "journey.segments").map((y) => {
      const g = obj(y, "segment");
      return freeze({
        trainNumber: s(g.train_no),
        trainName: s(g.train_name),
        fromCode: s(g.from_code),
        toCode: s(g.to_code),
        departure: s(g.dep),
        arrival: s(g.arr),
        durationMinutes: n(g.duration_min),
        distanceKm: n(g.distance_km),
      });
    });
    return freeze({
      id: opt(j.journey_ref) ?? newRailJourneyId(),
      fromCode: s(j.from_code),
      toCode: s(j.to_code),
      date: s(j.travel_date),
      segments: arr(segments),
      transfers: n(j.transfers, Math.max(0, segments.length - 1)),
      totalDurationMinutes: segments.reduce((a, g) => a + g.durationMinutes, 0),
      totalDistanceKm: segments.reduce((a, g) => a + g.distanceKm, 0),
    });
  }));
}

export function normalizeFare(raw: unknown): NormalizedFare {
  const r = obj(raw, "fare");
  const components = list(r.fare_breakup, "fare.fare_breakup").map((x) => {
    const c = obj(x, "fareComponent");
    return freeze({ label: s(c.head), amountMinor: n(c.paise) });
  });
  return freeze({
    trainNumber: s(r.train_no),
    fromCode: s(r.from_code),
    toCode: s(r.to_code),
    travelClass: s(r.class_code),
    currency: s(r.currency_code, "INR"),
    totalMinor: n(r.total_paise, components.reduce((a, c) => a + c.amountMinor, 0)),
    components: arr(components),
    refundable: b(r.is_refundable),
  });
}

export function normalizeSeatAvailability(raw: unknown): NormalizedSeatAvailability {
  const r = obj(raw, "availability");
  const code = s(r.avl_status, "UNKNOWN");
  const status: NormalizedSeatAvailability["status"] =
    code === "AVL" ? "available" : code === "WL" ? "waitlist" : code === "REGRET" ? "regret" : "unknown";
  return freeze({
    trainNumber: s(r.train_no),
    date: s(r.travel_date),
    travelClass: s(r.class_code),
    quota: s(r.quota_code, "general"),
    status,
    available: n(r.avl_seats),
    waitlist: n(r.wl_count),
    confirmationProbability: Math.max(0, Math.min(100, n(r.confirm_chance_pct))) / 100,
  });
}

export function normalizeCoachLayout(raw: unknown): NormalizedCoachLayout {
  const r = obj(raw, "coachLayout");
  const seats = list(r.seat_map, "coachLayout.seat_map").map((x) => {
    const c = obj(x, "seat");
    return freeze({ number: s(c.seat_no), berth: s(c.berth_code), occupied: b(c.is_occupied) });
  });
  return freeze({
    trainNumber: s(r.train_no),
    coach: s(r.coach_id),
    travelClass: s(r.class_code),
    rows: n(r.row_count),
    seats: arr(seats),
  });
}

export function normalizePlatform(raw: unknown): NormalizedPlatform {
  const r = obj(raw, "platform");
  return freeze({
    stationCode: s(r.stn_code),
    trainNumber: s(r.train_no),
    platform: s(r.pf_no),
    expectedArrival: opt(r.exp_arr),
    expectedDeparture: opt(r.exp_dep),
    changed: b(r.pf_changed),
  });
}

export function normalizePNR(raw: unknown): NormalizedPNR {
  const r = obj(raw, "pnr");
  const passengers = list(r.pax_list, "pnr.pax_list").map((x) => {
    const p = obj(x, "passenger");
    return freeze({
      index: n(p.pax_no),
      bookingStatus: s(p.booking_status),
      currentStatus: s(p.current_status),
      coach: opt(p.coach_id),
      berth: opt(p.berth_no),
    });
  });
  return freeze({
    pnr: s(r.pnr_no),
    trainNumber: s(r.train_no),
    fromCode: s(r.from_code),
    toCode: s(r.to_code),
    date: s(r.travel_date),
    travelClass: s(r.class_code),
    chartPrepared: b(r.chart_prepared),
    passengers: arr(passengers),
  });
}

export function normalizeJourneyHistory(raw: unknown): NormalizedJourneyHistory {
  const r = obj(raw, "journeyHistory");
  const entries = list(r.history, "journeyHistory.history").map((x) => {
    const e = obj(x, "historyEntry");
    const state = s(e.state);
    return freeze({
      reference: s(e.booking_ref),
      trainNumber: s(e.train_no),
      fromCode: s(e.from_code),
      toCode: s(e.to_code),
      date: s(e.travel_date),
      status: (state === "CANX" ? "cancelled" : state === "FUTURE" ? "upcoming" : "completed") as
        NormalizedJourneyHistory["entries"][number]["status"],
    });
  });
  return freeze({ reference: s(r.traveller_ref), entries: arr(entries) });
}

export function normalizeLiveStatus(raw: unknown): NormalizedLiveStatus {
  const r = obj(raw, "liveStatus");
  return freeze({
    trainNumber: s(r.train_no),
    date: s(r.travel_date),
    lastStationCode: s(r.last_stn),
    nextStationCode: s(r.next_stn),
    delayMinutes: n(r.delay_min),
    positionPercent: n(r.progress_pct),
    speedKmph: n(r.speed_kmph),
    updatedAt: n(r.updated_epoch),
  });
}

export function normalizeAlerts(raw: unknown): readonly NormalizedAlert[] {
  const r = obj(raw, "alerts");
  return arr(list(r.alerts, "alerts.alerts").map((x) => {
    const a = obj(x, "alert");
    const sev = s(a.severity_code);
    const scope = s(a.scope_code).toLowerCase();
    return freeze({
      id: s(a.alert_id),
      severity: (sev === "CRIT" ? "critical" : sev === "WARN" ? "warning" : "info") as NormalizedAlert["severity"],
      scope: (scope === "station" || scope === "train" ? scope : "network") as NormalizedAlert["scope"],
      reference: s(a.ref_code),
      title: s(a.headline),
      message: s(a.body),
      issuedAt: n(a.issued_epoch),
    });
  }));
}

export function normalizeDelay(raw: unknown): NormalizedDelay {
  const r = obj(raw, "delay");
  return freeze({
    trainNumber: s(r.train_no),
    stationCode: s(r.stn_code),
    delayMinutes: n(r.delay_min),
    reason: s(r.reason_code, "unknown"),
    measuredAt: n(r.measured_epoch),
  });
}

export function normalizeCancellation(raw: unknown): NormalizedCancellation {
  const r = obj(raw, "cancellation");
  const type = s(r.cancel_type, "NONE");
  return freeze({
    trainNumber: s(r.train_no),
    date: s(r.travel_date),
    fullyCancelled: type === "FULL",
    cancelledFromCode: opt(r.canx_from),
    cancelledToCode: opt(r.canx_to),
    reason: s(r.reason_code, "none"),
  });
}

export function normalizeDiversion(raw: unknown): NormalizedDiversion {
  const r = obj(raw, "diversion");
  return freeze({
    trainNumber: s(r.train_no),
    date: s(r.travel_date),
    divertedViaCodes: sarr(r.via_codes),
    skippedStationCodes: sarr(r.skipped_codes),
    extraDistanceKm: n(r.extra_km),
    reason: s(r.reason_code, "none"),
  });
}

const NORMALIZERS: Readonly<Record<RailwayCapabilityId, (raw: unknown) => NormalizedRailwayPayload>> = Object.freeze({
  search_station: (raw) => arr(list(obj(raw, "stations").stations, "stations.stations").map(normalizeStation)),
  station_information: normalizeStationMetadata,
  search_train: (raw) => arr(list(obj(raw, "trains").trains, "trains.trains").map(normalizeTrain)),
  train_metadata: normalizeTrainMetadata,
  train_schedule: normalizeSchedule,
  route_lookup: normalizeRoute,
  plan_route: normalizeJourneys,
  journey_summary: normalizeJourneys,
  fare_information: normalizeFare,
  seat_availability: normalizeSeatAvailability,
  coach_layout: normalizeCoachLayout,
  platform_information: normalizePlatform,
  check_pnr: normalizePNR,
  journey_history: normalizeJourneyHistory,
  live_status: normalizeLiveStatus,
  service_alerts: normalizeAlerts,
  cancellation_information: normalizeCancellation,
  diversion_information: normalizeDiversion,
  delay_information: normalizeDelay,
});

export function normalizeRailwayPayload(
  capability: RailwayCapabilityId,
  raw: unknown,
): NormalizedRailwayPayload {
  const fn = NORMALIZERS[capability];
  if (!fn) throw new RailwayNormalizationError(`no normalizer for capability: ${capability}`);
  return fn(raw);
}
