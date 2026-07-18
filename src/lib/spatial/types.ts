/**
 * Spatial Intelligence Engine — immutable domain types.
 * All entities are frozen at construction time; use factories in
 * factories.ts to build them. No runtime dependencies on other engines.
 */
export type PlaceKind =
  | "generic"
  | "city"
  | "district"
  | "landmark"
  | "airport"
  | "railway_station"
  | "bus_terminal"
  | "travel_hub"
  | "attraction"
  | "hotel_slot";

export type RegionKind = "country" | "state" | "region" | "city" | "district" | "zone";

export type LifecycleState =
  | "created"
  | "validated"
  | "enriched"
  | "clustered"
  | "connected"
  | "ready"
  | "archived"
  | "failed";

export type RelationshipKind =
  | "nearby"
  | "contains"
  | "inside"
  | "outside"
  | "adjacent"
  | "connected"
  | "overlapping"
  | "same_region"
  | "same_country"
  | "cross_border"
  | "transit"
  | "corridor";

export type CorridorKind = "travel" | "regional" | "multi_city" | "transit" | "hub_and_spoke";
export type ConstraintKind =
  | "max_radius"
  | "min_distance"
  | "restricted_region"
  | "allowed_region"
  | "geo_fence_in"
  | "geo_fence_out"
  | "travel_zone"
  | "cross_border";
export type DistanceUnit = "m" | "km";

export interface Coordinate {
  readonly lat: number;
  readonly lng: number;
  readonly alt?: number;
  readonly precision?: number;
}

export interface GeoPoint {
  readonly coord: Coordinate;
  readonly label?: string;
}

export interface BoundingBox {
  readonly south: number;
  readonly west: number;
  readonly north: number;
  readonly east: number;
}

export interface Distance {
  readonly value: number;
  readonly unit: DistanceUnit;
}

export interface LocationMetadata {
  readonly tags: readonly string[];
  readonly attributes: Readonly<Record<string, string | number | boolean>>;
}

export interface SpatialEvidence {
  readonly source: string;
  readonly confidence: number;   // 0..1
  readonly recordedAt: number;
}

export interface SpatialConfidence {
  readonly value: number;        // 0..1
  readonly level: "low" | "medium" | "high";
}

export interface Place {
  readonly id: string;
  readonly kind: PlaceKind;
  readonly name: string;
  readonly coord: Coordinate;
  readonly regionId?: string;
  readonly countryCode?: string;
  readonly metadata: LocationMetadata;
  readonly confidence: SpatialConfidence;
  readonly evidence: readonly SpatialEvidence[];
  readonly version: number;
  readonly state: LifecycleState;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface Region {
  readonly id: string;
  readonly kind: RegionKind;
  readonly name: string;
  readonly parentId?: string;
  readonly countryCode?: string;
  readonly bbox?: BoundingBox;
  readonly metadata: LocationMetadata;
  readonly version: number;
  readonly state: LifecycleState;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface GeoFence {
  readonly id: string;
  readonly name: string;
  readonly bbox: BoundingBox;
  readonly kind: "inclusive" | "exclusive";
  readonly metadata: LocationMetadata;
}

export interface SpatialCluster {
  readonly id: string;
  readonly members: readonly string[];   // place ids
  readonly centroid: Coordinate;
  readonly radiusMeters: number;
  readonly density: number;
  readonly createdAt: number;
}

export interface TravelCorridor {
  readonly id: string;
  readonly kind: CorridorKind;
  readonly nodes: readonly string[];     // place ids (ordered)
  readonly gateway?: string;             // place id
  readonly metadata: LocationMetadata;
  readonly createdAt: number;
}

export interface RouteNode {
  readonly placeId: string;
  readonly sequence: number;
}

export interface SpatialRelationship {
  readonly id: string;
  readonly kind: RelationshipKind;
  readonly a: string;
  readonly b: string;
  readonly distance?: Distance;
  readonly detectedAt: number;
}

export interface SpatialConstraint {
  readonly id: string;
  readonly kind: ConstraintKind;
  readonly params: Readonly<Record<string, string | number>>;
  readonly regionId?: string;
  readonly placeId?: string;
  readonly fenceId?: string;
  readonly createdAt: number;
}

export interface TravelZone {
  readonly id: string;
  readonly name: string;
  readonly regionIds: readonly string[];
  readonly rules: readonly string[];
}

export interface LocationSnapshot {
  readonly placeId: string;
  readonly coord: Coordinate;
  readonly capturedAt: number;
}

export interface SpatialHistoryEntry {
  readonly entityId: string;
  readonly at: number;
  readonly from: LifecycleState;
  readonly to: LifecycleState;
  readonly note?: string;
}

export interface SpatialSnapshot {
  readonly places: readonly Place[];
  readonly regions: readonly Region[];
  readonly clusters: readonly SpatialCluster[];
  readonly corridors: readonly TravelCorridor[];
  readonly relationships: readonly SpatialRelationship[];
  readonly constraints: readonly SpatialConstraint[];
  readonly fences: readonly GeoFence[];
  readonly capturedAt: number;
}
