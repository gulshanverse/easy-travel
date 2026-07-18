/** Spatial Intelligence Engine — SpatialManager (per-tenant orchestrator). */
import { clusterPlaces } from "./clustering";
import type { SpatialConfig } from "./config";
import { assertAll, evaluateAll, type ConstraintContext, type ConstraintEvaluation } from "./constraints";
import { buildCorridor, buildHubAndSpoke } from "./corridor";
import { haversineMeters } from "./distance";
import { SpatialNotFoundError, SpatialValidationError } from "./errors";
import { SpatialEventBus } from "./events";
import {
  makeConstraint, makeFence, makePlace, makeRegion, type MakeConstraintInput,
  type MakePlaceInput, type MakeRegionInput,
} from "./factories";
import { SpatialIndex } from "./index-store";
import { assertTransition, SpatialHistory } from "./lifecycle";
import { SpatialMetrics } from "./metrics";
import { RegionHierarchy } from "./region";
import { detectAll, detectPairwise } from "./relationships";
import { noopSpatialTelemetry, type SpatialTelemetrySink } from "./telemetry";
import type {
  BoundingBox, Coordinate, CorridorKind, GeoFence, LifecycleState, Place,
  Region, SpatialCluster, SpatialConstraint, SpatialRelationship,
  SpatialSnapshot, TravelCorridor,
} from "./types";

export interface SpatialManagerDeps {
  readonly config: SpatialConfig;
  readonly events?: SpatialEventBus;
  readonly metrics?: SpatialMetrics;
  readonly telemetry?: SpatialTelemetrySink;
  readonly now?: () => number;
}

export class SpatialManager {
  readonly config: SpatialConfig;
  readonly events: SpatialEventBus;
  readonly metrics: SpatialMetrics;
  readonly telemetry: SpatialTelemetrySink;
  readonly regions = new RegionHierarchy();
  readonly index: SpatialIndex;
  readonly history = new SpatialHistory();
  private readonly now: () => number;
  private readonly _places = new Map<string, Place>();
  private readonly _clusters = new Map<string, SpatialCluster>();
  private readonly _corridors = new Map<string, TravelCorridor>();
  private readonly _relationships = new Map<string, SpatialRelationship>();
  private readonly _constraints = new Map<string, SpatialConstraint>();
  private readonly _fences = new Map<string, GeoFence>();

  constructor(deps: SpatialManagerDeps) {
    this.config = deps.config;
    this.events = deps.events ?? new SpatialEventBus();
    this.metrics = deps.metrics ?? new SpatialMetrics();
    this.telemetry = deps.telemetry ?? noopSpatialTelemetry;
    this.now = deps.now ?? (() => Date.now());
    this.index = new SpatialIndex(this.config);
  }

  // ----- Places -----
  createPlace(input: MakePlaceInput): Place {
    if (this._places.size >= this.config.maxPlaces) throw new SpatialValidationError("place capacity reached");
    const p = makePlace({ ...input, now: input.now ?? this.now() });
    this._places.set(p.id, p);
    this.index.add(p);
    this.metrics.incPlaces();
    this.metrics.incIndex();
    this.events.emit("PlaceCreated", { placeId: p.id, coord: p.coord });
    this.events.emit("SpatialIndexUpdated", { placeId: p.id, op: "add" });
    return p;
  }

  updatePlace(id: string, patch: Partial<Omit<Place, "id" | "createdAt">>): Place {
    const cur = this._places.get(id);
    if (!cur) throw new SpatialNotFoundError("place", id);
    const next: Place = Object.freeze({ ...cur, ...patch, id: cur.id, createdAt: cur.createdAt, version: cur.version + 1, updatedAt: this.now() });
    this._places.set(id, next);
    this.index.update(next);
    this.metrics.incIndex();
    this.events.emit("PlaceUpdated", { placeId: id });
    return next;
  }

  archivePlace(id: string): Place {
    const p = this.transition(id, "archived", "manual archive");
    this.events.emit("PlaceArchived", { placeId: id });
    return p;
  }

  getPlace(id: string): Place | undefined { return this._places.get(id); }
  listPlaces(): readonly Place[] { return Array.from(this._places.values()); }
  placeCount(): number { return this._places.size; }

