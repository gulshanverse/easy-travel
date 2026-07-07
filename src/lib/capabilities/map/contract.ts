/**
 * MAP CAPABILITY CONTRACT.
 */
import { registerContract } from "@/lib/tios/contracts";
import { MapInputSchema, MapOutputSchema, type MapInput, type MapOutput } from "./types";
import { runMap } from "./service";

export function registerMapContract(): void {
  registerContract<MapInput, MapOutput>({
    id: "maps",
    displayName: "Map Intelligence",
    version: "1.1.0",
    description:
      "Provider-agnostic geospatial operations: routes, nearby search, distance, travel time, pins, saved places, heatmaps.",
    category: "logistics",
    lifecycle: "beta",
    inputSchema: MapInputSchema,
    outputSchema: MapOutputSchema,
    dependencies: [],
    requiredPermissions: [],
    supportedAgents: [],
    supportedProviders: ["mapbox", "osm"],
    priority: 70,
    featureFlags: ["Maps"],
    tags: ["geo", "provider-independent"],
    failureModes: ["provider_unavailable", "invalid_coordinates"],
    fallbackStrategy: "alternate-provider",
    retryStrategy: { maxAttempts: 2, backoffMs: 250 },
    sla: { availability: 0.998, p95LatencyMs: 900 },
    latencyTargetMs: 400,
    costCategory: "medium",
    securityClassification: "public",
    ownerModule: "capabilities/map",
    docsUrl: "/docs/CAPABILITIES.md#map",
    handler: async (input, ctx) => runMap(input, ctx),
  });
}
