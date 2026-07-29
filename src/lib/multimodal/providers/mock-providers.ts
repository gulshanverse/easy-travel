/** MTIP — mock provider adapters (deterministic, offline, no network calls).
 *  Providers return PROVIDER-SHAPED payloads; normalization happens in MTIP.
 */
import { MultiModalCapabilityUnsupportedError } from "../errors";
import { capabilitiesForMode, type MultiModalCapabilityId, type TravelMode } from "../contracts";
import {
  haversineKm, mockTravelDataset, seededCondition, seededUnit,
  type MockAirport, type MockCity, type MockHotel, type MockPlace,
} from "./mock-data";
import type {
  CurrencyProvider, FlightProvider, HotelProvider, MapsProvider, TimezoneProvider,
  TransitProvider, TravelProviderAdapter, TravelProviderProfile, TravelProviderRawResult,
  TravelRequestInput, WeatherProvider,
} from "./types";

const ok = (data: unknown, pagination?: { total?: number; hasMore?: boolean }): TravelProviderRawResult =>
  Object.freeze({ ok: true, data, pagination });
const fail = (code: string, message: string, retryable = false): TravelProviderRawResult =>
  Object.freeze({ ok: false, error: { code, message, retryable } });

const str = (i: TravelRequestInput, k: string, d = ""): string => (typeof i[k] === "string" ? (i[k] as string) : d);
const num = (i: TravelRequestInput, k: string, d = 0): number => (typeof i[k] === "number" ? (i[k] as number) : d);

function profile(
  id: string, name: string, mode: TravelMode, extra: Partial<TravelProviderProfile> = {},
): TravelProviderProfile {
  return Object.freeze({
    id, name, mode, kind: "mock", version: "1.0.0", functional: true,
    capabilities: Object.freeze(capabilitiesForMode(mode)),
    ...extra,
  });
}

function baseAdapter(
  p: TravelProviderProfile,
  run: (capability: MultiModalCapabilityId, input: TravelRequestInput) => TravelProviderRawResult,
): TravelProviderAdapter {
  return Object.freeze({
    profile: p,
    supports(capability: MultiModalCapabilityId) { return p.capabilities.includes(capability); },
    async execute(capability: MultiModalCapabilityId, input: TravelRequestInput) {
      if (!p.capabilities.includes(capability)) {
        throw new MultiModalCapabilityUnsupportedError(p.id, capability);
      }
      return run(capability, input);
    },
    async probe() { return { healthy: true }; },
  });
}

