/** ARP — agent lifecycle transitions. */
import { AgentLifecycleError } from "./errors";
import type { AgentStatus, ConversationStatus, SessionStatus } from "./types";

// Reasoning phases are permissive between active states so concurrent
// requests against the same registered agent do not deadlock on transitions.
const ACTIVE: readonly AgentStatus[] = [
  "ready", "receiving-request", "understanding-intent", "planning",
  "selecting-capabilities", "executing-workflow", "waiting",
  "synthesizing-response", "completed",
];
const AGENT: Record<AgentStatus, readonly AgentStatus[]> = {
  registered: ["ready", "failed", "archived"],
  ready: ACTIVE.concat("archived", "failed") as readonly AgentStatus[],
  "receiving-request": ACTIVE.concat("failed") as readonly AgentStatus[],
  "understanding-intent": ACTIVE.concat("failed") as readonly AgentStatus[],
  planning: ACTIVE.concat("failed") as readonly AgentStatus[],
  "selecting-capabilities": ACTIVE.concat("failed") as readonly AgentStatus[],
  "executing-workflow": ACTIVE.concat("failed") as readonly AgentStatus[],
  waiting: ACTIVE.concat("failed") as readonly AgentStatus[],
  "synthesizing-response": ACTIVE.concat("failed") as readonly AgentStatus[],
  completed: ACTIVE.concat("archived") as readonly AgentStatus[],
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
