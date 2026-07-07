/**
 * PLANNER CAPABILITY CONTRACT — registers the planner handler with TIOS.
 */
import { registerContract } from "@/lib/tios/contracts";
import { PlannerInputSchema, PlannerOutputSchema, type PlannerInput, type PlannerOutput } from "./types";
import { runPlanner } from "./service";

export function registerPlannerContract(): void {
  registerContract<PlannerInput, PlannerOutput>({
    id: "planner",
    displayName: "Trip Planner",
    version: "1.1.0",
    description:
      "Extracts travel intent from natural language and generates a structured, editable itinerary with timeline, budget, recommendations, risks, packing list, and follow-up questions.",
    category: "planning",
    lifecycle: "beta",
    inputSchema: PlannerInputSchema,
    outputSchema: PlannerOutputSchema,
    dependencies: ["weather", "budget", "recommendation-engine"],
    requiredPermissions: ["trip:read", "trip:write"],
    supportedAgents: ["planner"],
    supportedProviders: ["gemini", "openai", "claude", "local"],
    priority: 90,
    featureFlags: ["PlannerV2"],
    tags: ["ai", "planning", "core"],
    failureModes: ["nlu_low_confidence", "missing_destination", "provider_timeout"],
    fallbackStrategy: "degraded",
    retryStrategy: { maxAttempts: 2, backoffMs: 500, jitter: true },
    sla: { availability: 0.995, p95LatencyMs: 4000 },
    latencyTargetMs: 2500,
    costCategory: "medium",
    securityClassification: "internal",
    ownerModule: "capabilities/planner",
    docsUrl: "/docs/CAPABILITIES.md#planner",
    handler: async (input, ctx) => runPlanner(input, ctx),
  });
}
