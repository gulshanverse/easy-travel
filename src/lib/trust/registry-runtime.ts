/**
 * Trust & Evidence Engine — TrustRegistry.
 * Registers named TrustManagers for multi-tenant / multi-scope wiring.
 */
import { TrustManager } from "./manager";

export class TrustRegistry {
  private readonly managers = new Map<string, TrustManager>();
  register(name: string, manager: TrustManager): TrustManager {
    this.managers.set(name, manager);
    return manager;
  }
  get(name: string): TrustManager | undefined { return this.managers.get(name); }
  has(name: string): boolean { return this.managers.has(name); }
  list(): readonly string[] { return Array.from(this.managers.keys()); }
  remove(name: string): void { this.managers.delete(name); }
  size(): number { return this.managers.size; }
  clear(): void { this.managers.clear(); }
}
