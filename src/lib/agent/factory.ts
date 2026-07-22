/** ARP — AgentManager factory. */
import { ConversationRuntime } from "./conversation";
import type { AgentEventBus } from "./events";
import type { AgentMetrics } from "./metrics";
import type { AgentGovernancePolicies } from "./policies";
import type { AgentAuditPort, AgentCTORPort, AgentKernelPort, AgentPolicyPort } from "./ports";
import { AgentManager } from "./manager";
import { AgentRegistry } from "./registry";
import { SessionRegistry } from "./session";
import type { AgentTelemetrySink } from "./telemetry";

export interface CreateAgentManagerInput {
  readonly events: AgentEventBus;
  readonly metrics: AgentMetrics;
  readonly telemetry: AgentTelemetrySink;
  readonly policies: AgentGovernancePolicies;
  readonly maxTurns: number;
  readonly ctor: AgentCTORPort;
  readonly kernel?: AgentKernelPort;
  readonly policyPort?: AgentPolicyPort;
  readonly audit?: AgentAuditPort;
  readonly now?: () => number;
}
export function createAgentManager(i: CreateAgentManagerInput): AgentManager {
  return new AgentManager({
    registry: new AgentRegistry(),
    sessions: new SessionRegistry(),
    conversations: new ConversationRuntime({ maxTurns: i.maxTurns }),
    events: i.events, metrics: i.metrics, telemetry: i.telemetry, policies: i.policies,
    ctor: i.ctor, kernel: i.kernel, policyPort: i.policyPort, audit: i.audit, now: i.now,
  });
}
export class AgentFactory {
  static create(i: CreateAgentManagerInput): AgentManager { return createAgentManager(i); }
}
