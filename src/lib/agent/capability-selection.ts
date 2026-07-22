/** ARP — deterministic capability selection engine.
 *
 * Never calls engines directly. Everything is queried through the CTOR port.
 */
import { CapabilitySelectionError } from "./errors";
import type { AgentGovernancePolicies } from "./policies";
import type { AgentCTORPort, AgentPolicyPort } from "./ports";
import type { Agent, AgentDecision, AgentPlan, AgentTask } from "./types";

export interface SelectionInput {
  readonly agent: Agent;
  readonly plan: AgentPlan;
  readonly policies: AgentGovernancePolicies;
  readonly ctor: AgentCTORPort;
  readonly policyPort?: AgentPolicyPort;
}

export interface SelectionResult {
  readonly decisions: readonly AgentDecision[];
  readonly resolvedTasks: readonly AgentTask[];
}

export class CapabilitySelectionEngine {
  async select(input: SelectionInput): Promise<SelectionResult> {
    const requests = input.plan.tasks.filter(t => t.kind === "capability-request");
    if (requests.length > input.policies.maxCapabilitiesPerPlan) {
      throw new CapabilitySelectionError(
        `Plan exceeds capability budget: ${requests.length} > ${input.policies.maxCapabilitiesPerPlan}`,
      );
    }

    const advertised = await input.ctor.listCapabilities();
    const advertisedById = new Map(advertised.map(c => [c.id, c]));
    const decisions: AgentDecision[] = [];
    const resolved: AgentTask[] = [];
    for (const t of input.plan.tasks) {
      if (t.kind !== "capability-request") { resolved.push(t); continue; }
      const capId = t.capabilityId!;
      if (input.policies.deniedCapabilities.includes(capId)) {
        if (t.optional) continue;
        throw new CapabilitySelectionError(`Capability ${capId} denied by policy`);
      }
      const declared = input.agent.capabilities.find(c => c.capabilityId === capId);
      if (!declared) {
        if (t.optional) continue;
        throw new CapabilitySelectionError(`Agent ${input.agent.identity.id} does not declare capability ${capId}`);
      }
      const known = advertisedById.get(capId);
      if (!known) {
        if (t.optional) continue;
        throw new CapabilitySelectionError(`Capability ${capId} not advertised by CTOR`);
      }
      const versionOk = await input.ctor.isVersionCompatible(capId, declared.versionRange);
      if (!versionOk) {
        if (t.optional) continue;
        throw new CapabilitySelectionError(`Capability ${capId} version incompatible with ${declared.versionRange}`);
      }
      if (input.policyPort) {
        const allowed = await input.policyPort.isCapabilityAllowed(input.agent.identity.id, capId);
        if (!allowed) {
          if (t.optional) continue;
          throw new CapabilitySelectionError(`Capability ${capId} not allowed for agent ${input.agent.identity.id}`);
        }
      }
      decisions.push({ capabilityId: capId, reason: "declared+advertised+compatible", rejected: [] });
      resolved.push(t);
    }
    return { decisions, resolvedTasks: resolved };
  }
}
