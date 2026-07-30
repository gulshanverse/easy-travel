/** MTIP — deterministic mock dataset (seeded LCG, no randomness, no network). */

const CITIES = [
  ["Mumbai", "IN", "Asia/Kolkata", "INR", 19.076, 72.877],
  ["Delhi", "IN", "Asia/Kolkata", "INR", 28.613, 77.209],
  ["Bengaluru", "IN", "Asia/Kolkata", "INR", 12.972, 77.594],
  ["Chennai", "IN", "Asia/Kolkata", "INR", 13.083, 80.27],
  ["Kolkata", "IN", "Asia/Kolkata", "INR", 22.573, 88.364],
  ["Goa", "IN", "Asia/Kolkata", "INR", 15.299, 74.124],
  ["Dubai", "AE", "Asia/Dubai", "AED", 25.205, 55.271],
  ["Singapore", "SG", "Asia/Singapore", "SGD", 1.352, 103.82],
  ["Bangkok", "TH", "Asia/Bangkok", "THB", 13.756, 100.502],
  ["Tokyo", "JP", "Asia/Tokyo", "JPY", 35.676, 139.65],
  ["London", "GB", "Europe/London", "GBP", 51.507, -0.128],
  ["Paris", "FR", "Europe/Paris", "EUR", 48.857, 2.352],
  ["Zurich", "CH", "Europe/Zurich", "CHF", 47.377, 8.542],
  ["Rome", "IT", "Europe/Rome", "EUR", 41.903, 12.496],
  ["New York", "US", "America/New_York", "USD", 40.713, -74.006],
  ["San Francisco", "US", "America/Los_Angeles", "USD", 37.775, -122.419],
  ["Toronto", "CA", "America/Toronto", "CAD", 43.653, -79.383],
  ["Sydney", "AU", "Australia/Sydney", "AUD", -33.869, 151.209],
  ["Cape Town", "ZA", "Africa/Johannesburg", "ZAR", -33.925, 18.424],
  ["Reykjavik", "IS", "Atlantic/Reykjavik", "ISK", 64.147, -21.94],
] as const;

const CARRIERS = ["ET", "AI", "SQ", "EK", "BA", "LH", "QF", "UA", "AF", "JL"];
const AIRCRAFT = ["A320neo", "A321", "A350-900", "B737-800", "B777-300ER", "B787-9"];
const CABINS = ["economy", "premium_economy", "business", "first"];
const AMENITIES = [
  "wifi",
  "pool",
  "spa",
  "gym",
  "breakfast",
  "parking",
  "airport_shuttle",
  "restaurant",
  "bar",
  "pet_friendly",
  "workspace",
  "laundry",
];
const PLACE_CATEGORIES = [
  "landmark",
  "museum",
  "beach",
  "park",
  "market",
  "viewpoint",
  "restaurant",
  "temple",
];
const CONDITIONS = [
  "clear",
  "partly_cloudy",
  "cloudy",
  "light_rain",
  "rain",
  "thunderstorm",
  "fog",
  "haze",
];

