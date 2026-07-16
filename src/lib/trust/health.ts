/**
 * Trust & Evidence Engine — health checks.
 * Aggregates port health with in-memory registry sizes.
 */
import type { TrustManager } from "./manager";
import type {
  TrustDecisionPort, TrustGraphPort, TrustJourneyPort, TrustKernelPort,
  TrustMemoryPort, TrustPromptPort, TrustProviderPort,
} from "./ports";

export interface TrustHealthReport {
  readonly healthy: boolean;
  readonly checks: Readonly<Record<string, boolean>>;
  readonly sizes: { readonly sources: number; readonly evidence: number };
}

export interface TrustHealthDeps {
  readonly memory?: TrustMemoryPort;
  readonly graph?: TrustGraphPort;
  readonly journey?: TrustJourneyPort;
  readonly decision?: TrustDecisionPort;
  readonly prompt?: TrustPromptPort;
  readonly provider?: TrustProviderPort;
  readonly kernel?: TrustKernelPort;
}

export async function collectHealth(manager: TrustManager, deps: TrustHealthDeps = {}): Promise<TrustHealthReport> {
  const checks: Record<string, boolean> = { registry: true };
  const [memory, graph, journey, decision, prompt, provider] = await Promise.all([
    deps.memory ? deps.memory.healthy() : Promise.resolve(true),
    deps.graph ? deps.graph.healthy() : Promise.resolve(true),
    deps.journey ? deps.journey.healthy() : Promise.resolve(true),
    deps.decision ? deps.decision.healthy() : Promise.resolve(true),
    deps.prompt ? deps.prompt.healthy() : Promise.resolve(true),
    deps.provider ? deps.provider.healthy() : Promise.resolve(true),
  ]);
  Object.assign(checks, { memory, graph, journey, decision, prompt, provider, kernel: true });
  const healthy = Object.values(checks).every(Boolean);
  return {
    healthy,
    checks,
    sizes: { sources: manager.sources.size(), evidence: manager.evidence.size() },
  };
}
