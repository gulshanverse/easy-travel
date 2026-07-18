/** Spatial Intelligence Engine — spatial constraint evaluation. */
import { SpatialConstraintViolation } from "./errors";
import { haversineMeters } from "./distance";
import type { RegionHierarchy } from "./region";
import type {
  Coordinate, GeoFence, Place, SpatialConstraint,
} from "./types";
import { isInsideBBox } from "./validation";

export interface ConstraintContext {
  readonly regions: RegionHierarchy;
  readonly fences: ReadonlyMap<string, GeoFence>;
  readonly origin?: Coordinate;
  readonly places: ReadonlyMap<string, Place>;
}

export interface ConstraintEvaluation {
  readonly constraintId: string;
  readonly ok: boolean;
  readonly reason?: string;
}

export function evaluateConstraint(ctx: ConstraintContext, c: SpatialConstraint, target: Coordinate | Place): ConstraintEvaluation {
  const coord: Coordinate = "coord" in target ? target.coord : target;
  const placeRegionId: string | undefined = "regionId" in target ? target.regionId : undefined;
  switch (c.kind) {
    case "max_radius": {
      const radius = Number(c.params.radiusMeters ?? 0);
      if (!ctx.origin) return { constraintId: c.id, ok: false, reason: "origin required" };
      const d = haversineMeters(ctx.origin, coord);
      return d <= radius
        ? { constraintId: c.id, ok: true }
        : { constraintId: c.id, ok: false, reason: `distance ${d.toFixed(0)}m exceeds ${radius}m` };
    }
    case "min_distance": {
      const min = Number(c.params.minMeters ?? 0);
      if (!ctx.origin) return { constraintId: c.id, ok: false, reason: "origin required" };
      const d = haversineMeters(ctx.origin, coord);
      return d >= min
        ? { constraintId: c.id, ok: true }
        : { constraintId: c.id, ok: false, reason: `distance ${d.toFixed(0)}m below ${min}m` };
    }
    case "restricted_region": {
      if (!c.regionId) return { constraintId: c.id, ok: true };
      const inside = placeRegionId === c.regionId
        || ctx.regions.contains(c.regionId, coord)
        || (placeRegionId ? ctx.regions.isAncestor(c.regionId, placeRegionId) : false);
      return inside
        ? { constraintId: c.id, ok: false, reason: `inside restricted region ${c.regionId}` }
        : { constraintId: c.id, ok: true };
    }
    case "allowed_region": {
      if (!c.regionId) return { constraintId: c.id, ok: true };
      const inside = placeRegionId === c.regionId
        || ctx.regions.contains(c.regionId, coord)
        || (placeRegionId ? ctx.regions.isAncestor(c.regionId, placeRegionId) : false);
      return inside
        ? { constraintId: c.id, ok: true }
        : { constraintId: c.id, ok: false, reason: `outside allowed region ${c.regionId}` };
    }
    case "geo_fence_in": {
      const f = c.fenceId ? ctx.fences.get(c.fenceId) : undefined;
      if (!f) return { constraintId: c.id, ok: false, reason: "fence not found" };
      return isInsideBBox(coord, f.bbox)
        ? { constraintId: c.id, ok: true }
        : { constraintId: c.id, ok: false, reason: "outside required fence" };
    }
    case "geo_fence_out": {
      const f = c.fenceId ? ctx.fences.get(c.fenceId) : undefined;
      if (!f) return { constraintId: c.id, ok: true };
      return isInsideBBox(coord, f.bbox)
        ? { constraintId: c.id, ok: false, reason: "inside forbidden fence" }
        : { constraintId: c.id, ok: true };
    }
    case "travel_zone": {
      return { constraintId: c.id, ok: true };
    }
    case "cross_border": {
      const allow = c.params.allow === 1 || c.params.allow === "true";
      if (allow) return { constraintId: c.id, ok: true };
      const targetCountry = typeof target === "object" && "countryCode" in target ? (target as Place).countryCode : undefined;
      const originCountry = c.params.originCountry;
      return targetCountry && originCountry && targetCountry !== originCountry
        ? { constraintId: c.id, ok: false, reason: "cross-border not allowed" }
        : { constraintId: c.id, ok: true };
    }
  }
}

export function evaluateAll(ctx: ConstraintContext, constraints: readonly SpatialConstraint[], target: Coordinate | Place): readonly ConstraintEvaluation[] {
  return constraints.map((c) => evaluateConstraint(ctx, c, target));
}

export function assertAll(ctx: ConstraintContext, constraints: readonly SpatialConstraint[], target: Coordinate | Place): void {
  const violations = evaluateAll(ctx, constraints, target).filter((e) => !e.ok);
  if (violations.length) {
    throw new SpatialConstraintViolation(violations.map((v) => `${v.constraintId}: ${v.reason ?? "violation"}`).join("; "));
  }
}
