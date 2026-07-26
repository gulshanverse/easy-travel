/** RICS — deterministic mock railway dataset.
 *  Pure computation: no network, no randomness, no I/O.
 *  1200 stations, 600 trains, schedules, routes, availability, PNRs.
 */

const STATION_COUNT = 1200;
const TRAIN_COUNT = 600;

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const PREFIX = ["Nor", "Sur", "Vel", "Kan", "Mar", "Dev", "Ala", "Bhi", "Cha", "Rai", "Tir", "Jal"];
const SUFFIX = ["pur", "garh", "bad", "nagar", "kote", "halli", "ganj", "ola", "vali", "port", "field", "ton"];
const REGIONS = ["North", "South", "East", "West", "Central", "North East", "North West", "South East"];
const ZONES = ["NR", "SR", "ER", "WR", "CR", "NER", "NWR", "SER"];
const CATEGORIES = ["junction", "terminal", "halt", "central", "suburban"];
const TRAIN_CATEGORIES = ["express", "superfast", "intercity", "passenger", "high-speed", "overnight"];
const CLASSES = ["2S", "SL", "3A", "2A", "1A", "CC", "EC"];
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const AMENITIES = ["waiting-room", "wifi", "food-court", "restroom", "parking", "lounge", "atm", "cloakroom"];
const ACCESSIBILITY = ["ramp", "tactile-path", "lift", "wheelchair", "audio-announcement"];
const DELAY_REASONS = [
  "signal-hold", "track-maintenance", "weather", "crossing-priority",
  "rake-availability", "late-inbound-service", "operational",
];

export interface MockStation {
  readonly code: string;
  readonly name: string;
  readonly city: string;
  readonly region: string;
  readonly zone: string;
  readonly lat: number;
  readonly lon: number;
  readonly platforms: number;
  readonly categories: readonly string[];
  readonly elevation: number;
  readonly amenities: readonly string[];
  readonly accessibility: readonly string[];
  readonly footfall: number;
  readonly openedYear: number;
}

export interface MockStop {
  readonly seq: number;
  readonly stationCode: string;
  readonly arrivalMinutes: number | null;
  readonly departureMinutes: number | null;
  readonly haltMinutes: number;
  readonly distanceKm: number;
  readonly platform: string;
}

export interface MockTrain {
  readonly number: string;
  readonly name: string;
  readonly category: string;
  readonly classes: readonly string[];
  readonly runsOn: readonly string[];
  readonly coaches: number;
  readonly pantry: boolean;
  readonly rake: string;
  readonly introducedYear: number;
  readonly punctuality: number;
  readonly stops: readonly MockStop[];
}

export interface MockDataset {
  readonly stations: readonly MockStation[];
  readonly stationByCode: ReadonlyMap<string, MockStation>;
  readonly trains: readonly MockTrain[];
  readonly trainByNumber: ReadonlyMap<string, MockTrain>;
  readonly trainsByStation: ReadonlyMap<string, readonly string[]>;
}

function stationCode(i: number): string {
  return `S${i.toString(36).toUpperCase().padStart(3, "0")}`;
}

function buildStations(): MockStation[] {
  const rnd = lcg(20250715);
  const out: MockStation[] = [];
  for (let i = 0; i < STATION_COUNT; i += 1) {
    const name = `${PREFIX[i % PREFIX.length]}${SUFFIX[(i * 7) % SUFFIX.length]}`;
    const suffixIdx = i % CATEGORIES.length;
    const cats = [CATEGORIES[suffixIdx]];
    if (i % 11 === 0) cats.push("junction");
    out.push(Object.freeze({
      code: stationCode(i),
      name: `${name} ${i % 5 === 0 ? "Junction" : "Station"}`,
      city: name,
      region: REGIONS[i % REGIONS.length],
      zone: ZONES[i % ZONES.length],
      lat: Number((8 + (i % 260) * 0.1).toFixed(4)),
      lon: Number((68 + Math.floor(i / 26) * 0.08 + (i % 7) * 0.01).toFixed(4)),
      platforms: 1 + (i % 12),
      categories: Object.freeze([...new Set(cats)]),
      elevation: Math.round(rnd() * 1200),
      amenities: Object.freeze(AMENITIES.filter((_, k) => (i + k) % 3 === 0)),
      accessibility: Object.freeze(ACCESSIBILITY.filter((_, k) => (i + k) % 2 === 0)),
      footfall: 1000 + ((i * 977) % 250000),
      openedYear: 1860 + (i % 150),
    }));
  }
  return out;
}

