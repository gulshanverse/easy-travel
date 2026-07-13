/**
 * Journey Health Checks — aggregate journey subsystem health.
 */

import type { JourneyRegistry } from "./registry";
import {
  aggregateHealth,
  type AggregatedHealth,
  type HealthCheckResult,
} from "./telemetry";
import type {
  JourneyGraphPort,
  JourneyMemoryPort,
  JourneyPromptPort,
  JourneyProviderPort,
} from "./ports";

export interface JourneyHealthCheckInput {
  registry: JourneyRegistry;
  memory: JourneyMemoryPort;
  graph: JourneyGraphPort;
  prompt: JourneyPromptPort;
  provider: JourneyProviderPort;
}

export async function runJourneyHealth(input: JourneyHealthCheckInput): Promise<AggregatedHealth> {
  const [mem, graph, prompt, prov] = await Promise.all([
    input.memory.healthy().catch(() => false),
    input.graph.healthy().catch(() => false),
    input.prompt.healthy().catch(() => false),
    input.provider.healthy().catch(() => false),
  ]);
  const checks: HealthCheckResult[] = [
    { name: "journey.registry", status: "healthy", details: { count: input.registry.count() } },
    { name: "journey.memory", status: mem ? "healthy" : "unhealthy" },
    { name: "journey.graph", status: graph ? "healthy" : "unhealthy" },
    { name: "journey.prompt", status: prompt ? "healthy" : "unhealthy" },
    { name: "journey.provider", status: prov ? "healthy" : "unhealthy" },
  ];
  return aggregateHealth(checks);
}
