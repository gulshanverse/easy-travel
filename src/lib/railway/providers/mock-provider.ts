/** RICS — MockRailProvider: the only functional adapter in this sprint.
 *  Fully deterministic, zero network, provider-shaped payloads so that
 *  normalization is exercised exactly as it would be for a real provider.
 */
import type { RailwayCapabilityId } from "../contracts";
import { RAILWAY_CAPABILITY_IDS } from "../contracts";
import {
  dayOffset, minutesToClock, mockDataset, stableHash,
  MOCK_CLASSES, MOCK_DELAY_REASONS, MOCK_STATION_COUNT, MOCK_TRAIN_COUNT,
  type MockStation, type MockTrain,
} from "./mock-data";
import type {
  RailwayProviderAdapter, RailwayProviderProfile, RailwayProviderRawResult, RailwayRequestInput,
} from "./types";

const str = (v: unknown): string | undefined => (typeof v === "string" && v.length > 0 ? v : undefined);
const num = (v: unknown, d: number): number => (typeof v === "number" && Number.isFinite(v) ? v : d);

const fail = (code: string, message: string, retryable = false): RailwayProviderRawResult =>
  Object.freeze({ ok: false, error: Object.freeze({ code, message, retryable }) });
const okay = (data: unknown, pagination?: { total?: number; hasMore?: boolean }): RailwayProviderRawResult =>
  Object.freeze({ ok: true, data, pagination });

function stationPayload(s: MockStation) {
  return {
    stn_code: s.code, stn_name: s.name, city_name: s.city,
    region_name: s.region, zone_code: s.zone, country_code: "IN",
    geo: { lat: s.lat, lng: s.lon },
    platform_count: s.platforms, stn_categories: s.categories,
  };
}

function trainPayload(t: MockTrain) {
  const first = t.stops[0];
  const last = t.stops[t.stops.length - 1];
  const duration = (last.arrivalMinutes ?? 0) - (first.departureMinutes ?? 0);
  return {
    train_no: t.number, train_name: t.name, train_type: t.category,
    src_code: first.stationCode, dstn_code: last.stationCode,
    running_days: t.runsOn, class_codes: t.classes,
    distance_km: last.distanceKm,
    duration_min: duration,
  };
}

export interface MockRailProviderOptions {
  /** Force a failure for this capability (used by error-handling tests). */
  readonly failCapabilities?: readonly RailwayCapabilityId[];
  /** Number of leading attempts that fail transiently (retry tests). */
  readonly transientFailures?: number;
}

export class MockRailProvider implements RailwayProviderAdapter {
  readonly profile: RailwayProviderProfile = Object.freeze({
    id: "mock-rail",
    name: "Mock Rail Provider",
    kind: "mock" as const,
    country: "XX",
    version: "1.0.0",
    functional: true,
    capabilities: RAILWAY_CAPABILITY_IDS,
  });

  private remainingTransient: number;
  private readonly failSet: ReadonlySet<string>;
  private attempts = 0;

  constructor(private readonly options: MockRailProviderOptions = {}) {
    this.remainingTransient = options.transientFailures ?? 0;
    this.failSet = new Set(options.failCapabilities ?? []);
  }

  get attemptCount(): number { return this.attempts; }

  supports(capability: RailwayCapabilityId): boolean {
    return (this.profile.capabilities as readonly string[]).includes(capability);
  }

  async probe(): Promise<{ healthy: boolean; reason?: string }> {
    const d = mockDataset();
    const healthy = d.stations.length >= MOCK_STATION_COUNT && d.trains.length >= MOCK_TRAIN_COUNT;
    return { healthy, reason: healthy ? undefined : "mock dataset incomplete" };
  }

  async execute(capability: RailwayCapabilityId, input: RailwayRequestInput): Promise<RailwayProviderRawResult> {
    this.attempts += 1;
    if (this.remainingTransient > 0) {
      this.remainingTransient -= 1;
      return fail("provider_transient", "temporary provider failure", true);
    }
    if (this.failSet.has(capability)) {
      return fail("provider_error", `provider rejected ${capability}`, false);
    }
    if (!this.supports(capability)) {
      return fail("capability_unsupported", `mock provider cannot serve ${capability}`);
    }
    return this.dispatch(capability, input);
  }

