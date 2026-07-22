/** ARP — governance policies. */
import type { AgentPolicySpec } from "./types";

export interface AgentGovernancePolicies {
  readonly maxCapabilitiesPerPlan: number;
  readonly executionBudgetMs: number;
  readonly planningTimeoutMs: number;
  readonly allowDelegation: boolean;
  readonly requireScopes: readonly string[];
  readonly deniedCapabilities: readonly string[];
}
export const DEFAULT_GOVERNANCE_POLICIES: AgentGovernancePolicies = Object.freeze({
  maxCapabilitiesPerPlan: 16,
  executionBudgetMs: 60_000,
  planningTimeoutMs: 5_000,
  allowDelegation: true,
  requireScopes: Object.freeze([]),
  deniedCapabilities: Object.freeze([]),
});
export function mergeGovernancePolicies(patch: Partial<AgentGovernancePolicies> = {}): AgentGovernancePolicies {
  return Object.freeze({ ...DEFAULT_GOVERNANCE_POLICIES, ...patch });
}
export function resolvePolicy(agent: AgentPolicySpec, base: AgentGovernancePolicies): AgentGovernancePolicies {
  return Object.freeze({
    maxCapabilitiesPerPlan: agent.maxCapabilitiesPerPlan ?? base.maxCapabilitiesPerPlan,
    executionBudgetMs: agent.executionBudgetMs ?? base.executionBudgetMs,
    planningTimeoutMs: agent.planningTimeoutMs ?? base.planningTimeoutMs,
    allowDelegation: agent.allowDelegation ?? base.allowDelegation,
    requireScopes: base.requireScopes,
    deniedCapabilities: base.deniedCapabilities,
  });
}
