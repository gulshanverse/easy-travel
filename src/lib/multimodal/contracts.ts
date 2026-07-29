/** MTIP — provider-independent multi-modal capability contracts.
 *  A contract describes WHAT a capability accepts and returns.
 *  It never names a provider and never encodes transport details.
 */

export const TRAVEL_MODES = Object.freeze([
  "flight", "hotel", "maps", "weather", "transit", "currency", "timezone",
] as const);
export type TravelMode = (typeof TRAVEL_MODES)[number];

export const MULTIMODAL_CAPABILITY_IDS = Object.freeze([
  // flight
  "search_flights", "search_airports", "flight_status", "flight_schedule",
  "flight_metadata", "fare_lookup", "flight_delay_information",
  // hotel
  "search_hotels", "search_rooms", "hotel_availability", "hotel_pricing",
  "hotel_amenities", "hotel_metadata",
  // maps
  "geocode", "reverse_geocode", "distance_matrix", "route", "search_places",
  "travel_time", "coordinates", "region_lookup",
  // weather
  "weather", "forecast_hourly", "forecast_daily", "travel_alerts",
  "rain_probability", "storm_alerts", "visibility", "temperature", "wind", "air_quality",
  // transit
  "local_transport", "transit_modes",
  // currency
  "exchange_rate", "historical_rate", "currency_convert", "travel_budget_currency",
  // timezone
  "timezone_lookup", "local_time", "dst_information", "arrival_time", "departure_time",
] as const);

export type MultiModalCapabilityId = (typeof MULTIMODAL_CAPABILITY_IDS)[number];

export interface MultiModalCapabilityContract {
  readonly id: MultiModalCapabilityId;
  readonly mode: TravelMode;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly inputs: readonly string[];
  readonly required: readonly string[];
  readonly output: string;
  readonly cacheable: boolean;
  readonly volatility: "static" | "slow" | "live";
}

const c = (x: MultiModalCapabilityContract): MultiModalCapabilityContract => Object.freeze({
  ...x,
  inputs: Object.freeze([...x.inputs]),
  required: Object.freeze([...x.required]),
});

