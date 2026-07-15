/**
 * Decision health checks — aggregate subsystem health.
 */

import type {
  DecisionGraphPort, DecisionJourneyPort, DecisionMemoryPort,
  DecisionPromptPort, DecisionProviderPort,
} from "./ports";
import type { DecisionRegistry } from "./registry";
import { aggregateHealth, type AggregatedHealth, type HealthCheckResult } from "./telemetry";

export interface DecisionHealthInput {
  registry: DecisionRegistry;
  memory: DecisionMemoryPort;
  graph: DecisionGraphPort;
  journey: DecisionJourneyPort;
  prompt: DecisionPromptPort;
  provider: DecisionProviderPort;
}

export async function runDecisionHealth(input: DecisionHealthInput): Promise<AggregatedHealth> {
  const [mem, graph, journey, prompt, provider] = await Promise.all([
    input.memory.healthy().catch(() => false),
    input.graph.healthy().catch(() => false),
    input.journey.healthy().catch(() => false),
    input.prompt.healthy().catch(() => false),
    input.provider.healthy().catch(() => false),
  ]);
  const checks: HealthCheckResult[] = [
    { name: "decision.registry", status: "healthy", details: { count: input.registry.count() } },
    { name: "decision.memory", status: mem ? "healthy" : "unhealthy" },
    { name: "decision.graph", status: graph ? "healthy" : "unhealthy" },
    { name: "decision.journey", status: journey ? "healthy" : "unhealthy" },
    { name: "decision.prompt", status: prompt ? "healthy" : "unhealthy" },
    { name: "decision.provider", status: provider ? "healthy" : "unhealthy" },
  ];
  return aggregateHealth(checks);
}
