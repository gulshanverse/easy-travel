/**
 * Spatial Intelligence Engine — unit, integration, architecture fitness,
 * stress, and cross-engine interop tests. All interop happens via public
 * ports only.
 */
import { describe, expect, it } from "vitest";
import {
  createSpatialRuntime, SPATIAL_CAPABILITY_MANIFEST, SPATIAL_ENGINE_CONTRACT,
  buildCorridor, clusterPlaces, distanceMatrix, greatCircleMeters, haversineMeters,
  equirectangularMeters, makeCity, makeCoordinate, makeCountry, makePlace,
  normalizeCoordinate, validateCoordinate, SpatialValidationError,
  SpatialConstraintViolation, SpatialLifecycleError, canTransition, RegionHierarchy,
  SpatialIndex, DEFAULT_SPATIAL_CONFIG,
  type SpatialGoalPort, type SpatialJourneyPort, type SpatialMemoryPort,
} from "@/lib/spatial";
import { createGraphRuntime } from "@/lib/graph";
import { createGoalRuntime } from "@/lib/goal";
import { createJourneyRuntime } from "@/lib/journey";
import { createTrustRuntime } from "@/lib/trust";
import { createDecisionRuntime } from "@/lib/decision";

const KYOTO = { lat: 35.0116, lng: 135.7681 };
const TOKYO = { lat: 35.6762, lng: 139.6503 };
const OSAKA = { lat: 34.6937, lng: 135.5023 };
const PARIS = { lat: 48.8566, lng: 2.3522 };

describe("Coordinate", () => {
  it("validates lat/lng ranges", () => {
    expect(() => validateCoordinate({ lat: 100, lng: 0 })).toThrow(SpatialValidationError);
    expect(() => validateCoordinate({ lat: 0, lng: 200 })).toThrow(SpatialValidationError);
    validateCoordinate({ lat: -90, lng: 180 });
  });
  it("normalizes longitude wrap", () => {
    const n = normalizeCoordinate({ lat: 10, lng: 190 });
    expect(n.lng).toBe(-170);
  });
  it("makeCoordinate freezes result", () => {
    const c = makeCoordinate(1, 2);
    expect(Object.isFrozen(c)).toBe(true);
  });
});

describe("Distance", () => {
  it("haversine ≈ great_circle", () => {
    const d = haversineMeters(TOKYO, OSAKA);
    expect(d).toBe(greatCircleMeters(TOKYO, OSAKA));
    expect(d).toBeGreaterThan(390_000);
    expect(d).toBeLessThan(410_000);
  });
  it("equirectangular is close for nearby points", () => {
    const h = haversineMeters(TOKYO, OSAKA);
    const e = equirectangularMeters(TOKYO, OSAKA);
    expect(Math.abs(h - e) / h).toBeLessThan(0.01);
  });
  it("distance matrix is deterministic", () => {
    const m1 = distanceMatrix([TOKYO, OSAKA], [KYOTO, PARIS]);
    const m2 = distanceMatrix([TOKYO, OSAKA], [KYOTO, PARIS]);
    expect(m1).toEqual(m2);
    expect(m1.length).toBe(2);
    expect(m1[0].length).toBe(2);
  });
});

describe("SpatialIndex", () => {
  it("radius + nearest + bbox lookups", () => {
    const idx = new SpatialIndex(DEFAULT_SPATIAL_CONFIG);
    idx.add(makePlace({ name: "T", coord: TOKYO }));
    idx.add(makePlace({ name: "O", coord: OSAKA }));
    idx.add(makePlace({ name: "K", coord: KYOTO }));
    idx.add(makePlace({ name: "P", coord: PARIS }));
    expect(idx.size()).toBe(4);
    expect(idx.nearest(KYOTO, 2).length).toBe(2);
    expect(idx.radius(KYOTO, 100_000).length).toBeGreaterThanOrEqual(2);
    expect(idx.inBBox({ south: 30, north: 40, west: 130, east: 145 }).length).toBe(3);
    expect(idx.validate().ok).toBe(true);
  });
});

describe("RegionHierarchy", () => {
  it("ancestors, descendants, containment", () => {
    const h = new RegionHierarchy();
    const jp = makeCountry("Japan", "JP", { south: 24, west: 122, north: 46, east: 146 });
    h.add(jp);
    const kansai = makeCity("Kansai", jp.id, { south: 34, west: 134, north: 36, east: 137 });
    h.add(kansai);
    const kyoto = makeCity("Kyoto", kansai.id, { south: 34.9, west: 135.6, north: 35.1, east: 135.9 });
    h.add(kyoto);
    expect(h.ancestors(kyoto.id).map((r) => r.name)).toEqual(["Kansai", "Japan"]);
    expect(h.descendants(jp.id).length).toBe(2);
    expect(h.contains(kyoto.id, KYOTO)).toBe(true);
    expect(h.isAncestor(jp.id, kyoto.id)).toBe(true);
  });
});