  // ----- Regions -----
  createRegion(input: MakeRegionInput): Region {
    if (this.regions.size() >= this.config.maxRegions) throw new SpatialValidationError("region capacity reached");
    const r = makeRegion({ ...input, now: input.now ?? this.now() });
    this.regions.add(r);
    this.metrics.incRegions();
    this.events.emit("RegionCreated", { regionId: r.id, kind: r.kind });
    return r;
  }

  validateRegion(id: string): Region {
    const r = this.regions.get(id);
    if (!r) throw new SpatialNotFoundError("region", id);
    const next: Region = Object.freeze({ ...r, state: "validated", version: r.version + 1, updatedAt: this.now() });
    this.regions.update(next);
    this.events.emit("RegionValidated", { regionId: id });
    return next;
  }

  updateRegion(id: string, patch: Partial<Omit<Region, "id" | "createdAt">>): Region {
    const cur = this.regions.get(id);
    if (!cur) throw new SpatialNotFoundError("region", id);
    const next: Region = Object.freeze({ ...cur, ...patch, id: cur.id, createdAt: cur.createdAt, version: cur.version + 1, updatedAt: this.now() });
    this.regions.update(next);
    this.events.emit("RegionUpdated", { regionId: id });
    return next;
  }

  // ----- Lifecycle -----
  transition(placeId: string, to: LifecycleState, note?: string): Place {
    const cur = this._places.get(placeId);
    if (!cur) throw new SpatialNotFoundError("place", placeId);
    assertTransition(cur.state, to);
    const next = this.updatePlace(placeId, { state: to });
    this.history.record({ entityId: placeId, at: this.now(), from: cur.state, to, note });
    this.metrics.incLifecycle();
    this.events.emit("LifecycleTransitioned", { placeId, from: cur.state, to });
    return next;
  }

  // ----- Distance -----
  distance(a: string | Coordinate, b: string | Coordinate): number {
    const ac = typeof a === "string" ? this._places.get(a)?.coord : a;
    const bc = typeof b === "string" ? this._places.get(b)?.coord : b;
    if (!ac || !bc) throw new SpatialNotFoundError("place", typeof a === "string" ? a : "?");
    const d = haversineMeters(ac, bc);
    this.metrics.incDistances();
    this.events.emit("DistanceCalculated", { meters: d });
    return d;
  }

  // ----- Queries -----
  nearest(from: Coordinate, k = 1): readonly Place[] { return this.index.nearest(from, k); }
  withinRadius(center: Coordinate, radiusMeters: number): readonly Place[] { return this.index.radius(center, radiusMeters); }
  inBBox(bbox: BoundingBox): readonly Place[] { return this.index.inBBox(bbox); }

  // ----- Relationships -----
  detectRelationships(): readonly SpatialRelationship[] {
    const rels = detectAll({ config: this.config, regions: this.regions }, this.listPlaces());
    for (const r of rels) {
      this._relationships.set(r.id, r);
      this.metrics.incRelationships();
      this.events.emit("SpatialRelationshipDetected", { id: r.id, kind: r.kind });
    }
    return rels;
  }
  detectPair(a: string, b: string): readonly SpatialRelationship[] {
    const pa = this._places.get(a), pb = this._places.get(b);
    if (!pa || !pb) throw new SpatialNotFoundError("place", !pa ? a : b);
    const rels = detectPairwise({ config: this.config, regions: this.regions }, pa, pb);
    for (const r of rels) { this._relationships.set(r.id, r); this.metrics.incRelationships(); }
    return rels;
  }
  listRelationships(): readonly SpatialRelationship[] { return Array.from(this._relationships.values()); }

  // ----- Clustering -----
  buildClusters(radiusMeters?: number): readonly SpatialCluster[] {
    const cs = clusterPlaces(this.config, this.listPlaces(), radiusMeters, this.now());
    for (const c of cs) {
      this._clusters.set(c.id, c);
      this.metrics.incClusters();
      this.events.emit("ClusterBuilt", { clusterId: c.id, members: c.members.length });
    }
    return cs;
  }
  listClusters(): readonly SpatialCluster[] { return Array.from(this._clusters.values()); }

