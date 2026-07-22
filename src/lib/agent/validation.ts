/** ARP — validation. */
import { AgentValidationError } from "./errors";
import type { Agent, AgentPlan, AgentTask, Conversation, Session } from "./types";

const SEMVER = /^\d+\.\d+\.\d+(-[\w.]+)?$/;
export function validateSemver(v: string): void {
  if (!SEMVER.test(v)) throw new AgentValidationError(`Invalid semver: ${v}`);
}

export function validateAgent(a: Agent): void {
  if (!a.identity.id) throw new AgentValidationError("Agent identity.id required");
  if (!a.identity.name) throw new AgentValidationError("Agent identity.name required");
  validateSemver(a.identity.version);
  const seen = new Set<string>();
  for (const c of a.capabilities) {
    if (!c.capabilityId) throw new AgentValidationError("AgentCapability.capabilityId required");
    if (seen.has(c.capabilityId)) throw new AgentValidationError(`Duplicate capability: ${c.capabilityId}`);
    seen.add(c.capabilityId);
  }
}

export function validatePlan(p: AgentPlan): void {
  if (!p.id) throw new AgentValidationError("Plan id required");
  if (!p.tasks.length) throw new AgentValidationError("Plan requires at least one task");
  const ids = new Set<string>();
  for (const t of p.tasks) {
    if (!t.id) throw new AgentValidationError("Task id required");
    if (ids.has(t.id)) throw new AgentValidationError(`Duplicate task id: ${t.id}`);
    ids.add(t.id);
  }
  for (const t of p.tasks) {
    for (const d of t.dependsOn) {
      if (!ids.has(d)) throw new AgentValidationError(`Task ${t.id} depends on unknown ${d}`);
    }
  }
}

export function validateTask(t: AgentTask): void {
  if (!t.id) throw new AgentValidationError("Task id required");
  if (t.kind === "capability-request" && !t.capabilityId) {
    throw new AgentValidationError(`Task ${t.id} requires capabilityId`);
  }
  if (t.kind === "workflow-request" && !t.workflowId) {
    throw new AgentValidationError(`Task ${t.id} requires workflowId`);
  }
  if (t.kind === "delegate" && !t.delegateAgentId) {
    throw new AgentValidationError(`Task ${t.id} requires delegateAgentId`);
  }
}

export function validateSession(s: Session): void {
  if (!s.id) throw new AgentValidationError("Session id required");
  if (!s.agentId) throw new AgentValidationError("Session agentId required");
}

export function validateConversation(c: Conversation): void {
  if (!c.id) throw new AgentValidationError("Conversation id required");
  if (!c.sessionId) throw new AgentValidationError("Conversation sessionId required");
  if (!c.agentId) throw new AgentValidationError("Conversation agentId required");
}
