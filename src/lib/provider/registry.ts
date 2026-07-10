/**
 * Provider Runtime — Provider Registry, Discovery, Lifecycle.
 */
import type { ProviderAdapter } from "./adapter";
import { ProviderNotFoundError, ProviderRegistrationError } from "./errors";
import { defaultProviderEventPublisher, type ProviderEventPublisher } from "./events";
import type { ProviderConfig, ProviderId, ProviderKind, ProviderCapabilityFlags } from "./types";

export type ProviderLifecycleState = "registered" | "initializing" | "ready" | "disposed" | "failed";

export interface ProviderEntry {
  readonly config: ProviderConfig;
  readonly adapter: ProviderAdapter;
  state: ProviderLifecycleState;
  registeredAt: number;
  lastError?: Error;
}

export interface ProviderDiscoveryQuery {
  kind?: ProviderKind;
  enabled?: boolean;
  requires?: Partial<ProviderCapabilityFlags>;
  tag?: string;
  region?: string;
}

export class ProviderRegistry {
  private entries = new Map<ProviderId, ProviderEntry>();
  constructor(private readonly publisher: ProviderEventPublisher = defaultProviderEventPublisher) {}

  async register(config: ProviderConfig, adapter: ProviderAdapter): Promise<ProviderEntry> {
    if (this.entries.has(config.id)) {
      throw new ProviderRegistrationError(`Provider '${config.id}' already registered`);
    }
    const entry: ProviderEntry = {
      config,
      adapter,
      state: "initializing",
      registeredAt: Date.now(),
    };
    this.entries.set(config.id, entry);
    try {
      await adapter.onRegister?.();
      entry.state = "ready";
      await this.publisher.publish({
        name: "ProviderRegistered",
        correlationId: config.id,
        data: { providerId: config.id, kind: config.kind },
      });
    } catch (err) {
      entry.state = "failed";
      entry.lastError = err as Error;
      throw new ProviderRegistrationError(`Failed to initialize provider '${config.id}'`, { cause: err });
    }
    return entry;
  }

  async unregister(id: ProviderId): Promise<boolean> {
    const entry = this.entries.get(id);
    if (!entry) return false;
    try {
      await entry.adapter.onDispose?.();
    } finally {
      entry.state = "disposed";
      this.entries.delete(id);
      await this.publisher.publish({
        name: "ProviderUnregistered",
        correlationId: id,
        data: { providerId: id },
      });
    }
    return true;
  }

  get(id: ProviderId): ProviderEntry | undefined { return this.entries.get(id); }

  require(id: ProviderId): ProviderEntry {
    const e = this.entries.get(id);
    if (!e) throw new ProviderNotFoundError(`Provider '${id}' not registered`);
    return e;
  }

  list(): readonly ProviderEntry[] { return [...this.entries.values()]; }

  discover(query: ProviderDiscoveryQuery = {}): readonly ProviderEntry[] {
    return this.list().filter((e) => {
      const c = e.config;
      if (query.kind && c.kind !== query.kind) return false;
      if (query.enabled !== undefined && (c.enabled ?? true) !== query.enabled) return false;
      if (query.tag && !(c.tags ?? []).includes(query.tag)) return false;
      if (query.region && !(c.regions ?? []).includes(query.region)) return false;
      if (query.requires) {
        for (const k of Object.keys(query.requires) as (keyof ProviderCapabilityFlags)[]) {
          if (query.requires[k] && !c.capabilities[k]) return false;
        }
      }
      return true;
    });
  }

  size(): number { return this.entries.size; }
  clear(): void { this.entries.clear(); }
}
