import { describe, expect, it } from "vitest";
import {
  CredentialResolver,
  InMemorySecretBackend,
  ProviderFactory,
  ProviderRegistry,
  ProviderResolver,
  MockProviderAdapter,
  ProviderGatewayRuntime,
  mockCapability,
  normalizeProviderError,
  ProviderCredentialFailureError,
  ProviderUnauthorizedError,
} from "@/lib/gateway";

describe("Provider Gateway credentials", () => {
  it("resolves fresh material for every execution", async () => {
    const backend = new InMemorySecretBackend();
    const ref = { ref: "TEST_PROVIDER_KEY", kind: "api-key" as const };
    backend.put({ ref: ref.ref, kind: ref.kind, material: "first-value" });
    const resolver = new CredentialResolver(backend);

    const first = await resolver.resolve(ref);
    backend.put({ ref: ref.ref, kind: ref.kind, material: "second-value" });
    const second = await resolver.resolve(ref);

    expect(first.material).toBe("first-value");
    expect(second.material).toBe("second-value");
    expect(first).not.toBe(second);
  });

  it("fails closed when a credential is missing", async () => {
    const resolver = new CredentialResolver(new InMemorySecretBackend());
    await expect(
      resolver.resolve({ ref: "MISSING_PROVIDER_KEY", kind: "api-key" }),
    ).rejects.toBeInstanceOf(ProviderCredentialFailureError);
    expect(resolver.credentialFailures()).toBe(1);
  });
});

describe("Provider Gateway routing", () => {
  it("selects deterministically by health, priority, cost, then id", async () => {
    const registry = new ProviderRegistry();
    const capability = mockCapability("travel.search", "RAILWAY");
    const make = (id: string, cost: number) => ProviderFactory.create({
      id,
      name: id,
      type: "mock",
      category: "RAILWAY",
      environment: "test",
      capabilities: [capability],
      pricing: { costPerRequest: cost, currency: "USD" },
    });

    await registry.register(new MockProviderAdapter(make("mock-a", 2)));
    await registry.register(new MockProviderAdapter(make("mock-b", 1)));
    for (const id of ["mock-a", "mock-b"]) {
      registry.setHealth(id, {
        status: "healthy",
        availability: "available",
        circuit: "closed",
        failureStreak: 0,
        successStreak: 1,
        lastCheckedAt: 1,
      });
    }

    const route = new ProviderResolver(registry).route({
      capability: capability.id,
      environment: "test",
    });
    expect(route.primary).toBe("mock-b");
    expect(route.fallbacks).toEqual(["mock-a"]);
  });
});

describe("Provider Gateway runtime", () => {
  it("publishes registration and health events to the injected audit port", async () => {
    const audit: Array<Record<string, unknown>> = [];
    const capability = mockCapability("travel.search", "RAILWAY");
    const provider = ProviderFactory.create({
      id: "mock-audit",
      name: "mock-audit",
      type: "mock",
      category: "RAILWAY",
      environment: "test",
      capabilities: [capability],
    });
    const runtime = new ProviderGatewayRuntime({
      ports: {
        audit: {
          async record(entry) {
            audit.push(entry as unknown as Record<string, unknown>);
          },
        },
      },
    });

    await runtime.register(new MockProviderAdapter(provider));
    await runtime.probe(provider.id);

    expect(audit.map((entry) => entry.action)).toEqual(["create", "update"]);
    expect(runtime.events.byName("ProviderRegistered")).toHaveLength(1);
    expect(runtime.events.byName("ProviderHealthChanged")).toHaveLength(1);
  });

  it("exposes immutable provider contracts and capability discovery", async () => {
    const capability = mockCapability("travel.search", "RAILWAY");
    const provider = ProviderFactory.create({
      id: "mock-contract",
      name: "mock-contract",
      type: "mock",
      category: "RAILWAY",
      environment: "test",
      capabilities: [capability],
    });
    const runtime = new ProviderGatewayRuntime();
    await runtime.register(new MockProviderAdapter(provider));

    const contract = runtime.providerContract(provider.id);
    expect(contract.providerId).toBe(provider.id);
    expect(contract.capabilities[0]?.id).toBe(capability.id);
    expect(runtime.discoverCapabilities()).toEqual([
      { id: capability.id, version: capability.version, providers: [provider.id] },
    ]);
    expect(Object.isFrozen(contract)).toBe(true);
  });
});

describe("Provider Gateway error normalization", () => {
  it("normalizes authentication failures", () => {
    const error = normalizeProviderError(
      { status: 401, message: "authentication failed" },
      { providerId: "provider-a", capability: "travel.search" },
    );
    expect(error).toBeInstanceOf(ProviderUnauthorizedError);
    expect(error.code).toBe("provider_unauthorized");
    expect(error.providerId).toBe("provider-a");
  });
});
