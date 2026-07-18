/** Spatial Intelligence Engine — coordinate utilities (deterministic). */
import type { BoundingBox, Coordinate } from "./types";
import { isInsideBBox, normalizeCoordinate, validateCoordinate } from "./validation";

export function makeCoordinate(lat: number, lng: number, alt?: number, precision?: number): Coordinate {
  const c: Coordinate = { lat, lng, ...(alt !== undefined ? { alt } : {}), ...(precision !== undefined ? { precision } : {}) };
  validateCoordinate(c);
  return normalizeCoordinate(c, precision ?? 6);
}

export function containsCoordinate(bbox: BoundingBox, c: Coordinate): boolean {
  return isInsideBBox(c, bbox);
}

export function bboxFromCoords(coords: readonly Coordinate[]): BoundingBox {
  if (!coords.length) return Object.freeze({ south: 0, west: 0, north: 0, east: 0 });
  let s = coords[0].lat, n = s, w = coords[0].lng, e = w;
  for (const c of coords) {
    if (c.lat < s) s = c.lat;
    if (c.lat > n) n = c.lat;
    if (c.lng < w) w = c.lng;
    if (c.lng > e) e = c.lng;
  }
  return Object.freeze({ south: s, west: w, north: n, east: e });
}

export function expandBBox(bbox: BoundingBox, marginDeg: number): BoundingBox {
  return Object.freeze({
    south: Math.max(-90, bbox.south - marginDeg),
    north: Math.min(90, bbox.north + marginDeg),
    west: Math.max(-180, bbox.west - marginDeg),
    east: Math.min(180, bbox.east + marginDeg),
  });
}

export function centerOf(bbox: BoundingBox): Coordinate {
  return normalizeCoordinate({ lat: (bbox.south + bbox.north) / 2, lng: (bbox.west + bbox.east) / 2 });
}
