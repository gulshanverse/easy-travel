/**
 * Spatial Intelligence Engine — deterministic clustering.
 * Simple grid + expand approach: pick unassigned seed with lowest id,
 * absorb all places within radius, compute centroid, repeat. Deterministic
 * because input order is sorted.
 */
import type { SpatialConfig } from "./config";
import { haversineMeters } from "./distance";
import { makeCluster } from "./factories";
import type { Coordinate, Place, SpatialCluster } from "./types";
import { normalizeCoordinate } from "./validation";

export function centroidOf(coords: readonly Coordinate[]): Coordinate {
  if (!coords.length) return normalizeCoordinate({ lat: 0, lng: 0 });
  let lat = 0, lng = 0;
  for (const c of coords) { lat += c.lat; lng += c.lng; }
  return normalizeCoordinate({ lat: lat / coords.length, lng: lng / coords.length });
}

export function clusterPlaces(config: SpatialConfig, places: readonly Place[], radiusMeters = config.clusterRadiusMeters, now = Date.now()): readonly SpatialCluster[] {
  const sorted = [...places].sort((a, b) => a.id.localeCompare(b.id));
  const assigned = new Set<string>();
  const clusters: SpatialCluster[] = [];
  for (const seed of sorted) {
    if (assigned.has(seed.id)) continue;
    const members = [seed];
    assigned.add(seed.id);
    for (const other of sorted) {
      if (assigned.has(other.id)) continue;
      if (haversineMeters(seed.coord, other.coord) <= radiusMeters) {
        members.push(other); assigned.add(other.id);
      }
    }
    if (members.length < config.clusterMinMembers) continue;
    const centroid = centroidOf(members.map((m) => m.coord));
    const area = Math.PI * radiusMeters * radiusMeters;
    const density = members.length / (area / 1_000_000); // per km²
    clusters.push(makeCluster(members.map((m) => m.id), centroid, radiusMeters, density, now));
  }
  return clusters;
}
