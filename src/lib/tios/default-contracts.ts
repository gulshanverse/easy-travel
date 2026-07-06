/**
 * TIOS — Default Capability Contracts.
 * Ships interface-only contracts for the 19 seeded capabilities so future
 * milestones (Planner v1, Flights, Hotels, …) only need to attach handlers.
 *
 * All contracts default to lifecycle "experimental" until their owning
 * milestone promotes them.
 */
import { registerContract, z, type CapabilityContract } from "./contracts";
import type { CapabilityId } from "./types";

const empty = z.object({}).passthrough();

// Use `any` for the array element type so heterogeneous Zod-inferred contracts
// remain assignable. Individual contracts stay strongly typed at their call sites.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function contract(c: CapabilityContract<any, any>): CapabilityContract<any, any> {
  return c;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const defaults: Array<CapabilityContract<any, any>> = [
  contract({
    id: "planner", displayName: "Trip Planner", version: "1.0.0",
    description: "Generates day-by-day itineraries.",
    category: "planning", lifecycle: "experimental",
    inputSchema: empty, outputSchema: empty,
    dependencies: ["weather", "budget"], requiredPermissions: ["trip:read", "trip:write"],
    supportedAgents: ["planner"], supportedProviders: ["gemini", "openai"],
    priority: 90, featureFlags: ["PlannerV2"], tags: ["ai", "planning"],
  }),
  contract({
    id: "budget", displayName: "Budget Estimator", version: "1.0.0",
    description: "Estimates and tracks trip budget.",
    category: "financial", lifecycle: "experimental",
    inputSchema: empty, outputSchema: empty,
    dependencies: ["currency"], requiredPermissions: ["budget:read"],
    supportedAgents: ["budget"], supportedProviders: ["gemini"],
    priority: 80, featureFlags: ["BudgetV2"], tags: ["ai", "money"],
  }),
  contract({
    id: "weather", displayName: "Weather", version: "1.0.0",
    description: "Weather forecasts and severe-weather advisories.",
    category: "insights", lifecycle: "experimental",
    inputSchema: empty, outputSchema: empty,
    dependencies: [], requiredPermissions: [],
    supportedAgents: [], supportedProviders: ["open-meteo"],
    priority: 70, featureFlags: ["Weather"], tags: ["environment"],
  }),
  contract({
    id: "maps", displayName: "Maps", version: "1.0.0",
    description: "Geocoding, routing, POI lookup.",
    category: "logistics", lifecycle: "experimental",
    inputSchema: empty, outputSchema: empty,
    dependencies: [], requiredPermissions: [],
    supportedAgents: [], supportedProviders: ["mapbox"],
    priority: 70, featureFlags: ["Maps"], tags: ["geo"],
  }),
  contract({
    id: "flights", displayName: "Flights", version: "1.0.0",
    description: "Flight search and meta-booking.",
    category: "booking", lifecycle: "experimental",
    inputSchema: empty, outputSchema: empty,
    dependencies: ["currency"], requiredPermissions: [],
    supportedAgents: [], supportedProviders: [],
    priority: 85, featureFlags: [], tags: ["transport"],
  }),
  contract({
    id: "hotels", displayName: "Hotels", version: "1.0.0",
    description: "Hotel search and booking.",
    category: "booking", lifecycle: "experimental",
    inputSchema: empty, outputSchema: empty,
    dependencies: ["currency"], requiredPermissions: [],
    supportedAgents: [], supportedProviders: [],
    priority: 85, featureFlags: [], tags: ["stay"],
  }),
  contract({
    id: "restaurants", displayName: "Restaurants", version: "1.0.0",
    description: "Restaurant discovery and recommendations.",
    category: "discovery", lifecycle: "experimental",
    inputSchema: empty, outputSchema: empty,
    dependencies: [], requiredPermissions: [],
    supportedAgents: [], supportedProviders: [],
    priority: 60, featureFlags: [], tags: ["food"],
  }),
  contract({
    id: "experiences", displayName: "Experiences", version: "1.0.0",
    description: "Activities, tours, and experiences.",
    category: "discovery", lifecycle: "experimental",
    inputSchema: empty, outputSchema: empty,
    dependencies: [], requiredPermissions: [],
    supportedAgents: [], supportedProviders: [],
    priority: 60, featureFlags: [], tags: ["activities"],
  }),
  contract({
    id: "packing", displayName: "Packing Assistant", version: "1.0.0",
    description: "Packing list generator.",
    category: "assistance", lifecycle: "experimental",
    inputSchema: empty, outputSchema: empty,
    dependencies: ["weather"], requiredPermissions: [],
    supportedAgents: ["packing"], supportedProviders: ["gemini"],
    priority: 40, featureFlags: [], tags: ["ai"],
  }),
  contract({
    id: "translator", displayName: "Translator", version: "1.0.0",
    description: "Phrase translation and language guides.",
    category: "assistance", lifecycle: "experimental",
    inputSchema: empty, outputSchema: empty,
    dependencies: [], requiredPermissions: [],
    supportedAgents: ["translator"], supportedProviders: ["gemini"],
    priority: 40, featureFlags: [], tags: ["ai", "language"],
  }),
  contract({
    id: "visa", displayName: "Visa Advisor", version: "1.0.0",
    description: "Visa requirements and processing guidance.",
    category: "assistance", lifecycle: "experimental",
    inputSchema: empty, outputSchema: empty,
    dependencies: [], requiredPermissions: [],
    supportedAgents: [], supportedProviders: [],
    priority: 65, featureFlags: [], tags: ["docs"],
  }),
  contract({
    id: "booking", displayName: "Booking Orchestrator", version: "1.0.0",
    description: "End-to-end booking orchestration.",
    category: "booking", lifecycle: "experimental",
    inputSchema: empty, outputSchema: empty,
    dependencies: ["flights", "hotels"], requiredPermissions: ["booking:write"],
    supportedAgents: [], supportedProviders: [],
    priority: 95, featureFlags: [], tags: ["core"],
  }),
  contract({
    id: "safety", displayName: "Safety Advisor", version: "1.0.0",
    description: "Travel safety and advisory summaries.",
    category: "safety", lifecycle: "experimental",
    inputSchema: empty, outputSchema: empty,
    dependencies: [], requiredPermissions: [],
    supportedAgents: ["safety"], supportedProviders: ["gemini"],
    priority: 75, featureFlags: [], tags: ["ai"],
  }),
  contract({
    id: "emergency", displayName: "Emergency", version: "1.0.0",
    description: "Emergency contacts and SOS routing.",
    category: "safety", lifecycle: "experimental",
    inputSchema: empty, outputSchema: empty,
    dependencies: [], requiredPermissions: [],
    supportedAgents: [], supportedProviders: [],
    priority: 100, featureFlags: [], tags: ["critical"],
  }),
  contract({
    id: "notifications", displayName: "Notifications", version: "1.0.0",
    description: "User notification delivery.",
    category: "communications", lifecycle: "experimental",
    inputSchema: empty, outputSchema: empty,
    dependencies: [], requiredPermissions: [],
    supportedAgents: [], supportedProviders: [],
    priority: 50, featureFlags: [], tags: [],
  }),
  contract({
    id: "calendar", displayName: "Calendar Sync", version: "1.0.0",
    description: "External calendar synchronization.",
    category: "logistics", lifecycle: "experimental",
    inputSchema: empty, outputSchema: empty,
    dependencies: [], requiredPermissions: [],
    supportedAgents: [], supportedProviders: [],
    priority: 40, featureFlags: [], tags: [],
  }),
  contract({
    id: "currency", displayName: "Currency & FX", version: "1.0.0",
    description: "FX rates and currency conversion.",
    category: "financial", lifecycle: "experimental",
    inputSchema: empty, outputSchema: empty,
    dependencies: [], requiredPermissions: [],
    supportedAgents: [], supportedProviders: [],
    priority: 55, featureFlags: [], tags: [],
  }),
  contract({
    id: "reviews", displayName: "Reviews", version: "1.0.0",
    description: "Aggregated reviews and ratings.",
    category: "insights", lifecycle: "experimental",
    inputSchema: empty, outputSchema: empty,
    dependencies: [], requiredPermissions: [],
    supportedAgents: [], supportedProviders: [],
    priority: 45, featureFlags: [], tags: [],
  }),
  contract({
    id: "analytics", displayName: "Analytics", version: "1.0.0",
    description: "Product analytics and behavioral insights.",
    category: "infrastructure", lifecycle: "experimental",
    inputSchema: empty, outputSchema: empty,
    dependencies: [], requiredPermissions: [],
    supportedAgents: [], supportedProviders: [],
    priority: 30, featureFlags: [], tags: [],
  }),
];

let seeded = false;
export function ensureDefaultContracts(): void {
  if (seeded) return;
  seeded = true;
  for (const c of defaults) registerContract(c);
}
ensureDefaultContracts();

export const DEFAULT_CONTRACT_IDS: CapabilityId[] = defaults.map((c) => c.id);
