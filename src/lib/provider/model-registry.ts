/**
 * Provider Runtime — Model Registry.
 * Register, discover, and validate model compatibility. Never calls providers.
 */
import { ModelIncompatibleError, ModelNotFoundError, ProviderRegistrationError } from "./errors";
import { matchesCapabilities } from "./capabilities";
import type {
  ModelDescriptor,
  ModelId,
  ProviderCapabilityFlags,
  ProviderId,
} from "./types";

export interface ModelDiscoveryQuery {
  providerId?: ProviderId;
  requires?: Partial<ProviderCapabilityFlags>;
  minContextWindow?: number;
  status?: ModelDescriptor["status"] | readonly ModelDescriptor["status"][];
  availability?: ModelDescriptor["availability"] | readonly ModelDescriptor["availability"][];
  tag?: string;
}

export class ModelRegistry {
  private byId = new Map<ModelId, ModelDescriptor>();
  private byProvider = new Map<ProviderId, Set<ModelId>>();

  register(descriptor: ModelDescriptor): void {
    if (!descriptor.id) throw new ProviderRegistrationError("ModelDescriptor.id required");
    if (this.byId.has(descriptor.id)) {
      throw new ProviderRegistrationError(`Model '${descriptor.id}' already registered`);
    }
    this.byId.set(descriptor.id, Object.freeze({ ...descriptor }));
    let set = this.byProvider.get(descriptor.providerId);
    if (!set) { set = new Set(); this.byProvider.set(descriptor.providerId, set); }
    set.add(descriptor.id);
  }

  unregister(id: ModelId): boolean {
    const m = this.byId.get(id);
    if (!m) return false;
    this.byId.delete(id);
    this.byProvider.get(m.providerId)?.delete(id);
    return true;
  }

  get(id: ModelId): ModelDescriptor | undefined { return this.byId.get(id); }

  require(id: ModelId): ModelDescriptor {
    const m = this.byId.get(id);
    if (!m) throw new ModelNotFoundError(`Model '${id}' not registered`);
    return m;
  }

  list(): readonly ModelDescriptor[] { return [...this.byId.values()]; }

  listByProvider(providerId: ProviderId): readonly ModelDescriptor[] {
    const ids = this.byProvider.get(providerId);
    if (!ids) return [];
    return [...ids].map((id) => this.byId.get(id)!).filter(Boolean);
  }

  discover(query: ModelDiscoveryQuery = {}): readonly ModelDescriptor[] {
    const statuses = query.status
      ? (Array.isArray(query.status) ? query.status : [query.status])
      : undefined;
    const availabilities = query.availability
      ? (Array.isArray(query.availability) ? query.availability : [query.availability])
      : undefined;

    return this.list().filter((m) => {
      if (query.providerId && m.providerId !== query.providerId) return false;
      if (statuses && !statuses.includes(m.status)) return false;
      if (availabilities && !availabilities.includes(m.availability)) return false;
      if (query.minContextWindow && m.contextWindow < query.minContextWindow) return false;
      if (query.requires && !matchesCapabilities(m, query.requires)) return false;
      if (query.tag && !(m.tags ?? []).includes(query.tag)) return false;
      return true;
    });
  }

  validateCompatibility(id: ModelId, required: Partial<ProviderCapabilityFlags>, minContextWindow?: number): ModelDescriptor {
    const model = this.require(id);
    if (!matchesCapabilities(model, required)) {
      throw new ModelIncompatibleError(`Model '${id}' does not satisfy required capabilities`);
    }
    if (minContextWindow && model.contextWindow < minContextWindow) {
      throw new ModelIncompatibleError(`Model '${id}' context window ${model.contextWindow} < ${minContextWindow}`);
    }
    return model;
  }

  size(): number { return this.byId.size; }
  clear(): void { this.byId.clear(); this.byProvider.clear(); }
}
