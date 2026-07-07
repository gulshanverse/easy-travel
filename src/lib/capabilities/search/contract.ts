/**
 * SEARCH CAPABILITY CONTRACT.
 */
import { registerContract } from "@/lib/tios/contracts";
import { SearchInputSchema, SearchOutputSchema, type SearchInput, type SearchOutput } from "./types";
import { runSearch } from "./service";

export function registerSearchContract(): void {
  registerContract<SearchInput, SearchOutput>({
    id: "search-engine",
    displayName: "Search Intelligence",
    version: "1.0.0",
    description:
      "Semantic search across destinations, experiences, hotels, restaurants with intent detection, filters, ranking, and suggestions.",
    category: "discovery",
    lifecycle: "beta",
    inputSchema: SearchInputSchema,
    outputSchema: SearchOutputSchema,
    dependencies: [],
    requiredPermissions: [],
    supportedAgents: ["search"],
    supportedProviders: ["gemini", "openai"],
    priority: 65,
    featureFlags: [],
    tags: ["search", "discovery", "core"],
    failureModes: ["empty_query", "invalid_scope"],
    fallbackStrategy: "degraded",
    retryStrategy: { maxAttempts: 2, backoffMs: 200 },
    sla: { availability: 0.999, p95LatencyMs: 400 },
    latencyTargetMs: 200,
    costCategory: "low",
    securityClassification: "internal",
    ownerModule: "capabilities/search",
    docsUrl: "/docs/CAPABILITIES.md#search",
    handler: async (input, ctx) => runSearch(input, ctx),
  });
}
