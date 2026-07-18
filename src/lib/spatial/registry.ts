/** Spatial Intelligence Engine — SpatialRegistry (per-tenant managers). */
import { SpatialConfigurationError, SpatialNotFoundError } from "./errors";
import type { SpatialManager } from "./manager";
import { DEFAULT_SPATIAL_POLICIES, type SpatialPolicies } from "./policies";

export class SpatialRegistry {
  private managers = new Map<string, SpatialManager>();
  constructor(private readonly policies: SpatialPolicies = DEFAULT_SPATIAL_POLICIES) {}

  register(id: string, mgr: SpatialManager): void {
    if (this.managers.has(id)) throw new SpatialConfigurationError(`manager already registered: ${id}`);
    if (this.managers.size >= this.policies.maxManagers) throw new SpatialConfigurationError("registry limit exceeded");
    this.managers.set(id, mgr);
  }
  unregister(id: string): boolean { return this.managers.delete(id); }
  get(id: string): SpatialManager | undefined { return this.managers.get(id); }
  require(id: string): SpatialManager {
    const m = this.managers.get(id); if (!m) throw new SpatialNotFoundError("manager", id); return m;
  }
  list(): readonly SpatialManager[] { return Array.from(this.managers.values()); }
  count(): number { return this.managers.size; }
  clear(): void { this.managers.clear(); }
}
