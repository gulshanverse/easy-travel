/** ARP — TravelOrchestratorAgent (initial built-in). */
import { makeAgent } from "../factories";
import type { Agent } from "../types";

export interface TravelOrchestratorInput {
  id?: string;
  name?: string;
  version?: string;
}

export function TravelOrchestratorAgent(i: TravelOrchestratorInput = {}): Agent {
  return makeAgent({
    id: i.id,
    type: "travel-orchestrator",
    name: i.name ?? "TravelOrchestrator",
    version: i.version ?? "1.0.0",
    profile: {
      displayName: "Travel Orchestrator",
      description: "Coordinates travel planning, discovery, decision-making and safety checks.",
      languages: ["en"],
      tags: ["travel", "orchestrator"],
    },
    role: { name: "travel-orchestrator", scopes: ["travel.read", "travel.plan"] },
    capabilities: [
      { capabilityId: "journey.assemble-context", versionRange: "^1.0.0", required: false },
      { capabilityId: "goal.plan", versionRange: "^1.0.0", required: false },
      { capabilityId: "decision.rank", versionRange: "^1.0.0", required: false },
      { capabilityId: "spatial.query", versionRange: "^1.0.0", required: false },
      { capabilityId: "trust.evaluate", versionRange: "^1.0.0", required: false },
    ],
    goals: [
      { id: "assemble-context", description: "Assemble unified travel context.", priority: "high" },
      { id: "produce-recommendations", description: "Produce ranked travel recommendations.", priority: "high" },
    ],
    memory: [{ memoryScope: "travel.session", readonly: false }],
    policy: {
      maxCapabilitiesPerPlan: 8,
      executionBudgetMs: 30_000,
      planningTimeoutMs: 3_000,
      allowDelegation: true,
    },
    tags: ["builtin", "travel"],
    description: "Default travel orchestrator that coordinates other engines through CTOR.",
  });
}
