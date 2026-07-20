/** CTOR — Capability & Tool registries. */
import { CapabilityAlreadyRegisteredError, CapabilityNotFoundError, ToolAlreadyRegisteredError, ToolNotFoundError } from "./errors";
import type {
  Capability, CapabilityHealthState, CapabilityHistoryEntry, CapabilitySnapshot, CapabilityStatistics,
  CapabilityStatus, Tool, ToolHealthState, ToolHistoryEntry, ToolSnapshot, ToolStatistics, ToolStatus,
} from "./types";
import { transitionCapability, transitionTool } from "./lifecycle";
import type { CTORContractSource, CTORCapabilityContract } from "./ports";
import { makeCapability } from "./factories";

export class CapabilityRegistry {
  private readonly items = new Map<string, Capability>();
  private readonly history = new Map<string, CapabilityHistoryEntry[]>();
  private readonly stats = new Map<string, CapabilityStatistics>();
  private readonly healthState = new Map<string, CapabilityHealthState>();

  register(cap: Capability): Capability {
    if (this.items.has(cap.id)) throw new CapabilityAlreadyRegisteredError(cap.id);
    this.items.set(cap.id, cap);
    this.history.set(cap.id, [{ at: Date.now(), status: cap.status }]);
    this.stats.set(cap.id, { invocations: 0, successes: 0, failures: 0, totalDurationMs: 0 });
    this.healthState.set(cap.id, { healthy: true, checkedAt: Date.now() });
    return cap;
  }
  update(id: string, patch: Partial<Capability>): Capability {
    const cur = this.get(id);
    const next: Capability = Object.freeze({ ...cur, ...patch, id: cur.id, contract: cur.contract, metadata: Object.freeze({ ...cur.metadata, ...(patch.metadata ?? {}), updatedAt: Date.now() }) });
    this.items.set(id, next);
    this.history.get(id)!.push({ at: Date.now(), status: next.status, note: "updated" });
    return next;
  }
  transition(id: string, to: CapabilityStatus, note?: string): Capability {
    const cur = this.get(id);
    const status = transitionCapability(cur.status, to);
    return this.update(id, { status } as Partial<Capability>).status === status
      ? this.items.get(id)!
      : (this.history.get(id)!.push({ at: Date.now(), status, note }), this.items.get(id)!);
  }
  remove(id: string): void {
    if (!this.items.has(id)) throw new CapabilityNotFoundError(id);
    this.items.delete(id);
    this.history.get(id)?.push({ at: Date.now(), status: "removed" });
  }
  get(id: string): Capability {
    const c = this.items.get(id);
    if (!c) throw new CapabilityNotFoundError(id);
    return c;
  }
  has(id: string): boolean { return this.items.has(id); }
  list(): readonly Capability[] { return [...this.items.values()]; }
  find(predicate: (c: Capability) => boolean): readonly Capability[] { return this.list().filter(predicate); }
  snapshot(id: string): CapabilitySnapshot { return Object.freeze({ capability: this.get(id), takenAt: Date.now() }); }
  getHistory(id: string): readonly CapabilityHistoryEntry[] { return this.history.get(id) ?? []; }
  getStatistics(id: string): CapabilityStatistics { return { ...(this.stats.get(id) ?? { invocations: 0, successes: 0, failures: 0, totalDurationMs: 0 }) }; }
  recordInvocation(id: string, ok: boolean, ms: number): void {
    const s = this.stats.get(id); if (!s) return;
    s.invocations++; if (ok) s.successes++; else s.failures++; s.totalDurationMs += ms;
  }
  setHealth(id: string, h: Omit<CapabilityHealthState, "checkedAt">): void {
    this.healthState.set(id, { ...h, checkedAt: Date.now() });
  }
  getHealth(id: string): CapabilityHealthState { return this.healthState.get(id) ?? { healthy: true, checkedAt: Date.now() }; }
  size(): number { return this.items.size; }
  clear(): void { this.items.clear(); this.history.clear(); this.stats.clear(); this.healthState.clear(); }

