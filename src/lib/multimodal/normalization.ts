/** MTIP — normalization: provider-shaped payloads → immutable normalized models. */
import type { MultiModalCapabilityId } from "./contracts";
import { MultiModalNormalizationError } from "./errors";
import {
  freezeModel, makeTravelCost, makeTravelDuration,
  type NormalizedAirport, type NormalizedDistanceMatrix, type NormalizedFlight,
  type NormalizedForecast, type NormalizedHotel, type NormalizedLocation,
  type NormalizedMapRoute, type NormalizedPlace, type NormalizedRoom,
  type NormalizedTransit, type NormalizedWeather,
} from "./models";

type Raw = Record<string, unknown>;

const obj = (v: unknown, what: string): Raw => {
  if (!v || typeof v !== "object") throw new MultiModalNormalizationError(`expected object payload for ${what}`);
  return v as Raw;
};
const arr = (v: unknown): Raw[] => (Array.isArray(v) ? (v as Raw[]) : []);
const s = (r: Raw, k: string, d = ""): string => (typeof r[k] === "string" ? (r[k] as string) : d);
const n = (r: Raw, k: string, d = 0): number => (typeof r[k] === "number" ? (r[k] as number) : d);
const b = (r: Raw, k: string, d = false): boolean => (typeof r[k] === "boolean" ? (r[k] as boolean) : d);
const list = (r: Raw, k: string): readonly string[] =>
  Array.isArray(r[k]) ? (r[k] as unknown[]).filter((x): x is string => typeof x === "string") : [];