// ------------------------------------------------------------------ Flight
export function createMockFlightProvider(options: { id?: string; failCapability?: MultiModalCapabilityId } = {}): FlightProvider {
  const p = profile(options.id ?? "mock-flight", "Mock Flight Provider", "flight");
  const ds = mockTravelDataset();
  const findAirport = (code: string): MockAirport | undefined =>
    ds.airports.find((a) => a.code.toLowerCase() === code.toLowerCase());

  const run = (capability: MultiModalCapabilityId, input: TravelRequestInput): TravelProviderRawResult => {
    if (options.failCapability === capability) return fail("mock_forced_failure", `forced failure for ${capability}`, true);
    switch (capability) {
      case "search_airports": {
        const q = str(input, "query").toLowerCase();
        const limit = num(input, "limit", 20);
        const matches = ds.airports.filter(
          (a) => a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q) || a.city.toLowerCase().includes(q),
        ).slice(0, limit);
        return ok({ airports: matches.map((a) => ({
          iata: a.code, name: a.name, city: a.city, country: a.country,
          lat: a.lat, lon: a.lon, tz: a.tz, terminals: a.terminals,
        })) }, { total: matches.length, hasMore: false });
      }
      case "search_flights": {
        const from = str(input, "fromCode").toUpperCase();
        const to = str(input, "toCode").toUpperCase();
        const limit = num(input, "limit", 20);
        let matches = ds.flights.filter((f) => f.from === from && f.to === to);
        if (matches.length === 0) matches = ds.flights.filter((f) => f.from === from).slice(0, limit);
        if (matches.length === 0) matches = ds.flights.slice(0, limit);
        return ok({ flights: matches.slice(0, limit).map((f) => ({
          flight_no: f.number, carrier_code: f.carrier, origin: f.from, destination: f.to,
          dep_min: f.dep, arr_min: f.arr, stops: f.stops, aircraft_type: f.aircraft,
          cabin_classes: ["economy", "business"], base_fare: f.baseFare, currency: f.currency,
        })) }, { total: matches.length, hasMore: matches.length > limit });
      }
      case "flight_status": {
        const no = str(input, "flightNumber");
        const f = ds.flights.find((x) => x.number === no);
        if (!f) return fail("mock_not_found", `flight not found: ${no}`);
        const u = seededUnit(`status:${no}`);
        const delay = u > 0.7 ? Math.round(u * 90) : 0;
        const state = u > 0.95 ? "cancelled" : delay > 0 ? "delayed" : u > 0.5 ? "en_route" : "scheduled";
        return ok({
          flight_no: no, state, delay_min: delay,
          gate: `G${1 + Math.floor(u * 40)}`, terminal: `T${1 + Math.floor(u * 3)}`,
          updated_at: 0,
        });
      }
      case "flight_schedule": {
        const no = str(input, "flightNumber");
        const f = ds.flights.find((x) => x.number === no);
        if (!f) return fail("mock_not_found", `flight not found: ${no}`);
        const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
        return ok({
          flight_no: no, origin: f.from, destination: f.to,
          legs: days.map((d, i) => ({ day: d, dep_min: (f.dep + i * 3) % 1440, arr_min: (f.arr + i * 3) % 1440 })),
        });
      }
      case "flight_metadata": {
        const no = str(input, "flightNumber");
        const f = ds.flights.find((x) => x.number === no);
        if (!f) return fail("mock_not_found", `flight not found: ${no}`);
        return ok({
          flight_no: no, carrier_code: f.carrier, aircraft_type: f.aircraft,
          seat_count: f.seats, cabin_classes: ["economy", "business"], wifi: f.wifi,
        });
      }
      case "fare_lookup": {
        const no = str(input, "flightNumber");
        const f = ds.flights.find((x) => x.number === no);
        if (!f) return fail("mock_not_found", `flight not found: ${no}`);
        const cabins = str(input, "cabin") ? [str(input, "cabin")] : ["economy", "business"];
        return ok({ fares: cabins.map((cabin, i) => {
          const base = Math.round(f.baseFare * (cabin === "business" ? 2.7 : 1));
          const taxes = Math.round(base * 0.14);
          return {
            cabin, base, taxes, amount: base + taxes, currency: f.currency,
            refundable: i > 0,
          };
        }) });
      }
      case "flight_delay_information": {
        const no = str(input, "flightNumber");
        const u = seededUnit(`delay:${no}`);
        const delay = u > 0.6 ? Math.round(u * 120) : 0;
        return ok({
          flight_no: no, delay_min: delay,
          cause: delay === 0 ? "none" : ["weather", "atc", "rotation", "technical"][Math.floor(u * 4) % 4],
          confidence: Math.round((0.6 + u * 0.35) * 100) / 100,
        });
      }
      default:
        return fail("mock_unsupported", `unsupported: ${capability}`);
    }
  };
  return baseAdapter(p, run) as FlightProvider;
}