  private dispatch(capability: RailwayCapabilityId, input: RailwayRequestInput): RailwayProviderRawResult {
    const d = mockDataset();
    switch (capability) {
      case "search_station": {
        const q = (str(input.query) ?? "").toLowerCase();
        const limit = Math.max(1, Math.min(50, num(input.limit, 10)));
        const hits = d.stations
          .filter((s) => s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q) || s.city.toLowerCase().includes(q))
          .slice(0, limit)
          .map(stationPayload);
        return okay({ stations: hits }, { total: hits.length, hasMore: false });
      }
      case "station_information": {
        const s = d.stationByCode.get(str(input.stationCode) ?? "");
        if (!s) return fail("station_not_found", `unknown station: ${String(input.stationCode)}`);
        return okay({
          station: stationPayload(s),
          elevation_m: s.elevation,
          amenities: s.amenities,
          accessibility: s.accessibility,
          daily_footfall: s.footfall,
          opened_year: s.openedYear,
        });
      }
      case "search_train": {
        const from = str(input.fromCode);
        const to = str(input.toCode);
        const q = (str(input.query) ?? "").toLowerCase();
        const limit = Math.max(1, Math.min(50, num(input.limit, 10)));
        const hits = d.trains.filter((t) => {
          if (q && !t.name.toLowerCase().includes(q) && !t.number.includes(q)) return false;
          if (!from && !to) return true;
          const fi = from ? t.stops.findIndex((s) => s.stationCode === from) : 0;
          const ti = to ? t.stops.findIndex((s) => s.stationCode === to) : t.stops.length - 1;
          return fi >= 0 && ti >= 0 && fi < ti;
        }).slice(0, limit).map(trainPayload);
        return okay({ trains: hits }, { total: hits.length, hasMore: false });
      }
      case "train_metadata": {
        const t = d.trainByNumber.get(str(input.trainNumber) ?? "");
        if (!t) return fail("train_not_found", `unknown train: ${String(input.trainNumber)}`);
        return okay({
          train: trainPayload(t),
          coach_count: t.coaches, has_pantry: t.pantry, rake_id: t.rake,
          introduced_year: t.introducedYear, punctuality_pct: t.punctuality,
        });
      }
      case "train_schedule": {
        const t = d.trainByNumber.get(str(input.trainNumber) ?? "");
        if (!t) return fail("train_not_found", `unknown train: ${String(input.trainNumber)}`);
        return okay({
          train_no: t.number,
          schedule: t.stops.map((s) => ({
            seq: s.seq,
            stn_code: s.stationCode,
            stn_name: d.stationByCode.get(s.stationCode)?.name ?? s.stationCode,
            arr: minutesToClock(s.arrivalMinutes) ?? null,
            dep: minutesToClock(s.departureMinutes) ?? null,
            halt_min: s.haltMinutes,
            day: dayOffset(s.arrivalMinutes ?? s.departureMinutes),
            distance_km: s.distanceKm,
            pf: s.platform,
          })),
        });
      }
      case "route_lookup": {
        const t = d.trainByNumber.get(str(input.trainNumber) ?? "");
        if (!t) return fail("train_not_found", `unknown train: ${String(input.trainNumber)}`);
        const legs = t.stops.slice(1).map((s, i) => {
          const prev = t.stops[i];
          return {
            from_code: prev.stationCode,
            to_code: s.stationCode,
            distance_km: s.distanceKm - prev.distanceKm,
            duration_min: (s.arrivalMinutes ?? 0) - (prev.departureMinutes ?? prev.arrivalMinutes ?? 0),
          };
        });
        return okay({ train_no: t.number, legs });
      }
      case "plan_route":
      case "journey_summary": {
        const from = str(input.fromCode);
        const to = str(input.toCode);
        if (!from || !to) return fail("invalid_input", "fromCode and toCode are required");
        const date = str(input.date) ?? "2026-01-01";
        const limit = capability === "journey_summary" ? 1 : Math.max(1, Math.min(20, num(input.limit, 5)));
        const journeys: unknown[] = [];
        for (const t of d.trains) {
          const fi = t.stops.findIndex((s) => s.stationCode === from);
          const ti = t.stops.findIndex((s) => s.stationCode === to);
          if (fi < 0 || ti < 0 || fi >= ti) continue;
          const a = t.stops[fi];
          const b = t.stops[ti];
          journeys.push({
            journey_ref: `${t.number}-${from}-${to}`,
            from_code: from, to_code: to, travel_date: date,
            transfers: 0,
            segments: [{
              train_no: t.number, train_name: t.name,
              from_code: from, to_code: to,
              dep: minutesToClock(a.departureMinutes ?? a.arrivalMinutes) ?? "00:00",
              arr: minutesToClock(b.arrivalMinutes ?? b.departureMinutes) ?? "00:00",
              duration_min: (b.arrivalMinutes ?? 0) - (a.departureMinutes ?? 0),
              distance_km: b.distanceKm - a.distanceKm,
            }],
          });
          if (journeys.length >= limit) break;
        }
        return okay({ journeys }, { total: journeys.length, hasMore: false });
      }
      case "fare_information": {
        const t = d.trainByNumber.get(str(input.trainNumber) ?? "");
        if (!t) return fail("train_not_found", `unknown train: ${String(input.trainNumber)}`);
        const from = str(input.fromCode) ?? t.stops[0].stationCode;
        const to = str(input.toCode) ?? t.stops[t.stops.length - 1].stationCode;
        const cls = str(input.travelClass) ?? t.classes[0];
        const fi = Math.max(0, t.stops.findIndex((s) => s.stationCode === from));
        const ti = t.stops.findIndex((s) => s.stationCode === to);
        const km = Math.max(1, (ti < 0 ? t.stops[t.stops.length - 1] : t.stops[ti]).distanceKm - t.stops[fi].distanceKm);
        const classIdx = Math.max(0, MOCK_CLASSES.indexOf(cls));
        const base = Math.round(km * (35 + classIdx * 28));
        const reservation = 2000 + classIdx * 1500;
        const superfast = t.category === "superfast" || t.category === "high-speed" ? 4500 : 0;
        const gst = Math.round((base + reservation + superfast) * 0.05);
        return okay({
          train_no: t.number, from_code: from, to_code: to, class_code: cls,
          currency_code: "INR",
          fare_breakup: [
            { head: "base", paise: base },
            { head: "reservation", paise: reservation },
            { head: "superfast", paise: superfast },
            { head: "tax", paise: gst },
          ],
          total_paise: base + reservation + superfast + gst,
          is_refundable: classIdx > 0,
        });
      }
      case "seat_availability": {
        const t = d.trainByNumber.get(str(input.trainNumber) ?? "");
        if (!t) return fail("train_not_found", `unknown train: ${String(input.trainNumber)}`);
        const date = str(input.date) ?? "2026-01-01";
        const cls = str(input.travelClass) ?? t.classes[0];
        const quota = str(input.quota) ?? "general";
        const h = stableHash(t.number, date, cls, quota);
        const seats = h % 90;
        const waitlist = seats > 0 ? 0 : (h >> 8) % 120;
        const status = seats > 0 ? "AVL" : waitlist > 90 ? "REGRET" : "WL";
        return okay({
          train_no: t.number, travel_date: date, class_code: cls, quota_code: quota,
          avl_status: status, avl_seats: seats, wl_count: waitlist,
          confirm_chance_pct: seats > 0 ? 100 : Math.max(0, 95 - waitlist),
        });
      }
      case "coach_layout": {
        const t = d.trainByNumber.get(str(input.trainNumber) ?? "");
        if (!t) return fail("train_not_found", `unknown train: ${String(input.trainNumber)}`);
        const coach = str(input.coach) ?? "B1";
        const cls = str(input.travelClass) ?? t.classes[0];
        const rows = 8;
        const berths = ["LB", "MB", "UB", "SL", "SU", "WS", "AS"];
        const seats: unknown[] = [];
        for (let r = 0; r < rows; r += 1) {
          for (let s = 0; s < 8; s += 1) {
            const n = r * 8 + s + 1;
            seats.push({
              seat_no: String(n),
              berth_code: berths[(n + coach.length) % berths.length],
              is_occupied: stableHash(t.number, coach, n) % 3 === 0,
            });
          }
        }
        return okay({ train_no: t.number, coach_id: coach, class_code: cls, row_count: rows, seat_map: seats });
      }
      case "platform_information": {
        const t = d.trainByNumber.get(str(input.trainNumber) ?? "");
        const code = str(input.stationCode) ?? "";
        if (!t) return fail("train_not_found", `unknown train: ${String(input.trainNumber)}`);
        const stop = t.stops.find((s) => s.stationCode === code);
        if (!stop) return fail("stop_not_found", `train ${t.number} does not stop at ${code}`);
        const h = stableHash(t.number, code);
        return okay({
          stn_code: code, train_no: t.number,
          pf_no: h % 5 === 0 ? String(((h >> 4) % 12) + 1) : stop.platform,
          exp_arr: minutesToClock(stop.arrivalMinutes) ?? null,
          exp_dep: minutesToClock(stop.departureMinutes) ?? null,
          pf_changed: h % 5 === 0,
        });
      }
      case "check_pnr": {
        const pnr = str(input.pnr);
        if (!pnr || !/^\d{10}$/.test(pnr)) return fail("invalid_pnr", "pnr must be 10 digits");
        const h = stableHash(pnr);
        const t = d.trains[h % d.trains.length];
        const fi = h % Math.max(1, t.stops.length - 1);
        const ti = Math.min(t.stops.length - 1, fi + 1 + (h % 3));
        const count = 1 + (h % 4);
        const passengers = Array.from({ length: count }, (_, i) => {
          const ph = stableHash(pnr, i);
          const confirmed = ph % 3 !== 0;
          return {
            pax_no: i + 1,
            booking_status: confirmed ? "CNF" : `WL/${(ph % 40) + 1}`,
            current_status: confirmed ? "CNF" : `RAC/${(ph % 20) + 1}`,
            coach_id: confirmed ? `B${(ph % 6) + 1}` : null,
            berth_no: confirmed ? String((ph % 72) + 1) : null,
          };
        });
        return okay({
          pnr_no: pnr, train_no: t.number,
          from_code: t.stops[fi].stationCode, to_code: t.stops[ti].stationCode,
          travel_date: "2026-02-" + String((h % 28) + 1).padStart(2, "0"),
          class_code: t.classes[h % t.classes.length],
          chart_prepared: h % 2 === 0,
          pax_list: passengers,
        });
      }
      case "journey_history": {
        const ref = str(input.reference);
        if (!ref) return fail("invalid_input", "reference is required");
        const limit = Math.max(1, Math.min(50, num(input.limit, 5)));
        const h = stableHash(ref);
        const entries = Array.from({ length: limit }, (_, i) => {
          const t = d.trains[(h + i * 37) % d.trains.length];
          const st = t.stops;
          const s = (h + i) % 3;
          return {
            booking_ref: `${ref}-${i + 1}`,
            train_no: t.number,
            from_code: st[0].stationCode,
            to_code: st[st.length - 1].stationCode,
            travel_date: `2025-${String(((h + i) % 12) + 1).padStart(2, "0")}-15`,
            state: s === 0 ? "DONE" : s === 1 ? "CANX" : "FUTURE",
          };
        });
        return okay({ traveller_ref: ref, history: entries });
      }
      case "live_status": {
        const t = d.trainByNumber.get(str(input.trainNumber) ?? "");
        if (!t) return fail("train_not_found", `unknown train: ${String(input.trainNumber)}`);
        const date = str(input.date) ?? "2026-01-01";
        const h = stableHash(t.number, date);
        const idx = h % Math.max(1, t.stops.length - 1);
        return okay({
          train_no: t.number, travel_date: date,
          last_stn: t.stops[idx].stationCode,
          next_stn: t.stops[idx + 1].stationCode,
          delay_min: (h >> 5) % 95,
          progress_pct: Math.round(((idx + 1) / t.stops.length) * 100),
          speed_kmph: 20 + ((h >> 9) % 110),
          updated_epoch: 1767225600000 + (h % 3600) * 1000,
        });
      }
      case "service_alerts": {
        const scope = str(input.scope) ?? "network";
        const reference = str(input.reference) ?? "ALL";
        const limit = Math.max(1, Math.min(25, num(input.limit, 5)));
        const h = stableHash(scope, reference);
        const alerts = Array.from({ length: limit }, (_, i) => {
          const k = stableHash(scope, reference, i);
          const sev = ["INFO", "WARN", "CRIT"][k % 3];
          return {
            alert_id: `AL-${((h + i * 13) % 99999).toString().padStart(5, "0")}`,
            severity_code: sev,
            scope_code: scope.toUpperCase(),
            ref_code: reference,
            headline: `${sev === "CRIT" ? "Service disruption" : "Service notice"} ${i + 1}`,
            body: `Reference ${reference}: ${MOCK_DELAY_REASONS[k % MOCK_DELAY_REASONS.length]}`,
            issued_epoch: 1767225600000 + i * 60000,
          };
        });
        return okay({ alerts }, { total: alerts.length, hasMore: false });
      }
      case "cancellation_information": {
        const t = d.trainByNumber.get(str(input.trainNumber) ?? "");
        if (!t) return fail("train_not_found", `unknown train: ${String(input.trainNumber)}`);
        const date = str(input.date) ?? "2026-01-01";
        const h = stableHash("canx", t.number, date);
        const full = h % 7 === 0;
        const partial = !full && h % 5 === 0;
        return okay({
          train_no: t.number, travel_date: date,
          cancel_type: full ? "FULL" : partial ? "PARTIAL" : "NONE",
          canx_from: partial ? t.stops[0].stationCode : null,
          canx_to: partial ? t.stops[Math.min(1, t.stops.length - 1)].stationCode : null,
          reason_code: MOCK_DELAY_REASONS[h % MOCK_DELAY_REASONS.length],
        });
      }
      case "diversion_information": {
        const t = d.trainByNumber.get(str(input.trainNumber) ?? "");
        if (!t) return fail("train_not_found", `unknown train: ${String(input.trainNumber)}`);
        const date = str(input.date) ?? "2026-01-01";
        const h = stableHash("div", t.number, date);
        const diverted = h % 4 === 0;
        return okay({
          train_no: t.number, travel_date: date,
          via_codes: diverted ? [d.stations[(h * 3) % d.stations.length].code] : [],
          skipped_codes: diverted ? [t.stops[Math.min(1, t.stops.length - 1)].stationCode] : [],
          extra_km: diverted ? (h % 120) + 5 : 0,
          reason_code: diverted ? MOCK_DELAY_REASONS[h % MOCK_DELAY_REASONS.length] : "none",
        });
      }
      case "delay_information": {
        const t = d.trainByNumber.get(str(input.trainNumber) ?? "");
        if (!t) return fail("train_not_found", `unknown train: ${String(input.trainNumber)}`);
        const code = str(input.stationCode) ?? t.stops[0].stationCode;
        const h = stableHash("delay", t.number, code);
        return okay({
          train_no: t.number, stn_code: code,
          delay_min: h % 120,
          reason_code: MOCK_DELAY_REASONS[h % MOCK_DELAY_REASONS.length],
          measured_epoch: 1767225600000 + (h % 7200) * 1000,
        });
      }
      default:
        return fail("capability_unsupported", `unhandled capability ${capability satisfies never}`);
    }
  }
}

export function createMockRailProvider(options?: MockRailProviderOptions): MockRailProvider {
  return new MockRailProvider(options);
}
