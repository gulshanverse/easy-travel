/** ARP — governance validation & audit. */
import { GovernanceError } from "./errors";
import type { AgentGovernancePolicies } from "./policies";
import type { AgentAuditPort, AgentPolicyPort } from "./ports";
import type { Agent, AgentPlan } from "./types";

export interface GovernanceInput {
  readonly agent: Agent;
  readonly plan: AgentPlan;
  readonly policies: AgentGovernancePolicies;
  readonly policyPort?: AgentPolicyPort;
  readonly audit?: AgentAuditPort;
}

export interface GovernanceReport {
  readonly ok: boolean;
  readonly violations: readonly string[];
  readonly checkedAt: number;
}

export class GovernanceEngine {
  async validate(i: GovernanceInput): Promise<GovernanceReport> {
    const violations: string[] = [];
    const capRequests = i.plan.tasks.filter(t => t.kind === "capability-request");
    if (capRequests.length > i.policies.maxCapabilitiesPerPlan) {
      violations.push(`plan.capabilities.exceeds_budget:${capRequests.length}>${i.policies.maxCapabilitiesPerPlan}`);
    }
    const delegates = i.plan.tasks.filter(t => t.kind === "delegate");
    if (delegates.length && !i.policies.allowDelegation) {
      violations.push("plan.delegation.denied");
    }
    if (delegates.length && i.policyPort) {
      for (const d of delegates) {
        const ok = await i.policyPort.isDelegationAllowed(i.agent.identity.id, d.delegateAgentId!);
        if (!ok) violations.push(`plan.delegation.denied:${d.delegateAgentId}`);
      }
    }
    for (const scope of i.policies.requireScopes) {
      if (!i.agent.role.scopes.includes(scope)) violations.push(`agent.scope.missing:${scope}`);
    }
    const report = Object.freeze({ ok: violations.length === 0, violations: Object.freeze(violations), checkedAt: Date.now() });
    i.audit?.record({
      at: report.checkedAt, agentId: i.agent.identity.id,
      action: "governance.validate",
      details: { ok: report.ok, violations: [...violations], planId: i.plan.id },
    });
    return report;
  }
  ensure(i: GovernanceInput): Promise<void> {
    return this.validate(i).then(r => {
      if (!r.ok) throw new GovernanceError(`governance: ${r.violations.join(", ")}`);
    });
  }
}
