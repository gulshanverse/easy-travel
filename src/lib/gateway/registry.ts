/** Provider Gateway (P-1.4) — registry, factory, resolver, health manager. */
import type { ProviderAdapter } from "./adapter";
import { ProviderCapabilityRegistry } from "./capabilities";
import { ProviderNotFoundError, ProviderUnsupportedCapabilityError } from "./errors";
import { mergeProviderLimits, mergeProviderPolicy } from "./policies";
import { EndpointAllowlist } from "./security";
import type {
  Provider,
  ProviderAvailability,
  ProviderCapability,
  ProviderCapabilityId,
  ProviderEnvironment,
  ProviderHealth,
  ProviderId,
  ProviderRoute,
} from "./types";

export interface ProviderDefinition {
  readonly id: ProviderId;
  readonly name: string;
  readonly type: Provider["type"];
  readonly category: Provider["category"];
  readonly environment: ProviderEnvironment;
  readonly auth?: Provider["auth"];
  readonly credentialRef?: Provider["credentialRef"];
  readonly endpoints?: Provider["endpoints"];
  readonly limits?: Partial<Provider["limits"]>;
  readonly pricing?: Provider["pricing"];
  readonly quota?: Provider["quota"];
  readonly policy?: Partial<Provider["policy"]>;
  readonly metadata?: Partial<Provider["metadata"]>;
  readonly capabilities: readonly ProviderCapability[];
  readonly version?: Provider["version"];
}

/** Builds immutable Provider models from definitions. */
export class ProviderFactory {
  static create(def: ProviderDefinition, now = Date.now()): Provider {
    return Object.freeze({
      id: def.id,
      name: def.name,
      type: def.type,
      category: def.category,
      environment: def.environment,
      version: def.version ?? { major: 1, minor: 0, patch: 0 },
      auth: def.auth ?? "none",
      ...(def.credentialRef ? { credentialRef: def.credentialRef } : {}),
      endpoints: Object.freeze([...(def.endpoints ?? [])]),
      limits: mergeProviderLimits(def.limits),
      pricing: def.pricing ?? { costPerRequest: 0, currency: "USD" },
      quota: def.quota ?? {},
      policy: mergeProviderPolicy(def.policy),
      metadata: Object.freeze({
        tags: [],
        labels: {},
        ...(def.metadata ?? {}),
      }) as Provider["metadata"],
      capabilities: Object.freeze([...def.capabilities]),
      status: "enabled" as const,
      registeredAt: now,
    });
  }
}

export interface ProviderEntry {
  readonly provider: Provider;
  readonly adapter: ProviderAdapter;
  health: ProviderHealth;
}

export class ProviderRegistry {
  private entries = new Map<ProviderId, ProviderEntry>();
  readonly capabilities = new ProviderCapabilityRegistry();
  readonly allowlist = new EndpointAllowlist();

  async register(adapter: ProviderAdapter): Promise<ProviderEntry> {
    const provider = adapter.provider;
    for (const ep of provider.endpoints) this.allowlist.allow(provider.id, ep.url);
    const entry: ProviderEntry = {
      provider,
      adapter,
      health: {
        status: "unknown",
        availability: "unknown",
        circuit: "closed",
        failureStreak: 0,
        successStreak: 0,
        lastCheckedAt: Date.now(),
      },
    };
    this.entries.set(provider.id, entry);
    for (const cap of provider.capabilities) this.capabilities.register(provider.id, cap);
    await adapter.onRegister?.();
    return entry;
  }

  async unregister(id: ProviderId): Promise<boolean> {
    const entry = this.entries.get(id);
    if (!entry) return false;
    await entry.adapter.onDispose?.();
    this.entries.delete(id);
    this.capabilities.unregisterProvider(id);
    return true;
  }

  get(id: ProviderId): ProviderEntry | undefined {
    return this.entries.get(id);
  }
  require(id: ProviderId): ProviderEntry {
    const e = this.entries.get(id);
    if (!e) throw new ProviderNotFoundError(`provider '${id}' is not registered`);
    return e;
  }
  list(): readonly ProviderEntry[] {
    return [...this.entries.values()].sort((a, b) => (a.provider.id < b.provider.id ? -1 : 1));
  }
  setStatus(id: ProviderId, status: Provider["status"]): void {
    const e = this.require(id);
    this.entries.set(id, { ...e, provider: Object.freeze({ ...e.provider, status }) });
  }
  setHealth(id: ProviderId, health: ProviderHealth): void {
    const e = this.entries.get(id);
    if (e) e.health = health;
  }
  size(): number {
    return this.entries.size;
  }
  clear(): void {
    this.entries.clear();
    this.capabilities.clear();
    this.allowlist.clear();
  }
}

