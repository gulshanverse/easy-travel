/**
 * Maps interfaces (provider-agnostic). Isomorphic.
 * Implementations (Google/Mapbox/OSM) plug in later behind these contracts.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface GeocodeResult {
  formattedAddress: string;
  latLng: LatLng;
  placeId?: string;
  components?: Record<string, string>;
}

export interface RouteResult {
  distanceMeters: number;
  durationSeconds: number;
  mode: "driving" | "walking" | "transit" | "cycling";
  polyline?: string;
  legs: Array<{ start: LatLng; end: LatLng; instruction?: string; distanceMeters: number; durationSeconds: number }>;
}

export interface NearbyResult {
  placeId: string;
  name: string;
  latLng: LatLng;
  kind: string;
  distanceMeters: number;
}

export interface MapService {
  geocode(query: string): Promise<GeocodeResult[]>;
  reverseGeocode(latLng: LatLng): Promise<GeocodeResult | null>;
}

export interface RouteService {
  route(from: LatLng, to: LatLng, mode?: RouteResult["mode"]): Promise<RouteResult>;
  optimize(waypoints: LatLng[]): Promise<{ order: number[]; route: RouteResult }>;
}

export interface DistanceService {
  matrix(origins: LatLng[], destinations: LatLng[], mode?: RouteResult["mode"]): Promise<number[][]>;
}

export interface NearbySearchService {
  nearby(center: LatLng, kind: string, radiusMeters?: number): Promise<NearbyResult[]>;
}

/**
 * Default no-op implementation. Prevents runtime crashes when providers
 * aren't configured yet; each method throws a clear "not configured" error.
 */
class NotConfigured implements MapService, RouteService, DistanceService, NearbySearchService {
  private err(m: string): never {
    throw new Error(`Maps provider not configured: ${m}`);
  }
  geocode() { return this.err("geocode"); }
  reverseGeocode() { return this.err("reverseGeocode"); }
  route() { return this.err("route"); }
  optimize() { return this.err("optimize"); }
  matrix() { return this.err("matrix"); }
  nearby() { return this.err("nearby"); }
}

const stub = new NotConfigured();

let _map: MapService = stub;
let _route: RouteService = stub;
let _distance: DistanceService = stub;
let _nearby: NearbySearchService = stub;

export function registerMapProvider(p: {
  map?: MapService;
  route?: RouteService;
  distance?: DistanceService;
  nearby?: NearbySearchService;
}): void {
  if (p.map) _map = p.map;
  if (p.route) _route = p.route;
  if (p.distance) _distance = p.distance;
  if (p.nearby) _nearby = p.nearby;
}

export const mapService = (): MapService => _map;
export const routeService = (): RouteService => _route;
export const distanceService = (): DistanceService => _distance;
export const nearbySearchService = (): NearbySearchService => _nearby;
