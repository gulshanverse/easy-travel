/**
 * BUDGET CAPABILITY CONTRACT.
 */
import { registerContract } from "@/lib/tios/contracts";
import { BudgetInputSchema, BudgetOutputSchema, type BudgetInput, type BudgetOutput } from "./types";
import { runBudget } from "./service";

export function registerBudgetContract(): void {
  registerContract<BudgetInput, BudgetOutput>({
    id: "budget",
    displayName: "Budget Intelligence",
    version: "1.1.0",
    description:
      "Estimates trip cost, tracks real expenses, forecasts overspend, converts currencies, generates alerts and savings suggestions.",
    category: "financial",
    lifecycle: "beta",
    inputSchema: BudgetInputSchema,
    outputSchema: BudgetOutputSchema,
    dependencies: ["currency"],
    requiredPermissions: ["budget:read"],
    supportedAgents: ["budget"],
    supportedProviders: ["gemini", "openai"],
    priority: 80,
    featureFlags: ["BudgetV2"],
    tags: ["ai", "money", "core"],
    failureModes: ["fx_missing", "invalid_currency"],
    fallbackStrategy: "cached",
    retryStrategy: { maxAttempts: 2, backoffMs: 300 },
    sla: { availability: 0.999, p95LatencyMs: 800 },
    latencyTargetMs: 400,
    costCategory: "low",
    securityClassification: "confidential",
    ownerModule: "capabilities/budget",
    docsUrl: "/docs/CAPABILITIES.md#budget",
    handler: async (input, ctx) => runBudget(input, ctx),
  });
}