// ------------------------------------------------------------------- Hotel
export function createMockHotelProvider(options: { id?: string } = {}): HotelProvider {
  const p = profile(options.id ?? "mock-hotel", "Mock Hotel Provider", "hotel");
  const ds = mockTravelDataset();
  const rawHotel = (h: MockHotel) => ({
    hotel_id: h.id, name: h.name, city: h.city, country: h.country, stars: h.stars,
    rating: h.rating, lat: h.lat, lon: h.lon, amenities: h.amenities,
    nightly_rate: h.nightly, currency: h.currency,
  });
  const find = (id: string) => ds.hotels.find((h) => h.id === id);

  const run = (capability: MultiModalCapabilityId, input: TravelRequestInput): TravelProviderRawResult => {
    switch (capability) {
      case "search_hotels": {
        const city = str(input, "city").toLowerCase();
        const limit = num(input, "limit", 20);
        let matches = city ? ds.hotels.filter((h) => h.city.toLowerCase().includes(city)) : ds.hotels;
        if (typeof input.lat === "number" && typeof input.lon === "number") {
          const lat = num(input, "lat"); const lon = num(input, "lon");
          matches = [...matches].sort(
            (a, b) => haversineKm(lat, lon, a.lat, a.lon) - haversineKm(lat, lon, b.lat, b.lon),
          );
        }
        return ok({ hotels: matches.slice(0, limit).map(rawHotel) }, { total: matches.length });
      }
      case "search_rooms": {
        const h = find(str(input, "hotelId"));
        if (!h) return fail("mock_not_found", `hotel not found: ${str(input, "hotelId")}`);
        const guests = num(input, "guests", 1);
        return ok({ rooms: h.rooms.filter((r) => r.capacity >= guests || guests <= 1).map((r) => ({
          room_id: r.id, hotel_id: h.id, name: r.name, capacity: r.capacity,
          bed_type: r.bed, price: r.price, currency: h.currency,
        })) });
      }
      case "hotel_availability": {
        const h = find(str(input, "hotelId"));
        if (!h) return fail("mock_not_found", `hotel not found: ${str(input, "hotelId")}`);
        const checkIn = str(input, "checkIn", "2026-08-01");
        const checkOut = str(input, "checkOut", "2026-08-03");
        const u = seededUnit(`avail:${h.id}:${checkIn}`);
        const roomsLeft = Math.floor(u * 12);
        return ok({
          hotel_id: h.id, available: roomsLeft > 0, rooms_left: roomsLeft,
          check_in: checkIn, check_out: checkOut,
          nights: Math.max(1, Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / 86400000) || 1),
        });
      }
      case "hotel_pricing": {
        const h = find(str(input, "hotelId"));
        if (!h) return fail("mock_not_found", `hotel not found: ${str(input, "hotelId")}`);
        const nights = Math.max(1, num(input, "nights", 1));
        const roomId = str(input, "roomId");
        const room = h.rooms.find((r) => r.id === roomId);
        const nightly = room ? room.price : h.nightly;
        const base = nightly * nights;
        const taxes = Math.round(base * 0.12);
        return ok({
          hotel_id: h.id, nights, nightly, base, taxes,
          amount: base + taxes, currency: h.currency,
        });
      }
      case "hotel_amenities": {
        const h = find(str(input, "hotelId"));
        if (!h) return fail("mock_not_found", `hotel not found: ${str(input, "hotelId")}`);
        return ok({ amenities: h.amenities });
      }
      case "hotel_metadata": {
        const h = find(str(input, "hotelId"));
        if (!h) return fail("mock_not_found", `hotel not found: ${str(input, "hotelId")}`);
        return ok({ hotel: rawHotel(h) });
      }
      default:
        return fail("mock_unsupported", `unsupported: ${capability}`);
    }
  };
  return baseAdapter(p, run) as HotelProvider;
}

// -------------------------------------------------------------------- Maps
function cityOf(name: string): MockCity {
  const ds = mockTravelDataset();
  const q = name.toLowerCase();
  return ds.cities.find((c) => c.name.toLowerCase().includes(q)) ?? ds.cities[0];
}
function rawLocation(name: string) {
  const c = cityOf(name);
  return {
    loc_id: `loc_${c.name.toLowerCase().replace(/\s+/g, "_")}`,
    name: c.name, lat: c.lat, lon: c.lon, country: c.country,
    region: `${c.name} Metropolitan Area`, tz: c.timezone,
  };
}
function nearestCity(lat: number, lon: number): MockCity {
  const ds = mockTravelDataset();
  return [...ds.cities].sort(
    (a, b) => haversineKm(lat, lon, a.lat, a.lon) - haversineKm(lat, lon, b.lat, b.lon),
  )[0];
}

