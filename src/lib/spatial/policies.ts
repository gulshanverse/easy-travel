/** Spatial Intelligence Engine — policies. */
export interface SpatialPolicies {
  readonly allowDynamicCreation: boolean;
  readonly maxManagers: number;
  readonly enforceRegionParents: boolean;
}
export const DEFAULT_SPATIAL_POLICIES: SpatialPolicies = Object.freeze({
  allowDynamicCreation: true,
  maxManagers: 32,
  enforceRegionParents: true,
});