/* ------------------------------------------------------------------ */
/* Deterministic resolution                                            */
/* ------------------------------------------------------------------ */

export interface ResolutionCriteria {
  readonly capability: ProviderCapabilityId;
  readonly environment: ProviderEnvironment;
  readonly region?: string;
  readonly providerId?: ProviderId;
  readonly maxCost?: number;
  readonly sandboxOnly?: boolean;
}

const AVAILABILITY_RANK: Record<ProviderAvailability, number> = {
  available: 0,
  unknown: 1,
  limited: 2,
  unavailable: 3,
};

const HEALTH_RANK: Record<ProviderHealth["status"], number> = {
  healthy: 0,
  unknown: 1,
  degraded: 2,
  unhealthy: 3,
};

/** Deterministic, policy-driven selection (ADR-036). No LLM involvement. */
export class ProviderResolver {
  constructor(private readonly registry: ProviderRegistry) {}

  candidates(criteria: ResolutionCriteria): readonly ProviderEntry[] {
    return this.registry
      .list()
      .filter((e) => {
        const p = e.provider;
        if (p.status !== "enabled" && p.status !== "degraded") return false;
        if (criteria.providerId && p.id !== criteria.providerId) return false;
        if (criteria.sandboxOnly && p.type === "live") return false;
        if (criteria.region && p.metadata.region && p.metadata.region !== criteria.region)
          return false;
        if (criteria.maxCost !== undefined && p.pricing.costPerRequest > criteria.maxCost)
          return false;
        const cap = p.capabilities.find((c) => c.id === criteria.capability);
        if (!cap) return false;
        if (!cap.environments.includes(criteria.environment)) return false;
        return true;
      })
      .sort((a, b) => {
        const ah = HEALTH_RANK[a.health.status] - HEALTH_RANK[b.health.status];
        if (ah !== 0) return ah;
        const av = AVAILABILITY_RANK[a.health.availability] - AVAILABILITY_RANK[b.health.availability];
        if (av !== 0) return av;
        const pr = b.provider.policy.priority - a.provider.policy.priority;
        if (pr !== 0) return pr;
        const cost = a.provider.pricing.costPerRequest - b.provider.pricing.costPerRequest;
        if (cost !== 0) return cost;
        // Stable tie-break on provider id.
        return a.provider.id < b.provider.id ? -1 : a.provider.id > b.provider.id ? 1 : 0;
      });
  }

  route(criteria: ResolutionCriteria): ProviderRoute {
    const list = this.candidates(criteria);
    if (list.length === 0)
      throw new ProviderUnsupportedCapabilityError(
        `no provider supports capability '${criteria.capability}' in ${criteria.environment}`,
        { capability: criteria.capability },
      );
    return Object.freeze({
      capability: criteria.capability,
      primary: list[0]!.provider.id,
      fallbacks: Object.freeze(list.slice(1).map((e) => e.provider.id)),
      reason: "deterministic: health → availability → priority → cost → id",
    });
  }
}

/* ------------------------------------------------------------------ */
/* Health                                                              */
/* ------------------------------------------------------------------ */

export class ProviderHealthManager {
  constructor(private readonly registry: ProviderRegistry) {}

  async probe(id: ProviderId): Promise<ProviderHealth> {
    const entry = this.registry.require(id);
    let health: ProviderHealth;
    try {
      health = await entry.adapter.healthCheck();
    } catch {
      health = {
        status: "unhealthy",
        availability: "unavailable",
        circuit: "closed",
        failureStreak: entry.health.failureStreak + 1,
        successStreak: 0,
        lastCheckedAt: Date.now(),
        reason: "health check failed",
      };
    }
    this.registry.setHealth(id, health);
    return health;
  }

  async report(): Promise<readonly { providerId: ProviderId; health: ProviderHealth }[]> {
    const out: { providerId: ProviderId; health: ProviderHealth }[] = [];
    for (const e of this.registry.list())
      out.push({ providerId: e.provider.id, health: await this.probe(e.provider.id) });
    return out;
  }
}
