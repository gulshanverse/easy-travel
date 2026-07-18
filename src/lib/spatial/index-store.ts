/**
 * Spatial Intelligence Engine — in-memory grid-based spatial index.
 * Deterministic, no persistence. Provides nearest / radius / bbox lookups.
 * Persistence hooks are defined as ports (see ports.ts) so future adapters
 * can back this with PostGIS or similar without changing consumers.
 */
import type { SpatialConfig } from "./config";
import { haversineMeters } from "./distance";
import type { BoundingBox, Coordinate, Place } from "./types";
import { isInsideBBox } from "./validation";

export class SpatialIndex {
  private buckets = new Map<string, Set<string>>();
  private places = new Map<string, Place>();
  private readonly bucketSize: number;

  constructor(private readonly config: SpatialConfig) {
    this.bucketSize = config.indexBucketSizeDegrees;
  }

  private key(c: Coordinate): string {
    const bx = Math.floor(c.lng / this.bucketSize);
    const by = Math.floor(c.lat / this.bucketSize);
    return `${bx}:${by}`;
  }

  add(place: Place): void {
    this.places.set(place.id, place);
    const k = this.key(place.coord);
    let set = this.buckets.get(k);
    if (!set) { set = new Set(); this.buckets.set(k, set); }
    set.add(place.id);
  }

  remove(id: string): void {
    const p = this.places.get(id);
    if (!p) return;
    this.places.delete(id);
    const k = this.key(p.coord);
    const set = this.buckets.get(k);
    if (set) { set.delete(id); if (!set.size) this.buckets.delete(k); }
  }

  update(place: Place): void { this.remove(place.id); this.add(place); }
  get(id: string): Place | undefined { return this.places.get(id); }
  size(): number { return this.places.size; }
  clear(): void { this.buckets.clear(); this.places.clear(); }
  all(): readonly Place[] { return Array.from(this.places.values()); }

  private candidateBuckets(bbox: BoundingBox): string[] {
    const bx0 = Math.floor(bbox.west / this.bucketSize);
    const bx1 = Math.floor(bbox.east / this.bucketSize);
    const by0 = Math.floor(bbox.south / this.bucketSize);
    const by1 = Math.floor(bbox.north / this.bucketSize);
    const keys: string[] = [];
    for (let x = bx0; x <= bx1; x++) for (let y = by0; y <= by1; y++) keys.push(`${x}:${y}`);
    return keys;
  }

  inBBox(bbox: BoundingBox): readonly Place[] {
    const out: Place[] = [];
    for (const k of this.candidateBuckets(bbox)) {
      const ids = this.buckets.get(k); if (!ids) continue;
      for (const id of ids) {
        const p = this.places.get(id);
        if (p && isInsideBBox(p.coord, bbox)) out.push(p);
      }
    }
    return out;
  }

  radius(center: Coordinate, radiusMeters: number): readonly Place[] {
    const degMargin = (radiusMeters / 111_320) * 1.2 + this.bucketSize;
    const bbox: BoundingBox = {
      south: center.lat - degMargin, north: center.lat + degMargin,
      west: center.lng - degMargin, east: center.lng + degMargin,
    };
    const candidates = this.inBBox(bbox);
    const out: Place[] = [];
    for (const p of candidates) {
      if (haversineMeters(center, p.coord) <= radiusMeters) out.push(p);
    }
    return out;
  }

  nearest(from: Coordinate, k = 1): readonly Place[] {
    const scored = this.all().map((p) => ({ p, d: haversineMeters(from, p.coord) }));
    scored.sort((a, b) => a.d - b.d);
    return scored.slice(0, k).map((s) => s.p);
  }

  validate(): { readonly ok: boolean; readonly issues: readonly string[] } {
    const issues: string[] = [];
    let counted = 0;
    for (const [, ids] of this.buckets) counted += ids.size;
    if (counted !== this.places.size) issues.push(`bucket count ${counted} != place count ${this.places.size}`);
    return { ok: issues.length === 0, issues: Object.freeze([...issues]) };
  }
}
