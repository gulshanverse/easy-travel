/**
 * JourneyRegistry — in-process registry of live JourneyManagers.
 * Enforces per-process caps and supports lookup by id, owner, and namespace.
 */

import { JourneyNotFoundError, JourneyRegistryError } from "./errors";
import type { JourneyManager } from "./manager";
import type { JourneyPolicies } from "./config";

export class JourneyRegistry {
  private byId = new Map<string, JourneyManager>();
  private byOwner = new Map<string, Set<string>>();
  constructor(private readonly policies: JourneyPolicies) {}

  register(manager: JourneyManager): void {
    if (this.byId.has(manager.id))
      throw new JourneyRegistryError(`journey already registered: ${manager.id}`);
    if (this.byId.size >= this.policies.maxJourneysPerProcess)
      throw new JourneyRegistryError("registry journey limit exceeded");
    this.byId.set(manager.id, manager);
    const set = this.byOwner.get(manager.journey.ownerId) ?? new Set();
    set.add(manager.id);
    this.byOwner.set(manager.journey.ownerId, set);
  }

  unregister(id: string): boolean {
    const m = this.byId.get(id);
    if (!m) return false;
    this.byId.delete(id);
    this.byOwner.get(m.journey.ownerId)?.delete(id);
    return true;
  }

  get(id: string): JourneyManager | undefined { return this.byId.get(id); }
  require(id: string): JourneyManager {
    const m = this.byId.get(id);
    if (!m) throw new JourneyNotFoundError(id);
    return m;
  }
  count(): number { return this.byId.size; }
  list(): readonly JourneyManager[] { return Array.from(this.byId.values()); }
  listByOwner(ownerId: string): readonly JourneyManager[] {
    const ids = this.byOwner.get(ownerId);
    if (!ids) return [];
    return Array.from(ids).map((id) => this.byId.get(id)).filter((m): m is JourneyManager => !!m);
  }
  clear(): void { this.byId.clear(); this.byOwner.clear(); }
}
