/** Spatial Intelligence Engine — configuration. */
export interface SpatialConfig {
  readonly earthRadiusMeters: number;
  readonly defaultUnit: "m" | "km";
  readonly nearbyRadiusMeters: number;
  readonly adjacencyRadiusMeters: number;
  readonly maxPlaces: number;
  readonly maxRegions: number;
  readonly clusterRadiusMeters: number;
  readonly clusterMinMembers: number;
  readonly indexBucketSizeDegrees: number;
  readonly coordinatePrecision: number;
}

export const DEFAULT_SPATIAL_CONFIG: SpatialConfig = Object.freeze({
  earthRadiusMeters: 6_371_008.8,
  defaultUnit: "km",
  nearbyRadiusMeters: 5_000,
  adjacencyRadiusMeters: 25_000,
  maxPlaces: 50_000,
  maxRegions: 5_000,
  clusterRadiusMeters: 10_000,
  clusterMinMembers: 2,
  indexBucketSizeDegrees: 1,
  coordinatePrecision: 6,
});

export function mergeSpatialConfig(patch: Partial<SpatialConfig> = {}): SpatialConfig {
  return Object.freeze({ ...DEFAULT_SPATIAL_CONFIG, ...patch });
}

export function defineSpatialConfig(patch: Partial<SpatialConfig> = {}): SpatialConfig {
  return mergeSpatialConfig(patch);
}
