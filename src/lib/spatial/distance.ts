/**
 * Spatial Intelligence Engine — deterministic distance calculations.
 * Great-circle (Haversine) by default. Euclidean and equirectangular
 * available for near-plane use. All functions pure.
 */
import { DEFAULT_SPATIAL_CONFIG } from "./config";
import type { Coordinate, Distance, DistanceUnit } from "./types";
import { validateCoordinate } from "./validation";

const toRad = (d: number): number => (d * Math.PI) / 180;

export function haversineMeters(a: Coordinate, b: Coordinate, R = DEFAULT_SPATIAL_CONFIG.earthRadiusMeters): number {
  validateCoordinate(a); validateCoordinate(b);
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s1 = Math.sin(dLat / 2), s2 = Math.sin(dLng / 2);
  const h = s1 * s1 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * s2 * s2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const greatCircleMeters = haversineMeters;

export function equirectangularMeters(a: Coordinate, b: Coordinate, R = DEFAULT_SPATIAL_CONFIG.earthRadiusMeters): number {
  validateCoordinate(a); validateCoordinate(b);
  const x = toRad(b.lng - a.lng) * Math.cos(toRad((a.lat + b.lat) / 2));
  const y = toRad(b.lat - a.lat);
  return Math.sqrt(x * x + y * y) * R;
}

export function euclideanDegrees(a: Coordinate, b: Coordinate): number {
  const dx = b.lng - a.lng, dy = b.lat - a.lat;
  return Math.sqrt(dx * dx + dy * dy);
}

export function toDistance(meters: number, unit: DistanceUnit = "km"): Distance {
  return Object.freeze({ value: unit === "km" ? meters / 1000 : meters, unit });
}

export function toMeters(d: Distance): number {
  return d.unit === "km" ? d.value * 1000 : d.value;
}

export function distanceMatrix(a: readonly Coordinate[], b: readonly Coordinate[]): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < a.length; i++) {
    const row: number[] = [];
    for (let j = 0; j < b.length; j++) row.push(haversineMeters(a[i], b[j]));
    out.push(row);
  }
  return out;
}

export function withinRadius(center: Coordinate, target: Coordinate, radiusMeters: number): boolean {
  return haversineMeters(center, target) <= radiusMeters;
}

export function nearestIndex(from: Coordinate, targets: readonly Coordinate[]): number {
  let best = -1, bestD = Infinity;
  for (let i = 0; i < targets.length; i++) {
    const d = haversineMeters(from, targets[i]);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}