export function createMockMapsProvider(options: { id?: string } = {}): MapsProvider {
  const p = profile(options.id ?? "mock-maps", "Mock Maps Provider", "maps");
  const ds = mockTravelDataset();
  const rawPlace = (pl: MockPlace) => ({
    place_id: pl.id, name: pl.name, category: pl.category, rating: pl.rating,
    tags: [pl.category, pl.city.toLowerCase()],
    location: {
      loc_id: `loc_${pl.id}`, name: pl.name, lat: pl.lat, lon: pl.lon,
      country: pl.country, region: pl.city, tz: pl.tz,
    },
  });
  const speedKph = (mode: string) =>
    mode === "walking" ? 5 : mode === "cycling" ? 16 : mode === "transit" ? 32 : 55;

  const run = (capability: MultiModalCapabilityId, input: TravelRequestInput): TravelProviderRawResult => {
    switch (capability) {
      case "geocode":
        return ok({ location: rawLocation(str(input, "query")) });
      case "reverse_geocode": {
        const c = nearestCity(num(input, "lat"), num(input, "lon"));
        return ok({ location: rawLocation(c.name) });
      }
      case "coordinates": {
        const id = str(input, "placeId");
        const pl = ds.places.find((x) => x.id === id);
        if (!pl) return fail("mock_not_found", `place not found: ${id}`);
        return ok({ location: rawPlace(pl).location });
      }
      case "search_places": {
        const q = str(input, "query").toLowerCase();
        const category = str(input, "category");
        const limit = num(input, "limit", 20);
        const matches = ds.places.filter((pl) =>
          (pl.name.toLowerCase().includes(q) || pl.city.toLowerCase().includes(q) || pl.category.includes(q)) &&
          (!category || pl.category === category),
        ).slice(0, limit);
        return ok({ places: matches.map(rawPlace) }, { total: matches.length });
      }
      case "distance_matrix": {
        const origins = Array.isArray(input.origins) ? (input.origins as string[]) : [];
        const destinations = Array.isArray(input.destinations) ? (input.destinations as string[]) : [];
        const cells = [];
        for (const o of origins) {
          for (const d of destinations) {
            const a = cityOf(o); const b = cityOf(d);
            const km = haversineKm(a.lat, a.lon, b.lat, b.lon);
            cells.push({ origin: o, destination: d, distance_km: km, minutes: Math.round((km / 55) * 60) });
          }
        }
        return ok({ cells });
      }
      case "route": {
        const mode = str(input, "mode", "drive");
        const a = cityOf(str(input, "from")); const b = cityOf(str(input, "to"));
        const km = haversineKm(a.lat, a.lon, b.lat, b.lon);
        const minutes = Math.max(1, Math.round((km / speedKph(mode)) * 60));
        const stepCount = 3 + Math.floor(seededUnit(`${a.name}:${b.name}`) * 4);
        return ok({
          route_id: `rte_${a.name}_${b.name}`.toLowerCase().replace(/\s+/g, "_"),
          from: rawLocation(a.name), to: rawLocation(b.name), mode,
          distance_km: km, minutes,
          steps: Array.from({ length: stepCount }, (_, i) => ({
            seq: i + 1,
            text: `Continue toward ${b.name} (leg ${i + 1})`,
            distance_km: Math.round((km / stepCount) * 100) / 100,
            minutes: Math.round(minutes / stepCount),
          })),
        });
      }
      case "travel_time": {
        const mode = str(input, "mode", "drive");
        const a = cityOf(str(input, "from")); const b = cityOf(str(input, "to"));
        const km = haversineKm(a.lat, a.lon, b.lat, b.lon);
        return ok({ minutes: Math.max(1, Math.round((km / speedKph(mode)) * 60)), mode, confidence: 0.86 });
      }
      case "region_lookup": {
        const c = typeof input.lat === "number"
          ? nearestCity(num(input, "lat"), num(input, "lon"))
          : cityOf(str(input, "placeId", str(input, "place", "Mumbai")));
        return ok({
          region_id: `reg_${c.name.toLowerCase().replace(/\s+/g, "_")}`,
          name: c.name, country: c.country, level: "city",
          parents: [c.country],
        });
      }
      default:
        return fail("mock_unsupported", `unsupported: ${capability}`);
    }
  };
  return baseAdapter(p, run) as MapsProvider;
}