function buildTrains(stations: readonly MockStation[]): MockTrain[] {
  const out: MockTrain[] = [];
  for (let t = 0; t < TRAIN_COUNT; t += 1) {
    const number = String(10000 + t * 3);
    const stopCount = 5 + (t % 10);
    const start = (t * 17) % stations.length;
    const step = 3 + (t % 9);
    const stops: MockStop[] = [];
    let distance = 0;
    let clock = 300 + ((t * 13) % 900); // minutes from midnight of day 0
    for (let s = 0; s < stopCount; s += 1) {
      const st = stations[(start + s * step) % stations.length];
      const legKm = s === 0 ? 0 : 40 + ((t + s * 7) % 260);
      distance += legKm;
      const travelMinutes = s === 0 ? 0 : Math.round((legKm / (55 + (t % 45))) * 60);
      clock += travelMinutes;
      const halt = s === 0 || s === stopCount - 1 ? 0 : 2 + ((t + s) % 8);
      stops.push(Object.freeze({
        seq: s + 1,
        stationCode: st.code,
        arrivalMinutes: s === 0 ? null : clock,
        departureMinutes: s === stopCount - 1 ? null : clock + halt,
        haltMinutes: halt,
        distanceKm: distance,
        platform: String(1 + ((t + s) % st.platforms)),
      }));
      clock += halt;
    }
    const classes = CLASSES.filter((_, k) => (t + k) % 3 !== 2);
    out.push(Object.freeze({
      number,
      name: `${stations[start].city} ${TRAIN_CATEGORIES[t % TRAIN_CATEGORIES.length] === "high-speed" ? "Superfast" : "Express"} ${number}`,
      category: TRAIN_CATEGORIES[t % TRAIN_CATEGORIES.length],
      classes: Object.freeze(classes.length > 0 ? classes : ["SL"]),
      runsOn: Object.freeze(DAYS.filter((_, k) => (t + k) % 7 !== 3)),
      coaches: 8 + (t % 16),
      pantry: t % 3 === 0,
      rake: `RK-${(t % 40) + 1}`,
      introducedYear: 1975 + (t % 48),
      punctuality: 55 + (t % 45),
      stops: Object.freeze(stops),
    }));
  }
  return out;
}

let cache: MockDataset | null = null;

export function mockDataset(): MockDataset {
  if (cache) return cache;
  const stations = buildStations();
  const trains = buildTrains(stations);
  const stationByCode = new Map(stations.map((s) => [s.code, s]));
  const trainByNumber = new Map(trains.map((t) => [t.number, t]));
  const trainsByStation = new Map<string, string[]>();
  for (const t of trains) {
    for (const s of t.stops) {
      let list = trainsByStation.get(s.stationCode);
      if (!list) { list = []; trainsByStation.set(s.stationCode, list); }
      list.push(t.number);
    }
  }
  cache = Object.freeze({
    stations: Object.freeze(stations),
    stationByCode,
    trains: Object.freeze(trains),
    trainByNumber,
    trainsByStation,
  });
  return cache;
}

export function minutesToClock(m: number | null): string | undefined {
  if (m === null) return undefined;
  const day = Math.floor(m / 1440);
  const rest = m - day * 1440;
  const hh = String(Math.floor(rest / 60)).padStart(2, "0");
  const mm = String(rest % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function dayOffset(m: number | null): number {
  if (m === null) return 0;
  return Math.floor(m / 1440);
}

/** Stable hash used to derive live/volatile mock values. */
export function stableHash(...parts: (string | number)[]): number {
  let h = 2166136261;
  for (const p of parts) {
    const s = String(p);
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
  }
  return (h >>> 0);
}

export const MOCK_DELAY_REASONS = Object.freeze(DELAY_REASONS);
export const MOCK_CLASSES = Object.freeze(CLASSES);
export const MOCK_STATION_COUNT = STATION_COUNT;
export const MOCK_TRAIN_COUNT = TRAIN_COUNT;