  // ----- Corridors -----
  createCorridor(kind: CorridorKind, nodes: readonly string[], gateway?: string): TravelCorridor {
    for (const n of nodes) if (!this._places.has(n)) throw new SpatialNotFoundError("place", n);
    const c = buildCorridor(kind, nodes, gateway);
    this._corridors.set(c.id, c);
    this.metrics.incCorridors();
    this.events.emit("CorridorCreated", { corridorId: c.id, kind });
    return c;
  }
  createHubAndSpoke(hub: string, spokes: readonly string[]): TravelCorridor {
    for (const n of [hub, ...spokes]) if (!this._places.has(n)) throw new SpatialNotFoundError("place", n);
    const c = buildHubAndSpoke(hub, spokes);
    this._corridors.set(c.id, c);
    this.metrics.incCorridors();
    this.events.emit("CorridorCreated", { corridorId: c.id, kind: c.kind });
    return c;
  }
  listCorridors(): readonly TravelCorridor[] { return Array.from(this._corridors.values()); }

  // ----- Fences -----
  createFence(name: string, bbox: BoundingBox, kind: "inclusive" | "exclusive" = "inclusive"): GeoFence {
    const f = makeFence(name, bbox, kind);
    this._fences.set(f.id, f);
    return f;
  }
  listFences(): readonly GeoFence[] { return Array.from(this._fences.values()); }
  triggerFence(fenceId: string, coord: Coordinate): boolean {
    const f = this._fences.get(fenceId);
    if (!f) throw new SpatialNotFoundError("fence", fenceId);
    const inside = coord.lat >= f.bbox.south && coord.lat <= f.bbox.north && coord.lng >= f.bbox.west && coord.lng <= f.bbox.east;
    const triggered = f.kind === "inclusive" ? !inside : inside;
    this.events.emit("GeoFenceTriggered", { fenceId, triggered });
    return triggered;
  }

  // ----- Constraints -----
  addConstraint(input: MakeConstraintInput): SpatialConstraint {
    const c = makeConstraint({ ...input, now: input.now ?? this.now() });
    this._constraints.set(c.id, c);
    this.events.emit("SpatialConstraintAdded", { constraintId: c.id, kind: c.kind });
    return c;
  }
  listConstraints(): readonly SpatialConstraint[] { return Array.from(this._constraints.values()); }
  evaluateConstraints(target: Coordinate | Place, origin?: Coordinate): readonly ConstraintEvaluation[] {
    const ctx: ConstraintContext = { regions: this.regions, fences: this._fences, origin, places: this._places };
    const evals = evaluateAll(ctx, this.listConstraints(), target);
    const violations = evals.filter((e) => !e.ok).length;
    if (violations) this.metrics.incViolations(violations);
    return evals;
  }
  assertConstraints(target: Coordinate | Place, origin?: Coordinate): void {
    const ctx: ConstraintContext = { regions: this.regions, fences: this._fences, origin, places: this._places };
    assertAll(ctx, this.listConstraints(), target);
  }

  // ----- Snapshot -----
  snapshot(): SpatialSnapshot {
    return Object.freeze({
      places: Object.freeze([...this.listPlaces()]) as readonly Place[],
      regions: Object.freeze([...this.regions.list()]) as readonly Region[],
      clusters: Object.freeze([...this.listClusters()]) as readonly SpatialCluster[],
      corridors: Object.freeze([...this.listCorridors()]) as readonly TravelCorridor[],
      relationships: Object.freeze([...this.listRelationships()]) as readonly SpatialRelationship[],
      constraints: Object.freeze([...this.listConstraints()]) as readonly SpatialConstraint[],
      fences: Object.freeze([...this.listFences()]) as readonly GeoFence[],
      capturedAt: this.now(),
    });
  }

  clear(): void {
    this._places.clear(); this._clusters.clear(); this._corridors.clear();
    this._relationships.clear(); this._constraints.clear(); this._fences.clear();
    this.regions.clear(); this.index.clear(); this.history.clear();
  }
}
