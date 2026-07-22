/** ARP — immutable factories. */
import { newAgentId, newConversationId, newPlanId, newSessionId, newTaskId, newTurnId } from "./ids";
import type {
  Agent, AgentCapability, AgentGoal, AgentIdentity, AgentMemoryReference, AgentPlan, AgentPolicySpec,
  AgentProfile, AgentRole, AgentTask, AgentType, Conversation, ConversationContext, ConversationTurn,
  PlanStrategy, Session, SessionContext,
} from "./types";
import { validateAgent, validateConversation, validatePlan, validateSession, validateTask } from "./validation";

function fArr<T>(a: readonly T[] = []): readonly T[] { return Object.freeze([...a]); }
function fObj<T extends object>(o: T = {} as T): Readonly<T> { return Object.freeze({ ...o }); }

export interface MakeAgentInput {
  id?: string;
  type: AgentType;
  name: string;
  version: string;
  profile?: Partial<AgentProfile>;
  role?: AgentRole;
  capabilities?: readonly AgentCapability[];
  goals?: readonly AgentGoal[];
  memory?: readonly AgentMemoryReference[];
  policy?: AgentPolicySpec;
  tags?: readonly string[];
  labels?: Record<string, string>;
  description?: string;
  now?: number;
}
export function makeAgent(i: MakeAgentInput): Agent {
  const id = i.id ?? newAgentId();
  const now = i.now ?? Date.now();
  const identity: AgentIdentity = Object.freeze({ id, type: i.type, name: i.name, version: i.version });
  const profile: AgentProfile = Object.freeze({
    displayName: i.profile?.displayName ?? i.name,
    description: i.profile?.description,
    languages: fArr(i.profile?.languages ?? ["en"]),
    tags: fArr(i.profile?.tags),
  });
  const role: AgentRole = Object.freeze({
    name: i.role?.name ?? i.type,
    scopes: fArr(i.role?.scopes),
  });
  const agent: Agent = Object.freeze({
    identity, profile, role,
    capabilities: fArr(i.capabilities).map(c => Object.freeze({ ...c })) as readonly AgentCapability[],
    goals: fArr(i.goals).map(g => Object.freeze({ ...g })) as readonly AgentGoal[],
    memory: fArr(i.memory).map(m => Object.freeze({ ...m })) as readonly AgentMemoryReference[],
    policy: fObj(i.policy ?? {}),
    metadata: Object.freeze({
      tags: fArr(i.tags),
      labels: fObj(i.labels),
      description: i.description,
      createdAt: now,
      updatedAt: now,
    }),
    status: "registered",
  });
  validateAgent(agent);
  return agent;
}

export interface MakeTaskInput extends Omit<AgentTask, "id" | "dependsOn"> {
  id?: string;
  dependsOn?: readonly string[];
}
export function makeTask(i: MakeTaskInput): AgentTask {
  const t: AgentTask = Object.freeze({
    id: i.id ?? newTaskId(),
    kind: i.kind,
    capabilityId: i.capabilityId,
    workflowId: i.workflowId,
    delegateAgentId: i.delegateAgentId,
    input: i.input ? fObj(i.input as Record<string, unknown>) : undefined,
    dependsOn: fArr(i.dependsOn),
    optional: i.optional,
  });
  validateTask(t);
  return t;
}

export interface MakePlanInput {
  id?: string;
  agentId: string;
  intentId: string;
  strategy: PlanStrategy;
  tasks: readonly AgentTask[];
  layers?: readonly (readonly string[])[];
  fallback?: readonly AgentTask[];
  recovery?: readonly AgentTask[];
  now?: number;
}
export function makePlan(i: MakePlanInput): AgentPlan {
  const tasks = fArr(i.tasks) as readonly AgentTask[];
  const plan: AgentPlan = Object.freeze({
    id: i.id ?? newPlanId(),
    agentId: i.agentId,
    intentId: i.intentId,
    strategy: i.strategy,
    tasks,
    layers: Object.freeze((i.layers ?? []).map(l => Object.freeze([...l]))) as readonly (readonly string[])[],
    fallback: i.fallback ? fArr(i.fallback) : undefined,
    recovery: i.recovery ? fArr(i.recovery) : undefined,
    createdAt: i.now ?? Date.now(),
  });
  validatePlan(plan);
  return plan;
}

export interface MakeSessionInput {
  id?: string;
  agentId: string;
  context?: Partial<SessionContext>;
  ttlMs: number;
  tags?: readonly string[];
  labels?: Record<string, string>;
  now?: number;
}
export function makeSession(i: MakeSessionInput): Session {
  const now = i.now ?? Date.now();
  const s: Session = Object.freeze({
    id: i.id ?? newSessionId(),
    agentId: i.agentId,
    conversations: Object.freeze([]),
    context: Object.freeze({
      userId: i.context?.userId,
      locale: i.context?.locale,
      timezone: i.context?.timezone,
      variables: fObj(i.context?.variables ?? {}),
    }),
    metadata: Object.freeze({
      tags: fArr(i.tags),
      labels: fObj(i.labels),
      createdAt: now,
      lastActiveAt: now,
      ttlMs: i.ttlMs,
    }),
    status: "active",
  });
  validateSession(s);
  return s;
}

export interface MakeConversationInput {
  id?: string;
  sessionId: string;
  agentId: string;
  context?: Partial<ConversationContext>;
  tags?: readonly string[];
  labels?: Record<string, string>;
  now?: number;
}
export function makeConversation(i: MakeConversationInput): Conversation {
  const now = i.now ?? Date.now();
  const c: Conversation = Object.freeze({
    id: i.id ?? newConversationId(),
    sessionId: i.sessionId,
    agentId: i.agentId,
    turns: Object.freeze([]),
    context: Object.freeze({
      agentId: i.agentId,
      sessionId: i.sessionId,
      locale: i.context?.locale,
      timezone: i.context?.timezone,
      variables: fObj(i.context?.variables ?? {}),
    }),
    status: "active",
    metadata: Object.freeze({
      tags: fArr(i.tags),
      labels: fObj(i.labels),
      createdAt: now,
      updatedAt: now,
    }),
  });
  validateConversation(c);
  return c;
}

export function makeTurn(i: {
  id?: string; role: ConversationTurn["role"]; input?: string;
  intentId?: string; planId?: string; responseId?: string;
  metadata?: Record<string, unknown>; now?: number;
}): ConversationTurn {
  return Object.freeze({
    id: i.id ?? newTurnId(),
    at: i.now ?? Date.now(),
    role: i.role,
    intentId: i.intentId,
    planId: i.planId,
    responseId: i.responseId,
    input: i.input,
    metadata: fObj(i.metadata ?? {}),
  });
}