// ----------------------------------------------------------------- Weather
export function createMockWeatherProvider(options: { id?: string } = {}): WeatherProvider {
  const p = profile(options.id ?? "mock-weather", "Mock Weather Provider", "weather");

  const placeKey = (input: TravelRequestInput): string =>
    str(input, "place") || `${num(input, "lat")},${num(input, "lon")}`;

  const measure = (place: string, metric: string) => {
    const u = seededUnit(`${metric}:${place}`);
    switch (metric) {
      case "temperature": return { metric, value: Math.round((2 + u * 38) * 10) / 10, unit: "C" };
      case "wind": return { metric, value: Math.round(u * 60), unit: "kph" };
      case "visibility": return { metric, value: 500 + Math.round(u * 9500), unit: "m" };
      case "rain_probability": return { metric, value: Math.round(u * 100), unit: "%" };
      case "air_quality": return { metric, value: 10 + Math.round(u * 240), unit: "aqi" };
      default: return { metric, value: Math.round(u * 100), unit: "" };
    }
  };

  const alerts = (place: string, only: "storm" | "all") => {
    const u = seededUnit(`alert:${place}`);
    const list = [] as Array<Record<string, unknown>>;
    if (u > 0.55) {
      list.push({
        alert_id: `alr_${place}_storm`, place, kind: "storm",
        severity: u > 0.85 ? "severe" : "moderate",
        message: `Thunderstorm activity expected near ${place}.`, issued_at: 0,
      });
    }
    if (only === "all" && u > 0.3) {
      list.push({
        alert_id: `alr_${place}_advisory`, place, kind: "advisory",
        severity: "minor", message: `Allow extra transfer time in ${place}.`, issued_at: 0,
      });
    }
    return list;
  };

  const run = (capability: MultiModalCapabilityId, input: TravelRequestInput): TravelProviderRawResult => {
    const place = placeKey(input);
    switch (capability) {
      case "weather": {
        const u = seededUnit(`now:${place}`);
        return ok({
          place, condition: seededCondition(`cond:${place}`),
          temp_c: Math.round((2 + u * 38) * 10) / 10,
          feels_c: Math.round((2 + u * 38 + 1.5) * 10) / 10,
          humidity: 30 + Math.round(u * 65),
          wind_kph: Math.round(u * 60), wind_deg: Math.round(u * 360),
          visibility_m: 500 + Math.round(u * 9500),
          rain_prob: Math.round(u * 100),
          aqi: 10 + Math.round(u * 240),
          observed_at: 0,
        });
      }
      case "forecast_hourly":
      case "forecast_daily": {
        const hourly = capability === "forecast_hourly";
        const count = hourly ? Math.max(1, num(input, "hours", 12)) : Math.max(1, num(input, "days", 7));
        const stepMs = hourly ? 3_600_000 : 86_400_000;
        return ok({
          place, granularity: hourly ? "hourly" : "daily",
          points: Array.from({ length: count }, (_, i) => {
            const u = seededUnit(`${place}:${capability}:${i}`);
            return {
              at: i * stepMs,
              condition: seededCondition(`${place}:${i}`),
              temp_c: Math.round((4 + u * 34) * 10) / 10,
              rain_prob: Math.round(u * 100),
              wind_kph: Math.round(u * 55),
            };
          }),
        });
      }
      case "travel_alerts": return ok({ alerts: alerts(place, "all") });
      case "storm_alerts": return ok({ alerts: alerts(place, "storm") });
      case "rain_probability": return ok(measure(place, "rain_probability"));
      case "visibility": return ok(measure(place, "visibility"));
      case "temperature": return ok(measure(place, "temperature"));
      case "wind": return ok(measure(place, "wind"));
      case "air_quality": return ok(measure(place, "air_quality"));
      default: return fail("mock_unsupported", `unsupported: ${capability}`);
    }
  };
  return baseAdapter(p, run) as WeatherProvider;
}

