/**
 * Provider Runtime — Adapter factory.
 * Constructs the correct adapter stub for a given ProviderConfig.
 * Real vendor integrations register their own factories in later sprints.
 */
import type { ProviderAdapter } from "./adapter";
import { AdapterStubByKind } from "./adapters";
import { ProviderConfigurationError } from "./errors";
import type { ProviderConfig, ProviderKind } from "./types";

export type ProviderAdapterFactory = (config: ProviderConfig) => ProviderAdapter;

const factories = new Map<ProviderKind, ProviderAdapterFactory>();

for (const kind of Object.keys(AdapterStubByKind) as ProviderKind[]) {
  factories.set(kind, (cfg) => new AdapterStubByKind[kind](cfg));
}

export function registerProviderAdapterFactory(kind: ProviderKind, factory: ProviderAdapterFactory): void {
  factories.set(kind, factory);
}

export function createProviderAdapter(config: ProviderConfig): ProviderAdapter {
  const factory = factories.get(config.kind);
  if (!factory) {
    throw new ProviderConfigurationError(`No adapter factory registered for provider kind '${config.kind}'`);
  }
  return factory(config);
}