export const MULTIMODAL_CONTRACTS: Readonly<Record<MultiModalCapabilityId, MultiModalCapabilityContract>> =
  Object.freeze({
    // ---------------- Flight ----------------
    search_flights: c({
      id: "search_flights", mode: "flight", name: "Flight Search", version: "1.0.0",
      description: "Find flights between two airports on a date.",
      inputs: ["fromCode", "toCode", "date", "limit"], required: ["fromCode", "toCode"],
      output: "NormalizedFlight[]", cacheable: true, volatility: "slow",
    }),
    search_airports: c({
      id: "search_airports", mode: "flight", name: "Airport Search", version: "1.0.0",
      description: "Find airports by free-text query, IATA code or city.",
      inputs: ["query", "limit"], required: ["query"],
      output: "NormalizedAirport[]", cacheable: true, volatility: "static",
    }),
    flight_status: c({
      id: "flight_status", mode: "flight", name: "Flight Status", version: "1.0.0",
      description: "Live operational status of a single flight.",
      inputs: ["flightNumber", "date"], required: ["flightNumber"],
      output: "NormalizedFlightStatus", cacheable: false, volatility: "live",
    }),
    flight_schedule: c({
      id: "flight_schedule", mode: "flight", name: "Flight Schedule", version: "1.0.0",
      description: "Weekly schedule and legs for a flight number.",
      inputs: ["flightNumber"], required: ["flightNumber"],
      output: "NormalizedFlightSchedule", cacheable: true, volatility: "slow",
    }),
    flight_metadata: c({
      id: "flight_metadata", mode: "flight", name: "Flight Metadata", version: "1.0.0",
      description: "Aircraft, carrier and cabin configuration of a flight.",
      inputs: ["flightNumber"], required: ["flightNumber"],
      output: "NormalizedFlightMetadata", cacheable: true, volatility: "static",
    }),
    fare_lookup: c({
      id: "fare_lookup", mode: "flight", name: "Fare Lookup", version: "1.0.0",
      description: "Cabin fares for a flight number.",
      inputs: ["flightNumber", "cabin"], required: ["flightNumber"],
      output: "NormalizedTravelCost[]", cacheable: false, volatility: "live",
    }),
    flight_delay_information: c({
      id: "flight_delay_information", mode: "flight", name: "Delay Information", version: "1.0.0",
      description: "Delay minutes, cause and confidence for a flight.",
      inputs: ["flightNumber", "date"], required: ["flightNumber"],
      output: "NormalizedFlightDelay", cacheable: false, volatility: "live",
    }),

    // ---------------- Hotel ----------------
    search_hotels: c({
      id: "search_hotels", mode: "hotel", name: "Hotel Search", version: "1.0.0",
      description: "Find hotels in a city or near coordinates.",
      inputs: ["city", "lat", "lon", "limit"], required: [],
      output: "NormalizedHotel[]", cacheable: true, volatility: "slow",
    }),
    search_rooms: c({
      id: "search_rooms", mode: "hotel", name: "Room Search", version: "1.0.0",
      description: "Rooms offered by a hotel.",
      inputs: ["hotelId", "guests"], required: ["hotelId"],
      output: "NormalizedRoom[]", cacheable: true, volatility: "slow",
    }),
    hotel_availability: c({
      id: "hotel_availability", mode: "hotel", name: "Hotel Availability", version: "1.0.0",
      description: "Room availability for a stay window.",
      inputs: ["hotelId", "checkIn", "checkOut"], required: ["hotelId"],
      output: "NormalizedHotelAvailability", cacheable: false, volatility: "live",
    }),
    hotel_pricing: c({
      id: "hotel_pricing", mode: "hotel", name: "Hotel Pricing", version: "1.0.0",
      description: "Nightly and total price for a hotel stay.",
      inputs: ["hotelId", "nights", "roomId"], required: ["hotelId"],
      output: "NormalizedTravelCost", cacheable: false, volatility: "live",
    }),
    hotel_amenities: c({
      id: "hotel_amenities", mode: "hotel", name: "Hotel Amenities", version: "1.0.0",
      description: "Amenity list for a hotel.",
      inputs: ["hotelId"], required: ["hotelId"],
      output: "string[]", cacheable: true, volatility: "static",
    }),
    hotel_metadata: c({
      id: "hotel_metadata", mode: "hotel", name: "Hotel Metadata", version: "1.0.0",
      description: "Full metadata for a single hotel.",
      inputs: ["hotelId"], required: ["hotelId"],
      output: "NormalizedHotel", cacheable: true, volatility: "static",
    }),

    // ---------------- Maps ----------------
    geocode: c({
      id: "geocode", mode: "maps", name: "Geocoding", version: "1.0.0",
      description: "Resolve a free-text place name to coordinates.",
      inputs: ["query"], required: ["query"],
      output: "NormalizedLocation", cacheable: true, volatility: "static",
    }),
    reverse_geocode: c({
      id: "reverse_geocode", mode: "maps", name: "Reverse Geocoding", version: "1.0.0",
      description: "Resolve coordinates to the nearest known location.",
      inputs: ["lat", "lon"], required: ["lat", "lon"],
      output: "NormalizedLocation", cacheable: true, volatility: "static",
    }),
    distance_matrix: c({
      id: "distance_matrix", mode: "maps", name: "Distance Matrix", version: "1.0.0",
      description: "Pairwise distances between origins and destinations.",
      inputs: ["origins", "destinations"], required: ["origins", "destinations"],
      output: "NormalizedDistanceMatrix", cacheable: true, volatility: "slow",
    }),
    route: c({
      id: "route", mode: "maps", name: "Route Estimation", version: "1.0.0",
      description: "Estimated route between two locations.",
      inputs: ["from", "to", "mode"], required: ["from", "to"],
      output: "NormalizedMapRoute", cacheable: true, volatility: "slow",
    }),
    search_places: c({
      id: "search_places", mode: "maps", name: "Place Search", version: "1.0.0",
      description: "Find places by query and optional category.",
      inputs: ["query", "category", "limit"], required: ["query"],
      output: "NormalizedPlace[]", cacheable: true, volatility: "static",
    }),
    travel_time: c({
      id: "travel_time", mode: "maps", name: "Travel Time", version: "1.0.0",
      description: "Estimated travel duration between two locations.",
      inputs: ["from", "to", "mode"], required: ["from", "to"],
      output: "NormalizedTravelDuration", cacheable: true, volatility: "slow",
    }),
    coordinates: c({
      id: "coordinates", mode: "maps", name: "Coordinates", version: "1.0.0",
      description: "Canonical coordinates for a known place id.",
      inputs: ["placeId"], required: ["placeId"],
      output: "NormalizedLocation", cacheable: true, volatility: "static",
    }),
    region_lookup: c({
      id: "region_lookup", mode: "maps", name: "Region Lookup", version: "1.0.0",
      description: "Administrative region hierarchy for coordinates or place.",
      inputs: ["lat", "lon", "placeId"], required: [],
      output: "NormalizedRegion", cacheable: true, volatility: "static",
    }),

    // ---------------- Weather ----------------
    weather: c({
      id: "weather", mode: "weather", name: "Current Weather", version: "1.0.0",
      description: "Current conditions at coordinates or a place.",
      inputs: ["lat", "lon", "place"], required: [],
      output: "NormalizedWeather", cacheable: false, volatility: "live",
    }),
    forecast_hourly: c({
      id: "forecast_hourly", mode: "weather", name: "Hourly Forecast", version: "1.0.0",
      description: "Hour-by-hour forecast for the next N hours.",
      inputs: ["lat", "lon", "place", "hours"], required: [],
      output: "NormalizedForecast", cacheable: false, volatility: "live",
    }),
    forecast_daily: c({
      id: "forecast_daily", mode: "weather", name: "Daily Forecast", version: "1.0.0",
      description: "Day-by-day forecast for the next N days.",
      inputs: ["lat", "lon", "place", "days"], required: [],
      output: "NormalizedForecast", cacheable: false, volatility: "live",
    }),
    travel_alerts: c({
      id: "travel_alerts", mode: "weather", name: "Travel Alerts", version: "1.0.0",
      description: "Weather-driven travel advisories.",
      inputs: ["lat", "lon", "place"], required: [],
      output: "NormalizedWeatherAlert[]", cacheable: false, volatility: "live",
    }),
    rain_probability: c({
      id: "rain_probability", mode: "weather", name: "Rain Probability", version: "1.0.0",
      description: "Probability of precipitation.",
      inputs: ["lat", "lon", "place"], required: [],
      output: "NormalizedWeatherMeasure", cacheable: false, volatility: "live",
    }),
    storm_alerts: c({
      id: "storm_alerts", mode: "weather", name: "Storm Alerts", version: "1.0.0",
      description: "Active storm advisories.",
      inputs: ["lat", "lon", "place"], required: [],
      output: "NormalizedWeatherAlert[]", cacheable: false, volatility: "live",
    }),
    visibility: c({
      id: "visibility", mode: "weather", name: "Visibility", version: "1.0.0",
      description: "Visibility in metres.",
      inputs: ["lat", "lon", "place"], required: [],
      output: "NormalizedWeatherMeasure", cacheable: false, volatility: "live",
    }),
    temperature: c({
      id: "temperature", mode: "weather", name: "Temperature", version: "1.0.0",
      description: "Temperature in celsius.",
      inputs: ["lat", "lon", "place"], required: [],
      output: "NormalizedWeatherMeasure", cacheable: false, volatility: "live",
    }),
    wind: c({
      id: "wind", mode: "weather", name: "Wind", version: "1.0.0",
      description: "Wind speed and bearing.",
      inputs: ["lat", "lon", "place"], required: [],
      output: "NormalizedWeatherMeasure", cacheable: false, volatility: "live",
    }),
    air_quality: c({
      id: "air_quality", mode: "weather", name: "Air Quality", version: "1.0.0",
      description: "Air quality index and band.",
      inputs: ["lat", "lon", "place"], required: [],
      output: "NormalizedWeatherMeasure", cacheable: false, volatility: "live",
    }),

    // ---------------- Transit ----------------
    local_transport: c({
      id: "local_transport", mode: "transit", name: "Local Transport", version: "1.0.0",
      description: "Local transport options between two points for one or more transit modes.",
      inputs: ["from", "to", "modes", "limit"], required: ["from", "to"],
      output: "NormalizedTransit[]", cacheable: true, volatility: "slow",
    }),
    transit_modes: c({
      id: "transit_modes", mode: "transit", name: "Transit Modes", version: "1.0.0",
      description: "Transit modes available in a city.",
      inputs: ["city"], required: ["city"],
      output: "string[]", cacheable: true, volatility: "static",
    }),

    // ---------------- Currency ----------------
    exchange_rate: c({
      id: "exchange_rate", mode: "currency", name: "Exchange Rate", version: "1.0.0",
      description: "Current rate between two currencies.",
      inputs: ["from", "to"], required: ["from", "to"],
      output: "NormalizedExchangeRate", cacheable: false, volatility: "live",
    }),
    historical_rate: c({
      id: "historical_rate", mode: "currency", name: "Historical Rate", version: "1.0.0",
      description: "Rate between two currencies on a past day offset.",
      inputs: ["from", "to", "daysAgo"], required: ["from", "to"],
      output: "NormalizedExchangeRate", cacheable: true, volatility: "static",
    }),
    currency_convert: c({
      id: "currency_convert", mode: "currency", name: "Currency Conversion", version: "1.0.0",
      description: "Convert an amount between two currencies.",
      inputs: ["from", "to", "amount"], required: ["from", "to", "amount"],
      output: "NormalizedCurrencyConversion", cacheable: false, volatility: "live",
    }),
    travel_budget_currency: c({
      id: "travel_budget_currency", mode: "currency", name: "Travel Budget Currency", version: "1.0.0",
      description: "Budget expressed in home and destination currency.",
      inputs: ["homeCurrency", "destinationCurrency", "amount"],
      required: ["homeCurrency", "destinationCurrency", "amount"],
      output: "NormalizedTravelBudgetCurrency", cacheable: false, volatility: "live",
    }),

    // ---------------- Timezone ----------------
    timezone_lookup: c({
      id: "timezone_lookup", mode: "timezone", name: "Timezone Lookup", version: "1.0.0",
      description: "Timezone for coordinates or a known place.",
      inputs: ["lat", "lon", "place"], required: [],
      output: "NormalizedTimezone", cacheable: true, volatility: "static",
    }),
    local_time: c({
      id: "local_time", mode: "timezone", name: "Local Time", version: "1.0.0",
      description: "Local wall-clock time at a place for an instant.",
      inputs: ["place", "at"], required: ["place"],
      output: "NormalizedLocalTime", cacheable: false, volatility: "live",
    }),
    dst_information: c({
      id: "dst_information", mode: "timezone", name: "DST Information", version: "1.0.0",
      description: "Daylight-saving state of a timezone.",
      inputs: ["place"], required: ["place"],
      output: "NormalizedTimezone", cacheable: true, volatility: "slow",
    }),
    arrival_time: c({
      id: "arrival_time", mode: "timezone", name: "Arrival Time", version: "1.0.0",
      description: "Arrival instant expressed in destination local time.",
      inputs: ["place", "at"], required: ["place", "at"],
      output: "NormalizedLocalTime", cacheable: false, volatility: "slow",
    }),
    departure_time: c({
      id: "departure_time", mode: "timezone", name: "Departure Time", version: "1.0.0",
      description: "Departure instant expressed in origin local time.",
      inputs: ["place", "at"], required: ["place", "at"],
      output: "NormalizedLocalTime", cacheable: false, volatility: "slow",
    }),
  });

export const MULTIMODAL_CONTRACT_LIST: readonly MultiModalCapabilityContract[] =
  Object.freeze(MULTIMODAL_CAPABILITY_IDS.map((id) => MULTIMODAL_CONTRACTS[id]));

export function requireContract(id: MultiModalCapabilityId): MultiModalCapabilityContract {
  const contract = MULTIMODAL_CONTRACTS[id];
  if (!contract) throw new Error(`unknown multimodal capability: ${id}`);
  return contract;
}

export function capabilitiesForMode(mode: TravelMode): readonly MultiModalCapabilityId[] {
  return MULTIMODAL_CAPABILITY_IDS.filter((id) => MULTIMODAL_CONTRACTS[id].mode === mode);
}