// ----------------------------------------------------------------- Transit
export function createMockTransitProvider(options: { id?: string } = {}): TransitProvider {
  const p = profile(options.id ?? "mock-transit", "Mock Transit Provider", "transit");
  const ALL = ["metro", "bus", "taxi", "auto", "walking", "cycling", "ferry", "ride_share"] as const;
  const speed: Record<string, number> = {
    metro: 34, bus: 18, taxi: 26, auto: 22, walking: 5, cycling: 15, ferry: 28, ride_share: 27,
  };
  const perKm: Record<string, number> = {
    metro: 3, bus: 2, taxi: 22, auto: 14, walking: 0, cycling: 1, ferry: 12, ride_share: 19,
  };

  const run = (capability: MultiModalCapabilityId, input: TravelRequestInput): TravelProviderRawResult => {
    switch (capability) {
      case "transit_modes": {
        const city = str(input, "city");
        const u = seededUnit(`modes:${city}`);
        const available = ALL.filter((m, i) => m === "walking" || m === "taxi" || (i + Math.floor(u * 10)) % 3 !== 0);
        return ok({ modes: available });
      }
      case "local_transport": {
        const from = str(input, "from"); const to = str(input, "to");
        const requested = Array.isArray(input.modes) ? (input.modes as string[]) : [...ALL];
        const limit = num(input, "limit", requested.length);
        const a = cityOf(from); const b = cityOf(to);
        const km = Math.max(1.2, haversineKm(a.lat, a.lon, b.lat, b.lon) || 6.4);
        const options2 = requested
          .filter((m) => (ALL as readonly string[]).includes(m))
          .slice(0, limit)
          .map((m) => {
            const u = seededUnit(`${m}:${from}:${to}`);
            return {
              option_id: `trn_${m}_${Math.round(km * 10)}`,
              mode: m, from, to,
              minutes: Math.max(2, Math.round((km / speed[m]) * 60 * (0.9 + u * 0.3))),
              fare: Math.round(km * perKm[m] * (0.9 + u * 0.25)),
              currency: a.currency,
              distance_km: km,
              transfers: m === "metro" || m === "bus" ? Math.floor(u * 3) : 0,
            };
          });
        return ok({ options: options2 }, { total: options2.length });
      }
      default: return fail("mock_unsupported", `unsupported: ${capability}`);
    }
  };
  return baseAdapter(p, run) as TransitProvider;
}

// ---------------------------------------------------------------- Currency
export function createMockCurrencyProvider(options: { id?: string } = {}): CurrencyProvider {
  const p = profile(options.id ?? "mock-currency", "Mock Currency Provider", "currency");
  const ds = mockTravelDataset();
  const rate = (from: string, to: string, daysAgo = 0): number => {
    const f = ds.rates[from.toUpperCase()]; const t = ds.rates[to.toUpperCase()];
    if (!f || !t) return 0;
    const drift = daysAgo === 0 ? 1 : 1 + (seededUnit(`${from}:${to}:${daysAgo}`) - 0.5) * 0.06;
    return Math.round((f / t) * drift * 1e6) / 1e6;
  };

  const run = (capability: MultiModalCapabilityId, input: TravelRequestInput): TravelProviderRawResult => {
    const from = str(input, "from") || str(input, "homeCurrency");
    const to = str(input, "to") || str(input, "destinationCurrency");
    switch (capability) {
      case "exchange_rate":
      case "historical_rate": {
        const daysAgo = capability === "historical_rate" ? num(input, "daysAgo", 30) : 0;
        const r = rate(from, to, daysAgo);
        if (!r) return fail("mock_unknown_currency", `unknown currency pair ${from}/${to}`);
        return ok({ from: from.toUpperCase(), to: to.toUpperCase(), rate: r, as_of: -daysAgo * 86_400_000 });
      }
      case "currency_convert": {
        const amount = num(input, "amount");
        const r = rate(from, to);
        if (!r) return fail("mock_unknown_currency", `unknown currency pair ${from}/${to}`);
        return ok({
          from: from.toUpperCase(), to: to.toUpperCase(), amount,
          converted: Math.round(amount * r * 100) / 100, rate: r, as_of: 0,
        });
      }
      case "travel_budget_currency": {
        const amount = num(input, "amount");
        const r = rate(from, to);
        if (!r) return fail("mock_unknown_currency", `unknown currency pair ${from}/${to}`);
        return ok({
          home: from.toUpperCase(), dest: to.toUpperCase(),
          home_amount: amount, dest_amount: Math.round(amount * r * 100) / 100, rate: r,
        });
      }
      default: return fail("mock_unsupported", `unsupported: ${capability}`);
    }
  };
  return baseAdapter(p, run) as CurrencyProvider;
}

