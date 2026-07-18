/** Spatial Intelligence Engine — corridor topology (no routing). */
import { SpatialValidationError } from "./errors";
import { makeCorridor } from "./factories";
import type { CorridorKind, TravelCorridor } from "./types";

export function buildCorridor(kind: CorridorKind, nodes: readonly string[], gateway?: string): TravelCorridor {
  if (nodes.length < 2) throw new SpatialValidationError("corridor requires at least 2 nodes");
  const seen = new Set<string>();
  for (const n of nodes) {
    if (seen.has(n)) throw new SpatialValidationError(`duplicate node in corridor: ${n}`);
    seen.add(n);
  }
  if (gateway && !seen.has(gateway)) throw new SpatialValidationError("gateway must be part of corridor nodes");
  return makeCorridor(kind, nodes, gateway);
}

export function buildHubAndSpoke(hub: string, spokes: readonly string[]): TravelCorridor {
  if (!spokes.length) throw new SpatialValidationError("hub-and-spoke requires ≥1 spoke");
  return buildCorridor("hub_and_spoke", [hub, ...spokes], hub);
}

export function corridorContains(c: TravelCorridor, placeId: string): boolean {
  return c.nodes.includes(placeId);
}

export function corridorIntersect(a: TravelCorridor, b: TravelCorridor): readonly string[] {
  const setB = new Set(b.nodes);
  return a.nodes.filter((n) => setB.has(n));
}
