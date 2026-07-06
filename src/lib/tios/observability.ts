/**
 * TIOS Observability.
 * Lightweight in-memory metrics wired through the TIOS event bus.
 * Metrics can be shipped to Cloud analytics tables in a later milestone
 * without changing call sites.
 */
import { onTIOSEvent } from "./events";

interface Metrics {
  capabilityUsage: Record<string, number>;
  decisionLatencyMs: number[];
  workflowDurationMs: number[];
  policyMatches: number;
  policyDenials: number;
  providerFailures: number;
  recommendationCount: number;
  flagsEvaluated: number;
}

const metrics: Metrics = {
  capabilityUsage: {},
  decisionLatencyMs: [],
  workflowDurationMs: [],
  policyMatches: 0,
  policyDenials: 0,
  providerFailures: 0,
  recommendationCount: 0,
  flagsEvaluated: 0,
};

onTIOSEvent("DECISION_CREATED", (e) => {
  const cap = e.capability ?? "unknown";
  metrics.capabilityUsage[cap] = (metrics.capabilityUsage[cap] ?? 0) + 1;
  const latency = (e.data as { latencyMs?: number })?.latencyMs;
  if (typeof latency === "number") metrics.decisionLatencyMs.push(latency);
});
onTIOSEvent("POLICY_MATCHED", () => { metrics.policyMatches += 1; });
onTIOSEvent("POLICY_DENIED", () => { metrics.policyDenials += 1; });
onTIOSEvent("FAILOVER_OCCURRED", () => { metrics.providerFailures += 1; });
onTIOSEvent("RECOMMENDATION_CREATED", (e) => {
  metrics.recommendationCount += Number((e.data as { count?: number })?.count ?? 0);
});
onTIOSEvent("FLAG_EVALUATED", () => { metrics.flagsEvaluated += 1; });
onTIOSEvent("WORKFLOW_COMPLETED", (e) => {
  const d = (e.data as { durationMs?: number })?.durationMs;
  if (typeof d === "number") metrics.workflowDurationMs.push(d);
});

export function readMetricsSnapshot(): Metrics {
  return {
    ...metrics,
    capabilityUsage: { ...metrics.capabilityUsage },
    decisionLatencyMs: [...metrics.decisionLatencyMs],
    workflowDurationMs: [...metrics.workflowDurationMs],
  };
}

export function resetMetrics(): void {
  metrics.capabilityUsage = {};
  metrics.decisionLatencyMs = [];
  metrics.workflowDurationMs = [];
  metrics.policyMatches = 0;
  metrics.policyDenials = 0;
  metrics.providerFailures = 0;
  metrics.recommendationCount = 0;
  metrics.flagsEvaluated = 0;
}
