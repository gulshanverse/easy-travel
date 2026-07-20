/** CTOR — health checks. */
import type { CapabilityManager } from "./manager";
import type {
  CTORDecisionPort, CTORGoalPort, CTORGraphPort, CTORJourneyPort, CTORKernelPort,
  CTORMemoryPort, CTORPromptPort, CTORProviderPort, CTORSpatialPort, CTORTrustPort,
} from "./ports";

export interface CTORHealthDeps {
  readonly memory?: CTORMemoryPort;
  readonly prompt?: CTORPromptPort;
  readonly kernel?: CTORKernelPort;
  readonly provider?: CTORProviderPort;
  readonly graph?: CTORGraphPort;
  readonly journey?: CTORJourneyPort;
  readonly decision?: CTORDecisionPort;
  readonly trust?: CTORTrustPort;
  readonly goal?: CTORGoalPort;
  readonly spatial?: CTORSpatialPort;
}

export interface CTORHealthReport {
  readonly healthy: boolean;
  readonly capabilities: number;
  readonly tools: number;
  readonly workflows: number;
  readonly ports: Readonly<Record<string, boolean>>;
  readonly checkedAt: number;
}

export async function collectCTORHealth(mgr: CapabilityManager, deps: CTORHealthDeps): Promise<CTORHealthReport> {
  const ports: Record<string, boolean> = {};
  const check = async (name: string, p?: { healthy(): Promise<boolean> }) => {
    if (!p) return; try { ports[name] = await p.healthy(); } catch { ports[name] = false; }
  };
  await Promise.all([
    check("memory", deps.memory), check("prompt", deps.prompt), check("provider", deps.provider),
    check("graph", deps.graph), check("journey", deps.journey), check("decision", deps.decision),
    check("trust", deps.trust), check("goal", deps.goal), check("spatial", deps.spatial),
  ]);
  const allHealthy = Object.values(ports).every(Boolean);
  return {
    healthy: allHealthy,
    capabilities: mgr.capabilities.size(),
    tools: mgr.tools.size(),
    workflows: mgr.listWorkflows().length,
    ports,
    checkedAt: Date.now(),
  };
}
