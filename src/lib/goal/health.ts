/**
 * Goal Engine — health checks. Aggregates port health with registry sizes.
 */
import type { GoalManager } from "./manager";
import type {
  GoalDecisionPort, GoalGraphPort, GoalJourneyPort, GoalKernelPort,
  GoalMemoryPort, GoalPromptPort, GoalProviderPort, GoalTrustPort,
} from "./ports";

export interface GoalHealthReport {
  readonly healthy: boolean;
  readonly checks: Readonly<Record<string, boolean>>;
  readonly sizes: { readonly goals: number; readonly plans: number };
}

export interface GoalHealthDeps {
  readonly memory?: GoalMemoryPort;
  readonly journey?: GoalJourneyPort;
  readonly decision?: GoalDecisionPort;
  readonly trust?: GoalTrustPort;
  readonly graph?: GoalGraphPort;
  readonly prompt?: GoalPromptPort;
  readonly provider?: GoalProviderPort;
  readonly kernel?: GoalKernelPort;
}

export async function collectGoalHealth(manager: GoalManager, deps: GoalHealthDeps = {}): Promise<GoalHealthReport> {
  const checks: Record<string, boolean> = { registry: true };
  const [memory, journey, decision, trust, graph, prompt, provider] = await Promise.all([
    deps.memory ? deps.memory.healthy() : Promise.resolve(true),
    deps.journey ? deps.journey.healthy() : Promise.resolve(true),
    deps.decision ? deps.decision.healthy() : Promise.resolve(true),
    deps.trust ? deps.trust.healthy() : Promise.resolve(true),
    deps.graph ? deps.graph.healthy() : Promise.resolve(true),
    deps.prompt ? deps.prompt.healthy() : Promise.resolve(true),
    deps.provider ? deps.provider.healthy() : Promise.resolve(true),
  ]);
  Object.assign(checks, { memory, journey, decision, trust, graph, prompt, provider, kernel: true });
  return {
    healthy: Object.values(checks).every(Boolean),
    checks,
    sizes: { goals: manager.goals.size(), plans: manager.plans.size() },
  };
}
