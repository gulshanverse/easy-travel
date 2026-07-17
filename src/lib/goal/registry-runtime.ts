/**
 * Goal Engine — multi-tenant registry of GoalManagers by scope.
 */
import type { GoalManager } from "./manager";

export class GoalRegistry {
  private readonly managers = new Map<string, GoalManager>();
  register(scope: string, manager: GoalManager): GoalManager { this.managers.set(scope, manager); return manager; }
  get(scope: string): GoalManager | undefined { return this.managers.get(scope); }
  scopes(): readonly string[] { return Array.from(this.managers.keys()); }
  size(): number { return this.managers.size; }
  clear(): void { this.managers.clear(); }
}
