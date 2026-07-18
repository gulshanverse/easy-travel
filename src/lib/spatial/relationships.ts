/** Spatial Intelligence Engine — spatial relationship detection. */
import type { SpatialConfig } from "./config";
import { haversineMeters } from "./distance";
import { makeRelationship } from "./factories";
import type { RegionHierarchy } from "./region";
import type { Place, RelationshipKind, SpatialRelationship } from "./types";

export interface RelationshipEngineDeps {
  readonly config: SpatialConfig;
  readonly regions: RegionHierarchy;
}

export function detectPairwise(deps: RelationshipEngineDeps, a: Place, b: Place): readonly SpatialRelationship[] {
  const out: SpatialRelationship[] = [];
  const d = haversineMeters(a.coord, b.coord);
  if (d <= deps.config.nearbyRadiusMeters) out.push(makeRelationship("nearby", a.id, b.id, d));
  if (d <= deps.config.adjacencyRadiusMeters) out.push(makeRelationship("adjacent", a.id, b.id, d));
  if (a.regionId && a.regionId === b.regionId) out.push(makeRelationship("same_region", a.id, b.id, d));
  if (a.countryCode && b.countryCode) {
    if (a.countryCode === b.countryCode) out.push(makeRelationship("same_country", a.id, b.id, d));
    else out.push(makeRelationship("cross_border", a.id, b.id, d));
  }
  if (a.regionId && b.regionId && a.regionId !== b.regionId) {
    if (deps.regions.isAncestor(a.regionId, b.regionId) || deps.regions.isAncestor(b.regionId, a.regionId)) {
      out.push(makeRelationship("contains", a.id, b.id, d));
    }
  }
  return out;
}

export function detectAll(deps: RelationshipEngineDeps, places: readonly Place[]): readonly SpatialRelationship[] {
  const out: SpatialRelationship[] = [];
  for (let i = 0; i < places.length; i++) {
    for (let j = i + 1; j < places.length; j++) {
      out.push(...detectPairwise(deps, places[i], places[j]));
    }
  }
  return out;
}

export function relationshipsOfKind(rels: readonly SpatialRelationship[], kind: RelationshipKind): readonly SpatialRelationship[] {
  return rels.filter((r) => r.kind === kind);
}
