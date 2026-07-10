/**
 * Provider Runtime — ProviderManager.
 * Manages the lifecycle of registered providers and provides a stable
 * façade for registering vendor configs + creating adapters via the factory.
 */
import type { ProviderAdapter } from "./adapter";
import { createProviderAdapter } from "./factory";
import type { ProviderRegistry, ProviderEntry } from "./registry";
import type { ProviderConfig, ProviderId } from "./types";

export class ProviderManager {
  constructor(private readonly registry: ProviderRegistry) {}

  async registerFromConfig(config: ProviderConfig): Promise<ProviderEntry> {
    const adapter = createProviderAdapter(config);
    return this.registry.register(config, adapter);
  }

  async registerWithAdapter(config: ProviderConfig, adapter: ProviderAdapter): Promise<ProviderEntry> {
    return this.registry.register(config, adapter);
  }

  async unregister(id: ProviderId): Promise<boolean> {
    return this.registry.unregister(id);
  }

  list(): readonly ProviderEntry[] { return this.registry.list(); }
}
