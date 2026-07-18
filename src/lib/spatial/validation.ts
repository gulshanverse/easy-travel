/** Spatial Intelligence Engine — validation helpers. */
import { SpatialValidationError } from "./errors";
import type { BoundingBox, Coordinate } from "./types";

export function validateCoordinate(c: Coordinate): void {
  if (!Number.isFinite(c.lat) || c.lat < -90 || c.lat > 90) {
    throw new SpatialValidationError(`invalid latitude: ${c.lat}`);
  }
  if (!Number.isFinite(c.lng) || c.lng < -180 || c.lng > 180) {
    throw new SpatialValidationError(`invalid longitude: ${c.lng}`);
  }
  if (c.alt !== undefined && !Number.isFinite(c.alt)) {
    throw new SpatialValidationError(`invalid altitude: ${c.alt}`);
  }
}

export function validateBoundingBox(b: BoundingBox): void {
  if (b.south > b.north) throw new SpatialValidationError("bbox south > north");
  if (b.south < -90 || b.north > 90) throw new SpatialValidationError("bbox latitude out of range");
  if (b.west < -180 || b.east > 180) throw new SpatialValidationError("bbox longitude out of range");
}

export function normalizeCoordinate(c: Coordinate, precision = 6): Coordinate {
  const p = Math.pow(10, precision);
  const norm: Coordinate = {
    lat: Math.round(c.lat * p) / p,
    lng: Math.round(((c.lng + 540) % 360 - 180) * p) / p,
    ...(c.alt !== undefined ? { alt: c.alt } : {}),
    ...(c.precision !== undefined ? { precision: c.precision } : { precision }),
  };
  return Object.freeze(norm);
}

export function coordinatesEqual(a: Coordinate, b: Coordinate, eps = 1e-6): boolean {
  return Math.abs(a.lat - b.lat) < eps && Math.abs(a.lng - b.lng) < eps;
}

export function isInsideBBox(c: Coordinate, b: BoundingBox): boolean {
  return c.lat >= b.south && c.lat <= b.north && c.lng >= b.west && c.lng <= b.east;
}
