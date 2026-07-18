/** Spatial Intelligence Engine — region hierarchy engine. */
import { SpatialNotFoundError, SpatialValidationError } from "./errors";
import type { BoundingBox, Coordinate, Region } from "./types";
import { isInsideBBox } from "./validation";

export class RegionHierarchy {
  private regions = new Map<string, Region>();
  private children = new Map<string, Set<string>>();

  add(r: Region): void {
    if (this.regions.has(r.id)) throw new SpatialValidationError(`region already exists: ${r.id}`);
    if (r.parentId && !this.regions.has(r.parentId)) {
      throw new SpatialNotFoundError("region.parent", r.parentId);
    }
    this.regions.set(r.id, r);
    if (r.parentId) {
      let set = this.children.get(r.parentId);
      if (!set) { set = new Set(); this.children.set(r.parentId, set); }
      set.add(r.id);
    }
  }

  update(r: Region): void {
    if (!this.regions.has(r.id)) throw new SpatialNotFoundError("region", r.id);
    this.regions.set(r.id, r);
  }

  remove(id: string): boolean {
    const r = this.regions.get(id);
    if (!r) return false;
    if (this.children.get(id)?.size) throw new SpatialValidationError(`region has children: ${id}`);
    this.regions.delete(id);
    if (r.parentId) this.children.get(r.parentId)?.delete(id);
    return true;
  }

  get(id: string): Region | undefined { return this.regions.get(id); }
  list(): readonly Region[] { return Array.from(this.regions.values()); }
  size(): number { return this.regions.size; }
  clear(): void { this.regions.clear(); this.children.clear(); }

  ancestors(id: string): readonly Region[] {
    const out: Region[] = [];
    let cur = this.regions.get(id);
    const seen = new Set<string>();
    while (cur?.parentId) {
      if (seen.has(cur.parentId)) break;
      seen.add(cur.parentId);
      const next = this.regions.get(cur.parentId);
      if (!next) break;
      out.push(next);
      cur = next;
    }
    return out;
  }

  descendants(id: string): readonly Region[] {
    const out: Region[] = [];
    const walk = (curId: string): void => {
      for (const childId of this.children.get(curId) ?? []) {
        const c = this.regions.get(childId);
        if (c) { out.push(c); walk(childId); }
      }
    };
    walk(id);
    return out;
  }

  childrenOf(id: string): readonly Region[] {
    const ids = this.children.get(id);
    if (!ids) return [];
    const out: Region[] = [];
    for (const c of ids) { const r = this.regions.get(c); if (r) out.push(r); }
    return out;
  }

  isAncestor(ancestorId: string, descendantId: string): boolean {
    return this.ancestors(descendantId).some((r) => r.id === ancestorId);
  }

  contains(regionId: string, coord: Coordinate): boolean {
    const r = this.regions.get(regionId);
    return !!(r?.bbox && isInsideBBox(coord, r.bbox));
  }

  find(coord: Coordinate): readonly Region[] {
    const out: Region[] = [];
    for (const r of this.regions.values()) if (r.bbox && isInsideBBox(coord, r.bbox)) out.push(r);
    return out;
  }

  bboxFor(id: string): BoundingBox | undefined { return this.regions.get(id)?.bbox; }
}