function location(r: Raw): NormalizedLocation {
  return freezeModel({
    id: s(r, "loc_id", s(r, "id")),
    name: s(r, "name"),
    lat: n(r, "lat"),
    lon: n(r, "lon"),
    country: s(r, "country"),
    region: s(r, "region"),
    timezone: s(r, "tz", s(r, "timezone")),
  });
}
function airport(r: Raw): NormalizedAirport {
  return freezeModel({
    code: s(r, "iata"), name: s(r, "name"), city: s(r, "city"), country: s(r, "country"),
    lat: n(r, "lat"), lon: n(r, "lon"), timezone: s(r, "tz"), terminals: n(r, "terminals", 1),
  });
}
function flight(r: Raw): NormalizedFlight {
  const dep = n(r, "dep_min"); const arrM = n(r, "arr_min");
  const duration = arrM >= dep ? arrM - dep : 1440 - dep + arrM;
  return freezeModel({
    flightNumber: s(r, "flight_no"), carrier: s(r, "carrier_code"),
    fromCode: s(r, "origin"), toCode: s(r, "destination"),
    departureMinutes: dep, arrivalMinutes: arrM, durationMinutes: duration,
    stops: n(r, "stops"), aircraft: s(r, "aircraft_type"),
    cabins: list(r, "cabin_classes"),
    cost: makeTravelCost({ amount: n(r, "base_fare"), currency: s(r, "currency", "INR"), label: "base_fare" }),
  });
}
function hotel(r: Raw): NormalizedHotel {
  return freezeModel({
    id: s(r, "hotel_id"), name: s(r, "name"), city: s(r, "city"), country: s(r, "country"),
    stars: n(r, "stars"), rating: n(r, "rating"), lat: n(r, "lat"), lon: n(r, "lon"),
    amenities: list(r, "amenities"),
    nightlyCost: makeTravelCost({ amount: n(r, "nightly_rate"), currency: s(r, "currency", "INR"), label: "nightly" }),
  });
}
function room(r: Raw): NormalizedRoom {
  return freezeModel({
    id: s(r, "room_id"), hotelId: s(r, "hotel_id"), name: s(r, "name"),
    capacity: n(r, "capacity", 1), bedType: s(r, "bed_type"),
    cost: makeTravelCost({ amount: n(r, "price"), currency: s(r, "currency", "INR"), label: "nightly" }),
  });
}
function place(r: Raw): NormalizedPlace {
  return freezeModel({
    id: s(r, "place_id"), name: s(r, "name"), category: s(r, "category"),
    location: location(obj(r.location, "place.location")),
    rating: n(r, "rating"), tags: list(r, "tags"),
  });
}
function weather(r: Raw): NormalizedWeather {
  return freezeModel({
    place: s(r, "place"), condition: s(r, "condition"),
    temperatureC: n(r, "temp_c"), feelsLikeC: n(r, "feels_c"),
    humidity: n(r, "humidity"), windKph: n(r, "wind_kph"), windBearing: n(r, "wind_deg"),
    visibilityM: n(r, "visibility_m"), rainProbability: n(r, "rain_prob"),
    airQualityIndex: n(r, "aqi"), observedAt: n(r, "observed_at"),
  });
}
function forecast(r: Raw): NormalizedForecast {
  return freezeModel({
    place: s(r, "place"),
    granularity: s(r, "granularity") === "daily" ? "daily" : "hourly",
    points: arr(r.points).map((p) => ({
      at: n(p, "at"), condition: s(p, "condition"),
      temperatureC: n(p, "temp_c"), rainProbability: n(p, "rain_prob"), windKph: n(p, "wind_kph"),
    })),
  });
}
function alerts(r: Raw) {
  return freezeModel(arr(r.alerts).map((a) => ({
    id: s(a, "alert_id"), place: s(a, "place"),
    kind: s(a, "kind", "advisory"), severity: s(a, "severity", "info"),
    message: s(a, "message"), issuedAt: n(a, "issued_at"),
  })));
}
function measure(r: Raw) {
  return freezeModel({ metric: s(r, "metric"), value: n(r, "value"), unit: s(r, "unit"), at: n(r, "at") });
}
function transit(r: Raw): NormalizedTransit {
  return freezeModel({
    id: s(r, "option_id"),
    kind: s(r, "mode", "walking") as NormalizedTransit["kind"],
    from: s(r, "from"), to: s(r, "to"),
    duration: makeTravelDuration(n(r, "minutes"), s(r, "mode")),
    cost: makeTravelCost({ amount: n(r, "fare"), currency: s(r, "currency", "INR"), label: "fare" }),
    distanceKm: n(r, "distance_km"), transfers: n(r, "transfers"),
  });
}
function route(r: Raw): NormalizedMapRoute {
  return freezeModel({
    id: s(r, "route_id"),
    from: location(obj(r.from, "route.from")),
    to: location(obj(r.to, "route.to")),
    mode: s(r, "mode"), distanceKm: n(r, "distance_km"),
    duration: makeTravelDuration(n(r, "minutes"), s(r, "mode")),
    steps: arr(r.steps).map((st) => ({
      seq: n(st, "seq"), instruction: s(st, "text"),
      distanceKm: n(st, "distance_km"), minutes: n(st, "minutes"),
    })),
  });
}
function matrix(r: Raw): NormalizedDistanceMatrix {
  return freezeModel({
    cells: arr(r.cells).map((cl) => ({
      origin: s(cl, "origin"), destination: s(cl, "destination"),
      distanceKm: n(cl, "distance_km"), minutes: n(cl, "minutes"),
    })),
  });
}
function timezone(r: Raw) {
  return freezeModel({
    id: s(r, "tz_id"), place: s(r, "place"),
    offsetMinutes: n(r, "offset_min"), abbreviation: s(r, "abbr"), dst: b(r, "dst"),
  });
}
function localTime(r: Raw) {
  return freezeModel({
    place: s(r, "place"), timezone: timezone(obj(r.tz, "localTime.tz")),
    instant: n(r, "instant"), localIso: s(r, "local_iso"),
  });
}
function exchangeRate(r: Raw) {
  return freezeModel({ from: s(r, "from"), to: s(r, "to"), rate: n(r, "rate"), asOf: n(r, "as_of") });
}