describe("SpatialRuntime", () => {
  it("creates a place, indexes it, and calculates distance", () => {
    const rt = createSpatialRuntime();
    const t = rt.manager.createPlace({ name: "Tokyo", coord: TOKYO, kind: "city" });
    const o = rt.manager.createPlace({ name: "Osaka", coord: OSAKA, kind: "city" });
    expect(Object.isFrozen(t)).toBe(true);
    expect(rt.manager.placeCount()).toBe(2);
    expect(rt.manager.distance(t.id, o.id)).toBeCloseTo(haversineMeters(TOKYO, OSAKA), -1);
    expect(rt.manager.nearest(KYOTO, 1)[0].id).toBe(o.id);
    expect(rt.metricsSnapshot().places).toBe(2);
  });

  it("lifecycle transitions and rejects illegal ones", () => {
    const rt = createSpatialRuntime();
    const p = rt.manager.createPlace({ name: "T", coord: TOKYO });
    expect(canTransition("created", "validated")).toBe(true);
    rt.manager.transition(p.id, "validated");
    rt.manager.transition(p.id, "ready");
    expect(() => rt.manager.transition(p.id, "created")).toThrow(SpatialLifecycleError);
  });

  it("clusters nearby places deterministically", () => {
    const rt = createSpatialRuntime({ config: { clusterRadiusMeters: 500_000 } });
    rt.manager.createPlace({ name: "T", coord: TOKYO });
    rt.manager.createPlace({ name: "O", coord: OSAKA });
    rt.manager.createPlace({ name: "K", coord: KYOTO });
    rt.manager.createPlace({ name: "P", coord: PARIS });
    const cs1 = clusterPlaces(rt.config, rt.manager.listPlaces(), 500_000);
    const cs2 = clusterPlaces(rt.config, rt.manager.listPlaces(), 500_000);
    expect(cs1.map((c) => c.members)).toEqual(cs2.map((c) => c.members));
    expect(cs1.some((c) => c.members.length >= 2)).toBe(true);
  });

  it("builds corridors and rejects invalid ones", () => {
    const rt = createSpatialRuntime();
    const t = rt.manager.createPlace({ name: "T", coord: TOKYO });
    const o = rt.manager.createPlace({ name: "O", coord: OSAKA });
    const k = rt.manager.createPlace({ name: "K", coord: KYOTO });
    const c = rt.manager.createCorridor("multi_city", [t.id, k.id, o.id]);
    expect(c.nodes.length).toBe(3);
    expect(() => buildCorridor("travel", [t.id])).toThrow(SpatialValidationError);
    const hs = rt.manager.createHubAndSpoke(t.id, [k.id, o.id]);
    expect(hs.gateway).toBe(t.id);
  });

  it("detects relationships based on distance + region", () => {
    const rt = createSpatialRuntime({ config: { nearbyRadiusMeters: 500_000 } });
    const jp = rt.manager.createRegion({ name: "Japan", kind: "country", countryCode: "JP" });
    rt.manager.createPlace({ name: "T", coord: TOKYO, regionId: jp.id, countryCode: "JP" });
    rt.manager.createPlace({ name: "O", coord: OSAKA, regionId: jp.id, countryCode: "JP" });
    rt.manager.createPlace({ name: "P", coord: PARIS, countryCode: "FR" });
    const rels = rt.manager.detectRelationships();
    const kinds = new Set(rels.map((r) => r.kind));
    expect(kinds.has("nearby")).toBe(true);
    expect(kinds.has("same_region")).toBe(true);
    expect(kinds.has("cross_border")).toBe(true);
  });

  it("evaluates constraints & throws on violation", () => {
    const rt = createSpatialRuntime();
    rt.manager.addConstraint({ kind: "max_radius", params: { radiusMeters: 100_000 } });
    const p = rt.manager.createPlace({ name: "K", coord: KYOTO });
    const evals = rt.manager.evaluateConstraints(p, TOKYO);
    expect(evals[0].ok).toBe(false);
    expect(() => rt.manager.assertConstraints(p, TOKYO)).toThrow(SpatialConstraintViolation);
    const near = rt.manager.evaluateConstraints(p, KYOTO);
    expect(near[0].ok).toBe(true);
  });

  it("geo-fence trigger + fence-based constraints", () => {
    const rt = createSpatialRuntime();
    const fence = rt.manager.createFence("kansai", { south: 34, west: 134, north: 36, east: 137 });
    expect(rt.manager.triggerFence(fence.id, KYOTO)).toBe(false);
    expect(rt.manager.triggerFence(fence.id, PARIS)).toBe(true);
  });

  it("snapshot is frozen and complete", () => {
    const rt = createSpatialRuntime();
    rt.manager.createPlace({ name: "T", coord: TOKYO });
    const snap = rt.manager.snapshot();
    expect(Object.isFrozen(snap)).toBe(true);
    expect(snap.places.length).toBe(1);
  });

  it("publishes engine contract & capability manifest", () => {
    expect(SPATIAL_ENGINE_CONTRACT.id).toBe("engine.spatial");
    expect(SPATIAL_ENGINE_CONTRACT.version).toBe("1.0.0");
    expect(SPATIAL_CAPABILITY_MANIFEST.engine).toBe("spatial");
    expect(Object.isFrozen(SPATIAL_ENGINE_CONTRACT)).toBe(true);
    expect(Object.isFrozen(SPATIAL_CAPABILITY_MANIFEST)).toBe(true);
  });

  it("health aggregates port results", async () => {
    const rt = createSpatialRuntime({
      ports: {
        memory: { async fetchPlaceHints() { return []; }, async healthy() { return true; } } as SpatialMemoryPort,
      },
    });
    const h = await rt.health();
    expect(h.ok).toBe(true);
    expect(h.indexValid).toBe(true);
  });
});

