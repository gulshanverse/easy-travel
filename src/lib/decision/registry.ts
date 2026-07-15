/**
 * DecisionRegistry — in-process lookup of DecisionManagers.
 */

import type { DecisionPolicies } from "./config";
import { DecisionNotFoundError, DecisionRegistryError } from "./errors";
import type { DecisionManager } from "./manager";

export class DecisionRegistry {
  private byId = new Map<string, DecisionManager>();
  constructor(private readonly policies: DecisionPolicies) {}

  register(mgr: DecisionManager): void {
    if (this.byId.size >= this.policies.maxDecisionsPerProcess) {
      throw new DecisionRegistryError("max decisions per process reached", {
        limit: this.policies.maxDecisionsPerProcess,
      });
    }
    if (this.byId.has(mgr.id)) {
      throw new DecisionRegistryError(`duplicate decision id ${mgr.id}`);
    }
    this.byId.set(mgr.id, mgr);
  }

  unregister(id: string): boolean { return this.byId.delete(id); }
  get(id: string): DecisionManager | undefined { return this.byId.get(id); }
  require(id: string): DecisionManager {
    const m = this.byId.get(id);
    if (!m) throw new DecisionNotFoundError(id);
    return m;
  }
  list(): readonly DecisionManager[] { return Array.from(this.byId.values()); }
  count(): number { return this.byId.size; }
  clear(): void { this.byId.clear(); }
}
