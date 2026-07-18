/** Spatial Intelligence Engine — deterministic ID helpers. */
let counter = 0;
function next(): string {
  counter = (counter + 1) >>> 0;
  return `${Date.now().toString(36)}${counter.toString(36).padStart(4, "0")}`;
}
export const newPlaceId = (): string => `place_${next()}`;
export const newRegionId = (): string => `region_${next()}`;
export const newCorridorId = (): string => `corridor_${next()}`;
export const newClusterId = (): string => `cluster_${next()}`;
export const newConstraintId = (): string => `sconstraint_${next()}`;
export const newRelationshipId = (): string => `srel_${next()}`;
export const newEventId = (): string => `sevt_${next()}`;
export const newFenceId = (): string => `fence_${next()}`;
export const newCorrelationId = (): string => `scorr_${next()}`;