// ---------------------------------------------------------------- Timezone
export function createMockTimezoneProvider(options: { id?: string } = {}): TimezoneProvider {
  const p = profile(options.id ?? "mock-timezone", "Mock Timezone Provider", "timezone");
  const OFFSETS: Record<string, { offset: number; abbr: string; dst: boolean }> = {
    "Asia/Kolkata": { offset: 330, abbr: "IST", dst: false },
    "Asia/Dubai": { offset: 240, abbr: "GST", dst: false },
    "Asia/Singapore": { offset: 480, abbr: "SGT", dst: false },
    "Asia/Bangkok": { offset: 420, abbr: "ICT", dst: false },
    "Asia/Tokyo": { offset: 540, abbr: "JST", dst: false },
    "Europe/London": { offset: 60, abbr: "BST", dst: true },
    "Europe/Paris": { offset: 120, abbr: "CEST", dst: true },
    "Europe/Zurich": { offset: 120, abbr: "CEST", dst: true },
    "Europe/Rome": { offset: 120, abbr: "CEST", dst: true },
    "America/New_York": { offset: -240, abbr: "EDT", dst: true },
    "America/Los_Angeles": { offset: -420, abbr: "PDT", dst: true },
    "America/Toronto": { offset: -240, abbr: "EDT", dst: true },
    "Australia/Sydney": { offset: 600, abbr: "AEST", dst: false },
    "Africa/Johannesburg": { offset: 120, abbr: "SAST", dst: false },
    "Atlantic/Reykjavik": { offset: 0, abbr: "GMT", dst: false },
  };

  const resolve = (input: TravelRequestInput) => {
    const place = str(input, "place");
    const c = place ? cityOf(place) : nearestCity(num(input, "lat"), num(input, "lon"));
    const z = OFFSETS[c.timezone] ?? { offset: 0, abbr: "UTC", dst: false };
    return { city: c, z };
  };

  const localIso = (instant: number, offsetMinutes: number): string =>
    new Date(instant + offsetMinutes * 60_000).toISOString().replace("Z", "");

  const run = (capability: MultiModalCapabilityId, input: TravelRequestInput): TravelProviderRawResult => {
    const { city, z } = resolve(input);
    const tz = { tz_id: city.timezone, place: city.name, offset_min: z.offset, abbr: z.abbr, dst: z.dst };
    switch (capability) {
      case "timezone_lookup":
      case "dst_information":
        return ok(tz);
      case "local_time":
      case "arrival_time":
      case "departure_time": {
        const instant = num(input, "at", 0);
        return ok({ place: city.name, instant, local_iso: localIso(instant, z.offset), tz });
      }
      default: return fail("mock_unsupported", `unsupported: ${capability}`);
    }
  };
  return baseAdapter(p, run) as TimezoneProvider;
}

/** Convenience: every mock provider in a deterministic order. */
export function createAllMockProviders(): readonly TravelProviderAdapter[] {
  return Object.freeze([
    createMockFlightProvider(),
    createMockHotelProvider(),
    createMockMapsProvider(),
    createMockWeatherProvider(),
    createMockTransitProvider(),
    createMockCurrencyProvider(),
    createMockTimezoneProvider(),
  ]);
}