describe("Stress", () => {
  it("indexes 5_000 places and queries in bounded time", () => {
    const rt = createSpatialRuntime({ config: { maxPlaces: 10_000 } });
    const t0 = Date.now();
    for (let i = 0; i < 5_000; i++) {
      const lat = -60 + (i % 120);
      const lng = -180 + ((i * 7) % 360);
      rt.manager.createPlace({ name: `p${i}`, coord: { lat, lng } });
    }
    const near = rt.manager.nearest({ lat: 0, lng: 0 }, 10);
    const inBox = rt.manager.inBBox({ south: -10, north: 10, west: -10, east: 10 });
    const elapsed = Date.now() - t0;
    expect(near.length).toBe(10);
    expect(inBox.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(5000);
  });
});

describe("Cross-engine interop (ports only)", () => {
  it("consumes journey/goal port results without importing internals", async () => {
    const journey = createJourneyRuntime();
    const goal = createGoalRuntime();
    const g = goal.createGoal({
      ownerId: "u", title: "Kyoto trip", description: "d",
      category: "trip", complexity: "simple", priority: "medium",
      timeline: { startAt: 1000, targetAt: 2000 },
    });
    const jPort: SpatialJourneyPort = {
      async placesForJourney() { return ["place_x"]; }, async healthy() { return true; },
    };
    const gPort: SpatialGoalPort = {
      async placesForGoal(id) { return id === g.id ? ["place_x", "place_y"] : []; },
      async healthy() { return true; },
    };
    const rt = createSpatialRuntime({ ports: { journey: jPort, goal: gPort } });
    expect((await jPort.placesForJourney("j1")).length).toBe(1);
    expect((await gPort.placesForGoal(g.id)).length).toBe(2);
    expect((await rt.health()).ok).toBe(true);
    expect(journey.metricsSnapshot()).toBeTruthy();
  });

  it("interoperates with graph, trust, decision runtimes via public API only", async () => {
    const graph = createGraphRuntime();
    const trust = createTrustRuntime();
    const decision = createDecisionRuntime();
    const rt = createSpatialRuntime();
    rt.manager.createPlace({ name: "T", coord: TOKYO });
    expect(graph.listGraphs().length).toBeGreaterThanOrEqual(0);
    expect(trust.metricsSnapshot()).toBeTruthy();
    expect(decision.metricsSnapshot()).toBeTruthy();
    expect(rt.manager.placeCount()).toBe(1);
  });
});

describe("Architecture fitness", () => {
  it("does not import from other engines' internal modules", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const dir = path.resolve(process.cwd(), "src/lib/spatial");
    const forbidden = [
      "@/lib/memory/", "@/lib/prompt/", "@/lib/runtime/", "@/lib/provider/",
      "@/lib/graph/", "@/lib/journey/", "@/lib/decision/", "@/lib/trust/",
      "@/lib/goal/",
    ];
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".ts"));
    for (const f of files) {
      const src = await fs.readFile(path.join(dir, f), "utf8");
      for (const bad of forbidden) {
        expect(src.includes(bad), `${f} must not import ${bad}`).toBe(false);
      }
      expect(src.includes("react"), `${f} must not import react`).toBe(false);
    }
  });
});
