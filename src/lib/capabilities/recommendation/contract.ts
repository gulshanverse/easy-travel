/**
 * RECOMMENDATION CAPABILITY CONTRACT.
 * Registers a dedicated "recommendation-engine" capability so the seeded
 * TIOS defaults remain unchanged.
 */
import { registerContract } from "@/lib/tios/contracts";
import {
  RecommendationInputSchema, RecommendationOutputSchema,
  type RecommendationInput, type RecommendationOutput,
} from "./types";
import { runRecommendation } from "./service";

export function registerRecommendationContract(): void {
  registerContract<RecommendationInput, RecommendationOutput>({
    id: "recommendation-engine",
    displayName: "Recommendation Engine",
    version: "1.0.0",
    description:
      "Six-stage recommendation pipeline: Context → Knowledge → Business Rules → Ranking → AI Enhancement → Explainability. Emits confidence scores and reasons.",
    category: "insights",
    lifecycle: "beta",
    inputSchema: RecommendationInputSchema,
    outputSchema: RecommendationOutputSchema,
    dependencies: [],
    requiredPermissions: [],
    supportedAgents: ["recommender"],
    supportedProviders: ["gemini", "openai", "claude"],
    priority: 75,
    featureFlags: [],
    tags: ["ranking", "insights", "core"],
    failureModes: ["empty_knowledge", "invalid_filters"],
    fallbackStrategy: "degraded",
    retryStrategy: { maxAttempts: 2, backoffMs: 300 },
    sla: { availability: 0.99, p95LatencyMs: 1500 },
    latencyTargetMs: 600,
    costCategory: "low",
    securityClassification: "internal",
    ownerModule: "capabilities/recommendation",
    docsUrl: "/docs/CAPABILITIES.md#recommendation",
    handler: async (input, ctx) => runRecommendation(input, ctx),
  });
}