  /** Discover capabilities from a contract source. */
  async discover(source: CTORContractSource): Promise<readonly Capability[]> {
    const contracts = await source.discover();
    const created: Capability[] = [];
    for (const c of contracts) {
      if (this.items.has(c.id)) continue;
      created.push(this.register(makeCapability({
        id: c.id, name: c.name, version: c.version, owner: c.owner,
        dependencies: (c.dependencies ?? []).map(d => ({ capabilityId: d.capabilityId, versionRange: d.versionRange })),
        contract: { ports: c.ports ?? [] },
        tags: c.features ?? [],
      })));
    }
    return created;
  }

  /** Version compatibility (major.minor.patch — accepts >= major match). */
  isVersionCompatible(id: string, required?: string): boolean {
    if (!required) return true;
    const cap = this.items.get(id); if (!cap) return false;
    const [maj] = cap.version.split(".");
    const [rmaj] = required.replace(/^[^\d]*/, "").split(".");
    return maj === rmaj;
  }
}

export class ToolRegistry {
  private readonly items = new Map<string, Tool>();
  private readonly history = new Map<string, ToolHistoryEntry[]>();
  private readonly stats = new Map<string, ToolStatistics>();
  private readonly healthState = new Map<string, ToolHealthState>();
  private readonly impls = new Map<string, (input: Readonly<Record<string, unknown>>) => Promise<unknown> | unknown>();

  register(tool: Tool, impl?: (input: Readonly<Record<string, unknown>>) => Promise<unknown> | unknown): Tool {
    if (this.items.has(tool.id)) throw new ToolAlreadyRegisteredError(tool.id);
    this.items.set(tool.id, tool);
    this.history.set(tool.id, [{ at: Date.now(), status: tool.status }]);
    this.stats.set(tool.id, { invocations: 0, successes: 0, failures: 0, totalDurationMs: 0 });
    this.healthState.set(tool.id, { healthy: true, checkedAt: Date.now() });
    if (impl) this.impls.set(tool.id, impl);
    return tool;
  }
  attachImpl(id: string, impl: (input: Readonly<Record<string, unknown>>) => Promise<unknown> | unknown): void {
    if (!this.items.has(id)) throw new ToolNotFoundError(id);
    this.impls.set(id, impl);
  }
  transition(id: string, to: ToolStatus, note?: string): Tool {
    const cur = this.get(id);
    const next: Tool = Object.freeze({ ...cur, status: transitionTool(cur.status, to) });
    this.items.set(id, next);
    this.history.get(id)!.push({ at: Date.now(), status: next.status, note });
    return next;
  }
  remove(id: string): void {
    if (!this.items.has(id)) throw new ToolNotFoundError(id);
    this.items.delete(id);
    this.impls.delete(id);
    this.history.get(id)?.push({ at: Date.now(), status: "removed" });
  }
  get(id: string): Tool {
    const t = this.items.get(id);
    if (!t) throw new ToolNotFoundError(id);
    return t;
  }
  has(id: string): boolean { return this.items.has(id); }
  list(): readonly Tool[] { return [...this.items.values()]; }
  snapshot(id: string): ToolSnapshot { return Object.freeze({ tool: this.get(id), takenAt: Date.now() }); }
  getImpl(id: string) { return this.impls.get(id); }
  getHistory(id: string): readonly ToolHistoryEntry[] { return this.history.get(id) ?? []; }
  getStatistics(id: string): ToolStatistics { return { ...(this.stats.get(id) ?? { invocations: 0, successes: 0, failures: 0, totalDurationMs: 0 }) }; }
  recordInvocation(id: string, ok: boolean, ms: number): void {
    const s = this.stats.get(id); if (!s) return;
    s.invocations++; if (ok) s.successes++; else s.failures++; s.totalDurationMs += ms;
  }
  size(): number { return this.items.size; }
  clear(): void { this.items.clear(); this.impls.clear(); this.history.clear(); this.stats.clear(); this.healthState.clear(); }
}
