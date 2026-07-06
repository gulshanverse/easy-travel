/**
 * TIOS Capability Registry.
 * Every intelligent capability of Easy Trip registers itself here.
 * The registry is the single source of truth for "what can TIOS do right now?".
 */
import { emitTIOSEvent, makeRequestId } from "./events";
import type {
  CapabilityId, CapabilityManifest, CapabilityRuntime, HealthStatus,
} from "./types";

const registry = new Map<CapabilityId, CapabilityRuntime>();

export function registerCapability(
  manifest: CapabilityManifest,
  invoke?: CapabilityRuntime["invoke"],
): CapabilityRuntime {
  const existing = registry.get(manifest.id);
  const runtime: CapabilityRuntime = {
    manifest,
    health: existing?.health ?? "unknown",
    registeredAt: existing?.registeredAt ?? Date.now(),
    invoke: invoke ?? existing?.invoke,
  };
  registry.set(manifest.id, runtime);
  emitTIOSEvent({
    name: existing ? "CAPABILITY_UPDATED" : "CAPABILITY_REGISTERED",
    requestId: makeRequestId("cap"),
    timestamp: Date.now(),
    capability: manifest.id,
    data: { version: manifest.version },
  });
  return runtime;
}

export function getCapability(id: CapabilityId): CapabilityRuntime | undefined {
  return registry.get(id);
}

export function listCapabilities(): CapabilityRuntime[] {
  return Array.from(registry.values()).sort(
    (a, b) => b.manifest.priority - a.manifest.priority,
  );
}

export function setCapabilityHealth(id: CapabilityId, health: HealthStatus): void {
  const c = registry.get(id);
  if (!c) return;
  if (c.health === health) return;
  c.health = health;
  emitTIOSEvent({
    name: "CAPABILITY_HEALTH_CHANGED",
    requestId: makeRequestId("cap"),
    timestamp: Date.now(),
    capability: id,
    data: { health },
  });
}

export function unregisterCapability(id: CapabilityId): void {
  registry.delete(id);
}

// ------- Seed default capability manifests (interfaces only) -------
const SEED: CapabilityManifest[] = [
  { id: "planner", version: "1.0.0", description: "AI itinerary planner", dependencies: ["weather", "budget"], permissions: ["trip:read", "trip:write"], supportedAgents: ["planner"], supportedProviders: ["gemini", "openai"], priority: 90, featureFlags: ["PlannerV2"] },
  { id: "budget", version: "1.0.0", description: "Budget estimation & tracking", dependencies: ["currency"], permissions: ["budget:read"], supportedAgents: ["budget"], supportedProviders: ["gemini"], priority: 80, featureFlags: ["BudgetV2"] },
  { id: "weather", version: "1.0.0", description: "Weather forecasts & advisories", dependencies: [], permissions: [], supportedAgents: [], supportedProviders: ["open-meteo"], priority: 70, featureFlags: ["Weather"] },
  { id: "maps", version: "1.0.0", description: "Geocoding, routing, POIs", dependencies: [], permissions: [], supportedAgents: [], supportedProviders: ["mapbox"], priority: 70, featureFlags: ["Maps"] },
  { id: "flights", version: "1.0.0", description: "Flight search & meta-booking", dependencies: ["currency"], permissions: [], supportedAgents: [], supportedProviders: [], priority: 85, featureFlags: [] },
  { id: "hotels", version: "1.0.0", description: "Hotel search & booking", dependencies: ["currency"], permissions: [], supportedAgents: [], supportedProviders: [], priority: 85, featureFlags: [] },
  { id: "restaurants", version: "1.0.0", description: "Restaurant discovery", dependencies: [], permissions: [], supportedAgents: [], supportedProviders: [], priority: 60, featureFlags: [] },
  { id: "experiences", version: "1.0.0", description: "Activities & experiences", dependencies: [], permissions: [], supportedAgents: [], supportedProviders: [], priority: 60, featureFlags: [] },
  { id: "packing", version: "1.0.0", description: "Packing list generator", dependencies: ["weather"], permissions: [], supportedAgents: ["packing"], supportedProviders: ["gemini"], priority: 40, featureFlags: [] },
  { id: "translator", version: "1.0.0", description: "Phrase translation & guides", dependencies: [], permissions: [], supportedAgents: ["translator"], supportedProviders: ["gemini"], priority: 40, featureFlags: [] },
  { id: "visa", version: "1.0.0", description: "Visa requirements", dependencies: [], permissions: [], supportedAgents: [], supportedProviders: [], priority: 65, featureFlags: [] },
  { id: "booking", version: "1.0.0", description: "Booking orchestration", dependencies: ["flights", "hotels"], permissions: ["booking:write"], supportedAgents: [], supportedProviders: [], priority: 95, featureFlags: [] },
  { id: "safety", version: "1.0.0", description: "Travel safety & advisories", dependencies: [], permissions: [], supportedAgents: ["safety"], supportedProviders: ["gemini"], priority: 75, featureFlags: [] },
  { id: "emergency", version: "1.0.0", description: "Emergency contacts & SOS", dependencies: [], permissions: [], supportedAgents: [], supportedProviders: [], priority: 100, featureFlags: [] },
  { id: "notifications", version: "1.0.0", description: "User notifications", dependencies: [], permissions: [], supportedAgents: [], supportedProviders: [], priority: 50, featureFlags: [] },
  { id: "calendar", version: "1.0.0", description: "Calendar sync", dependencies: [], permissions: [], supportedAgents: [], supportedProviders: [], priority: 40, featureFlags: [] },
  { id: "currency", version: "1.0.0", description: "FX & currency conversion", dependencies: [], permissions: [], supportedAgents: [], supportedProviders: [], priority: 55, featureFlags: [] },
  { id: "reviews", version: "1.0.0", description: "Aggregated reviews", dependencies: [], permissions: [], supportedAgents: [], supportedProviders: [], priority: 45, featureFlags: [] },
  { id: "analytics", version: "1.0.0", description: "Product analytics", dependencies: [], permissions: [], supportedAgents: [], supportedProviders: [], priority: 30, featureFlags: [] },
];

let seeded = false;
export function ensureSeeded(): void {
  if (seeded) return;
  seeded = true;
  for (const m of SEED) registerCapability(m);
}
ensureSeeded();