/** Deterministic normalization for every MTIP capability. */
export function normalizeTravelPayload(capability: MultiModalCapabilityId, raw: unknown): unknown {
  const r = obj(raw, capability);
  switch (capability) {
    case "search_airports": return freezeModel(arr(r.airports).map(airport));
    case "search_flights": return freezeModel(arr(r.flights).map(flight));
    case "flight_status": return freezeModel({
      flightNumber: s(r, "flight_no"), state: s(r, "state", "scheduled"),
      delayMinutes: n(r, "delay_min"), gate: s(r, "gate"), terminal: s(r, "terminal"),
      updatedAt: n(r, "updated_at"),
    });
    case "flight_schedule": return freezeModel({
      flightNumber: s(r, "flight_no"), fromCode: s(r, "origin"), toCode: s(r, "destination"),
      legs: arr(r.legs).map((l) => ({ day: s(l, "day"), departureMinutes: n(l, "dep_min"), arrivalMinutes: n(l, "arr_min") })),
    });
    case "flight_metadata": return freezeModel({
      flightNumber: s(r, "flight_no"), carrier: s(r, "carrier_code"), aircraft: s(r, "aircraft_type"),
      seats: n(r, "seat_count"), cabins: list(r, "cabin_classes"), wifi: b(r, "wifi"),
    });
    case "fare_lookup": return freezeModel(arr(r.fares).map((f) => makeTravelCost({
      amount: n(f, "amount"), currency: s(f, "currency", "INR"), label: s(f, "cabin"),
      refundable: b(f, "refundable"), breakdown: { base: n(f, "base"), taxes: n(f, "taxes") },
    })));
    case "flight_delay_information": return freezeModel({
      flightNumber: s(r, "flight_no"), delayMinutes: n(r, "delay_min"),
      cause: s(r, "cause"), confidence: n(r, "confidence"),
    });
    case "search_hotels": return freezeModel(arr(r.hotels).map(hotel));
    case "hotel_metadata": return hotel(obj(r.hotel, "hotel"));
    case "search_rooms": return freezeModel(arr(r.rooms).map(room));
    case "hotel_availability": return freezeModel({
      hotelId: s(r, "hotel_id"), available: b(r, "available"), roomsLeft: n(r, "rooms_left"),
      checkIn: s(r, "check_in"), checkOut: s(r, "check_out"), nights: n(r, "nights", 1),
    });
    case "hotel_pricing": return makeTravelCost({
      amount: n(r, "amount"), currency: s(r, "currency", "INR"), label: "stay",
      breakdown: { base: n(r, "base"), taxes: n(r, "taxes"), nights: n(r, "nights"), nightly: n(r, "nightly") },
    });
    case "hotel_amenities": return freezeModel([...list(r, "amenities")]);
    case "geocode":
    case "reverse_geocode":
    case "coordinates": return location(obj(r.location, capability));
    case "search_places": return freezeModel(arr(r.places).map(place));
    case "distance_matrix": return matrix(r);
    case "route": return route(r);
    case "travel_time": return makeTravelDuration(n(r, "minutes"), s(r, "mode"), n(r, "confidence", 0.8));
    case "region_lookup": return freezeModel({
      id: s(r, "region_id"), name: s(r, "name"), country: s(r, "country"),
      level: s(r, "level", "city"), parents: list(r, "parents"),
    });
    case "weather": return weather(r);
    case "forecast_hourly":
    case "forecast_daily": return forecast(r);
    case "travel_alerts":
    case "storm_alerts": return alerts(r);
    case "rain_probability":
    case "visibility":
    case "temperature":
    case "wind":
    case "air_quality": return measure(r);
    case "local_transport": return freezeModel(arr(r.options).map(transit));
    case "transit_modes": return freezeModel([...list(r, "modes")]);
    case "exchange_rate":
    case "historical_rate": return exchangeRate(r);
    case "currency_convert": return freezeModel({
      from: s(r, "from"), to: s(r, "to"), amount: n(r, "amount"), converted: n(r, "converted"),
      rate: freezeModel({ from: s(r, "from"), to: s(r, "to"), rate: n(r, "rate"), asOf: n(r, "as_of") }),
    });
    case "travel_budget_currency": return freezeModel({
      homeCurrency: s(r, "home"), destinationCurrency: s(r, "dest"),
      homeAmount: n(r, "home_amount"), destinationAmount: n(r, "dest_amount"), rate: n(r, "rate"),
    });
    case "timezone_lookup":
    case "dst_information": return timezone(r);
    case "local_time":
    case "arrival_time":
    case "departure_time": return localTime(r);
    default:
      throw new MultiModalNormalizationError(`no normalizer for capability: ${capability}`);
  }
}
