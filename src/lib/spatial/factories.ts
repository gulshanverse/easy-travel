/** Spatial Intelligence Engine — immutable factories. */
import {
  newClusterId, newConstraintId, newCorridorId, newFenceId, newPlaceId,
  newRegionId, newRelationshipId,
} from "./ids";
import type {
  BoundingBox, ConstraintKind, Coordinate, CorridorKind, GeoFence, GeoPoint,
  LifecycleState, LocationMetadata, Place, PlaceKind, Region, RegionKind,
  RelationshipKind, SpatialCluster, SpatialConfidence, SpatialConstraint,
  SpatialEvidence, SpatialRelationship, TravelCorridor,
} from "./types";
import { normalizeCoordinate, validateBoundingBox, validateCoordinate } from "./validation";

const EMPTY_META: LocationMetadata = Object.freeze({
  tags: Object.freeze([]) as readonly string[],
  attributes: Object.freeze({}) as Readonly<Record<string, string | number | boolean>>,
});

function confidence(v = 0.6): SpatialConfidence {
  const value = Math.max(0, Math.min(1, v));
  const level: SpatialConfidence["level"] = value >= 0.75 ? "high" : value >= 0.4 ? "medium" : "low";
  return Object.freeze({ value, level });
}

export interface MakePlaceInput {
  readonly name: string;
  readonly coord: Coordinate;
  readonly kind?: PlaceKind;
  readonly regionId?: string;
  readonly countryCode?: string;
  readonly metadata?: Partial<LocationMetadata>;
  readonly evidence?: readonly SpatialEvidence[];
  readonly confidence?: number;
  readonly now?: number;
  readonly state?: LifecycleState;
}

export function makePlace(input: MakePlaceInput): Place {
  validateCoordinate(input.coord);
  const now = input.now ?? Date.now();
  const meta: LocationMetadata = Object.freeze({
    tags: Object.freeze([...(input.metadata?.tags ?? [])]) as readonly string[],
    attributes: Object.freeze({ ...(input.metadata?.attributes ?? {}) }),
  });
  return Object.freeze({
    id: newPlaceId(),
    kind: input.kind ?? "generic",
    name: input.name,
    coord: normalizeCoordinate(input.coord),
    regionId: input.regionId,
    countryCode: input.countryCode,
    metadata: meta,
    confidence: confidence(input.confidence),
    evidence: Object.freeze([...(input.evidence ?? [])]) as readonly SpatialEvidence[],
    version: 1,
    state: input.state ?? "created",
    createdAt: now,
    updatedAt: now,
  });
}

export function makeGeoPoint(coord: Coordinate, label?: string): GeoPoint {
  validateCoordinate(coord);
  return Object.freeze({ coord: normalizeCoordinate(coord), label });
}

export interface MakeRegionInput {
  readonly name: string;
  readonly kind: RegionKind;
  readonly parentId?: string;
  readonly countryCode?: string;
  readonly bbox?: BoundingBox;
  readonly metadata?: Partial<LocationMetadata>;
  readonly now?: number;
  readonly state?: LifecycleState;
}

export function makeRegion(input: MakeRegionInput): Region {
  if (input.bbox) validateBoundingBox(input.bbox);
  const now = input.now ?? Date.now();
  const meta: LocationMetadata = Object.freeze({
    tags: Object.freeze([...(input.metadata?.tags ?? [])]) as readonly string[],
    attributes: Object.freeze({ ...(input.metadata?.attributes ?? {}) }),
  });
  return Object.freeze({
    id: newRegionId(),
    kind: input.kind,
    name: input.name,
    parentId: input.parentId,
    countryCode: input.countryCode,
    bbox: input.bbox ? Object.freeze({ ...input.bbox }) : undefined,
    metadata: meta,
    version: 1,
    state: input.state ?? "created",
    createdAt: now,
    updatedAt: now,
  });
}

export function makeCountry(name: string, countryCode: string, bbox?: BoundingBox): Region {
  return makeRegion({ name, kind: "country", countryCode, bbox });
}
export function makeState(name: string, parentId: string, bbox?: BoundingBox): Region {
  return makeRegion({ name, kind: "state", parentId, bbox });
}
export function makeCity(name: string, parentId?: string, bbox?: BoundingBox): Region {
  return makeRegion({ name, kind: "city", parentId, bbox });
}
export function makeDistrict(name: string, parentId: string, bbox?: BoundingBox): Region {
  return makeRegion({ name, kind: "district", parentId, bbox });
}

export function makeAirport(name: string, coord: Coordinate, regionId?: string): Place {
  return makePlace({ name, coord, kind: "airport", regionId });
}
export function makeRailwayStation(name: string, coord: Coordinate, regionId?: string): Place {
  return makePlace({ name, coord, kind: "railway_station", regionId });
}
export function makeBusTerminal(name: string, coord: Coordinate, regionId?: string): Place {
  return makePlace({ name, coord, kind: "bus_terminal", regionId });
}
export function makeLandmark(name: string, coord: Coordinate, regionId?: string): Place {
  return makePlace({ name, coord, kind: "landmark", regionId });
}
export function makeTravelHub(name: string, coord: Coordinate, regionId?: string): Place {
  return makePlace({ name, coord, kind: "travel_hub", regionId });
}

export function makeFence(name: string, bbox: BoundingBox, kind: "inclusive" | "exclusive" = "inclusive"): GeoFence {
  validateBoundingBox(bbox);
  return Object.freeze({
    id: newFenceId(),
    name,
    bbox: Object.freeze({ ...bbox }),
    kind,
    metadata: EMPTY_META,
  });
}

export function makeCluster(members: readonly string[], centroid: Coordinate, radiusMeters: number, density: number, now = Date.now()): SpatialCluster {
  validateCoordinate(centroid);
  return Object.freeze({
    id: newClusterId(),
    members: Object.freeze([...members]) as readonly string[],
    centroid: normalizeCoordinate(centroid),
    radiusMeters,
    density,
    createdAt: now,
  });
}

export function makeCorridor(kind: CorridorKind, nodes: readonly string[], gateway?: string, now = Date.now()): TravelCorridor {
  return Object.freeze({
    id: newCorridorId(),
    kind,
    nodes: Object.freeze([...nodes]) as readonly string[],
    gateway,
    metadata: EMPTY_META,
    createdAt: now,
  });
}

export function makeRelationship(kind: RelationshipKind, a: string, b: string, distanceMeters?: number, now = Date.now()): SpatialRelationship {
  return Object.freeze({
    id: newRelationshipId(),
    kind,
    a,
    b,
    distance: distanceMeters !== undefined ? Object.freeze({ value: distanceMeters, unit: "m" as const }) : undefined,
    detectedAt: now,
  });
}

export interface MakeConstraintInput {
  readonly kind: ConstraintKind;
  readonly params?: Readonly<Record<string, string | number>>;
  readonly regionId?: string;
  readonly placeId?: string;
  readonly fenceId?: string;
  readonly now?: number;
}
export function makeConstraint(input: MakeConstraintInput): SpatialConstraint {
  return Object.freeze({
    id: newConstraintId(),
    kind: input.kind,
    params: Object.freeze({ ...(input.params ?? {}) }),
    regionId: input.regionId,
    placeId: input.placeId,
    fenceId: input.fenceId,
    createdAt: input.now ?? Date.now(),
  });
}