/** Deterministic linear congruential generator. */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}
function round(n: number, d = 3): number {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

export interface MockCity {
  readonly name: string;
  readonly country: string;
  readonly timezone: string;
  readonly currency: string;
  readonly lat: number;
  readonly lon: number;
}
export interface MockAirport {
  readonly code: string;
  readonly name: string;
  readonly city: string;
  readonly country: string;
  readonly lat: number;
  readonly lon: number;
  readonly tz: string;
  readonly terminals: number;
}
export interface MockFlight {
  readonly number: string;
  readonly carrier: string;
  readonly from: string;
  readonly to: string;
  readonly dep: number;
  readonly arr: number;
  readonly stops: number;
  readonly aircraft: string;
  readonly seats: number;
  readonly baseFare: number;
  readonly currency: string;
  readonly wifi: boolean;
}
export interface MockRoom {
  readonly id: string;
  readonly hotel: string;
  readonly name: string;
  readonly capacity: number;
  readonly bed: string;
  readonly price: number;
}
export interface MockHotel {
  readonly id: string;
  readonly name: string;
  readonly city: string;
  readonly country: string;
  readonly stars: number;
  readonly rating: number;
  readonly lat: number;
  readonly lon: number;
  readonly amenities: readonly string[];
  readonly nightly: number;
  readonly currency: string;
  readonly rooms: readonly MockRoom[];
}
export interface MockPlace {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly city: string;
  readonly country: string;
  readonly lat: number;
  readonly lon: number;
  readonly tz: string;
  readonly rating: number;
}
export interface MockDataset {
  readonly cities: readonly MockCity[];
  readonly airports: readonly MockAirport[];
  readonly flights: readonly MockFlight[];
  readonly hotels: readonly MockHotel[];
  readonly places: readonly MockPlace[];
  readonly rates: Readonly<Record<string, number>>;
}

const AIRPORT_COUNT = 400;
const FLIGHT_COUNT = 1200;
const HOTEL_COUNT = 800;
const PLACE_COUNT = 600;

let cached: MockDataset | undefined;

function buildDataset(): MockDataset {
  const rng = lcg(20260729);
  const cities: MockCity[] = CITIES.map(([name, country, timezone, currency, lat, lon]) =>
    Object.freeze({ name, country, timezone, currency, lat, lon }),
  );

  const airports: MockAirport[] = [];
  for (let i = 0; i < AIRPORT_COUNT; i += 1) {
    const city = cities[i % cities.length];
    const code = `${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + (((i / 26) | 0) % 26))}${String.fromCharCode(65 + (((i / 7) | 0) % 26))}`;
    airports.push(
      Object.freeze({
        code: `${code}${i < 26 ? "" : ""}`,
        name: `${city.name} ${i % 3 === 0 ? "International" : "Regional"} Airport ${i + 1}`,
        city: city.name,
        country: city.country,
        lat: round(city.lat + (rng() - 0.5) * 0.6),
        lon: round(city.lon + (rng() - 0.5) * 0.6),
        tz: city.timezone,
        terminals: 1 + Math.floor(rng() * 4),
      }),
    );
  }
  // Ensure unique codes deterministically.
  const seen = new Set<string>();
  const uniqueAirports = airports.map((a, i) => {
    let code = a.code;
    while (seen.has(code)) code = `${a.code[0]}${a.code[1]}${String.fromCharCode(65 + (i % 26))}`;
    if (seen.has(code)) code = `X${i.toString(36).toUpperCase().padStart(2, "0")}`.slice(0, 3);
    seen.add(code);
    return Object.freeze({ ...a, code });
  });

  const flights: MockFlight[] = [];
  for (let i = 0; i < FLIGHT_COUNT; i += 1) {
    const from = uniqueAirports[Math.floor(rng() * uniqueAirports.length)];
    let to = uniqueAirports[Math.floor(rng() * uniqueAirports.length)];
    if (to.code === from.code)
      to = uniqueAirports[(uniqueAirports.indexOf(from) + 7) % uniqueAirports.length];
    const dep = Math.floor(rng() * 1380);
    const dur = 55 + Math.floor(rng() * 600);
    const carrier = pick(rng, CARRIERS);
    flights.push(
      Object.freeze({
        number: `${carrier}${(100 + i).toString().padStart(4, "0")}`,
        carrier,
        from: from.code,
        to: to.code,
        dep,
        arr: (dep + dur) % 1440,
        stops: rng() > 0.75 ? 1 : 0,
        aircraft: pick(rng, AIRCRAFT),
        seats: 120 + Math.floor(rng() * 220),
        baseFare: 2400 + Math.floor(rng() * 42000),
        currency: "INR",
        wifi: rng() > 0.4,
      }),
    );
  }

  const hotels: MockHotel[] = [];
  for (let i = 0; i < HOTEL_COUNT; i += 1) {
    const city = cities[i % cities.length];
    const id = `htl_${(i + 1).toString().padStart(4, "0")}`;
    const nightly = 1800 + Math.floor(rng() * 38000);
    const amenityCount = 3 + Math.floor(rng() * 6);
    const amenities: string[] = [];
    for (let a = 0; a < amenityCount; a += 1) {
      const am = AMENITIES[(i + a * 3) % AMENITIES.length];
      if (!amenities.includes(am)) amenities.push(am);
    }
    const rooms: MockRoom[] = [];
    const roomCount = 2 + Math.floor(rng() * 4);
    for (let r = 0; r < roomCount; r += 1) {
      rooms.push(
        Object.freeze({
          id: `${id}_room_${r + 1}`,
          hotel: id,
          name: ["Standard", "Deluxe", "Suite", "Family", "Penthouse"][r % 5],
          capacity: 2 + (r % 3),
          bed: ["queen", "king", "twin", "bunk"][r % 4],
          price: Math.round(nightly * (1 + r * 0.35)),
        }),
      );
    }
    hotels.push(
      Object.freeze({
        id,
        name: `${city.name} ${["Grand", "Riverside", "Boulevard", "Heritage", "Skyline"][i % 5]} Hotel`,
        city: city.name,
        country: city.country,
        stars: 2 + Math.floor(rng() * 4),
        rating: round(6 + rng() * 4, 1),
        lat: round(city.lat + (rng() - 0.5) * 0.3),
        lon: round(city.lon + (rng() - 0.5) * 0.3),
        amenities: Object.freeze(amenities),
        nightly,
        currency: city.currency,
        rooms: Object.freeze(rooms),
      }),
    );
  }

  const places: MockPlace[] = [];
  for (let i = 0; i < PLACE_COUNT; i += 1) {
    const city = cities[i % cities.length];
    const category = PLACE_CATEGORIES[i % PLACE_CATEGORIES.length];
    places.push(
      Object.freeze({
        id: `plc_${(i + 1).toString().padStart(4, "0")}`,
        name: `${city.name} ${category.replace("_", " ")} ${Math.floor(i / cities.length) + 1}`,
        category,
        city: city.name,
        country: city.country,
        lat: round(city.lat + (rng() - 0.5) * 0.4),
        lon: round(city.lon + (rng() - 0.5) * 0.4),
        tz: city.timezone,
        rating: round(5 + rng() * 5, 1),
      }),
    );
  }

  const rateBase: Record<string, number> = {
    INR: 1,
    USD: 83.2,
    EUR: 90.4,
    GBP: 105.6,
    AED: 22.6,
    SGD: 61.8,
    THB: 2.3,
    JPY: 0.55,
    CHF: 94.1,
    CAD: 61.2,
    AUD: 55.3,
    ZAR: 4.5,
    ISK: 0.6,
  };

  return Object.freeze({
    cities: Object.freeze(cities),
    airports: Object.freeze(uniqueAirports),
    flights: Object.freeze(flights),
    hotels: Object.freeze(hotels),
    places: Object.freeze(places),
    rates: Object.freeze(rateBase),
  });
}

export function mockTravelDataset(): MockDataset {
  if (!cached) cached = buildDataset();
  return cached;
}

/** Deterministic hash of any string → [0,1). */
export function seededUnit(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

export function seededCondition(key: string): string {
  return CONDITIONS[Math.floor(seededUnit(key) * CONDITIONS.length) % CONDITIONS.length];
}

export function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(s))) * 100) / 100;
}

export const MOCK_AIRPORT_COUNT = AIRPORT_COUNT;
export const MOCK_FLIGHT_COUNT = FLIGHT_COUNT;
export const MOCK_HOTEL_COUNT = HOTEL_COUNT;
export const MOCK_PLACE_COUNT = PLACE_COUNT;
export const MOCK_CABINS = Object.freeze(CABINS);
export const MOCK_CONDITIONS = Object.freeze(CONDITIONS);
