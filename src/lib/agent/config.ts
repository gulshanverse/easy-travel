/** ARP — configuration. */
export interface AgentRuntimeConfig {
  readonly maxAgents: number;
  readonly maxSessionsPerAgent: number;
  readonly maxConversationsPerSession: number;
  readonly maxTurnsPerConversation: number;
  readonly maxHistory: number;
  readonly defaultSessionTtlMs: number;
  readonly defaultPlanningTimeoutMs: number;
  readonly defaultCapabilityBudget: number;
  readonly defaultExecutionBudgetMs: number;
}
export const DEFAULT_AGENT_RUNTIME_CONFIG: AgentRuntimeConfig = Object.freeze({
  maxAgents: 64,
  maxSessionsPerAgent: 256,
  maxConversationsPerSession: 64,
  maxTurnsPerConversation: 512,
  maxHistory: 256,
  defaultSessionTtlMs: 30 * 60_000,
  defaultPlanningTimeoutMs: 5_000,
  defaultCapabilityBudget: 16,
  defaultExecutionBudgetMs: 60_000,
});
export function mergeAgentRuntimeConfig(patch: Partial<AgentRuntimeConfig> = {}): AgentRuntimeConfig {
  return Object.freeze({ ...DEFAULT_AGENT_RUNTIME_CONFIG, ...patch });
}
export function defineAgentRuntimeConfig(patch: Partial<AgentRuntimeConfig> = {}): AgentRuntimeConfig {
  return mergeAgentRuntimeConfig(patch);
}
