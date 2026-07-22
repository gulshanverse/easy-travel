/** ARP — agent lifecycle transitions. */
import { AgentLifecycleError } from "./errors";
import type { AgentStatus, ConversationStatus, SessionStatus } from "./types";

const AGENT: Record<AgentStatus, readonly AgentStatus[]> = {
  registered: ["ready", "failed", "archived"],
  ready: ["receiving-request", "archived", "failed"],
  "receiving-request": ["understanding-intent", "failed", "ready"],
  "understanding-intent": ["planning", "failed", "ready"],
  planning: ["selecting-capabilities", "failed", "ready"],
  "selecting-capabilities": ["executing-workflow", "failed", "ready"],
  "executing-workflow": ["waiting", "synthesizing-response", "failed"],
  waiting: ["executing-workflow", "synthesizing-response", "failed"],
  "synthesizing-response": ["completed", "failed"],
  completed: ["ready", "archived"],
  archived: [],
  failed: ["ready", "archived"],
};

const SESSION: Record<SessionStatus, readonly SessionStatus[]> = {
  active: ["idle", "ended", "expired"],
  idle: ["active", "ended", "expired"],
  ended: [],
  expired: [],
};

const CONVERSATION: Record<ConversationStatus, readonly ConversationStatus[]> = {
  active: ["waiting", "paused", "completed", "archived"],
  waiting: ["active", "completed", "archived"],
  paused: ["active", "archived"],
  completed: ["archived"],
  archived: [],
};

export function canTransitionAgent(from: AgentStatus, to: AgentStatus): boolean {
  return AGENT[from]?.includes(to) ?? false;
}
export function transitionAgent(from: AgentStatus, to: AgentStatus): AgentStatus {
  if (!canTransitionAgent(from, to)) throw new AgentLifecycleError(`Invalid agent transition ${from} -> ${to}`);
  return to;
}
export function canTransitionSession(from: SessionStatus, to: SessionStatus): boolean {
  return SESSION[from]?.includes(to) ?? false;
}
export function transitionSession(from: SessionStatus, to: SessionStatus): SessionStatus {
  if (!canTransitionSession(from, to)) throw new AgentLifecycleError(`Invalid session transition ${from} -> ${to}`);
  return to;
}
export function canTransitionConversation(from: ConversationStatus, to: ConversationStatus): boolean {
  return CONVERSATION[from]?.includes(to) ?? false;
}
export function transitionConversation(from: ConversationStatus, to: ConversationStatus): ConversationStatus {
  if (!canTransitionConversation(from, to)) throw new AgentLifecycleError(`Invalid conversation transition ${from} -> ${to}`);
  return to;
}

/** Ordered lifecycle for happy-path traversal. */
export const AGENT_LIFECYCLE_ORDER: readonly AgentStatus[] = Object.freeze([
  "registered", "ready", "receiving-request", "understanding-intent", "planning",
  "selecting-capabilities", "executing-workflow", "waiting", "synthesizing-response",
  "completed", "archived", "failed",
]);
