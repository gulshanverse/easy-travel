/** ARP — domain types (immutable). */

export type AgentStatus =
  | "registered"
  | "ready"
  | "receiving-request"
  | "understanding-intent"
  | "planning"
  | "selecting-capabilities"
  | "executing-workflow"
  | "waiting"
  | "synthesizing-response"
  | "completed"
  | "archived"
  | "failed";

export type AgentType =
  | "travel-orchestrator"
  | "booking"
  | "visa"
  | "budget"
  | "safety"
  | "discovery"
  | "support"
  | "generic";

export type IntentPriority = "low" | "normal" | "high" | "critical";
export type IntentScope = "single-turn" | "multi-turn" | "background";
export type IntentDomain = "travel" | "booking" | "safety" | "budget" | "discovery" | "support" | "generic";

export interface AgentIdentity {
  readonly id: string;
  readonly type: AgentType;
  readonly name: string;
  readonly version: string;
}
export interface AgentProfile {
  readonly displayName: string;
  readonly description?: string;
  readonly languages: readonly string[];
  readonly tags: readonly string[];
}
export interface AgentCapability {
  readonly capabilityId: string;
  readonly versionRange?: string;
  readonly required?: boolean;
}
export interface AgentRole {
  readonly name: string;
  readonly scopes: readonly string[];
}
export interface AgentGoal {
  readonly id: string;
  readonly description: string;
  readonly priority: IntentPriority;
}
export interface AgentMemoryReference {
  readonly memoryScope: string;
  readonly readonly?: boolean;
}
export interface AgentMetadata {
  readonly tags: readonly string[];
  readonly labels: Readonly<Record<string, string>>;
  readonly description?: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}
export interface AgentPolicySpec {
  readonly maxCapabilitiesPerPlan?: number;
  readonly executionBudgetMs?: number;
  readonly planningTimeoutMs?: number;
  readonly allowDelegation?: boolean;
  readonly allowedDelegates?: readonly string[];
  readonly requiredScopes?: readonly string[];
}
export interface AgentStatistics {
  requests: number;
  intentsClassified: number;
  plansCreated: number;
  workflowsRequested: number;
  workflowsCompleted: number;
  workflowsFailed: number;
  responsesAssembled: number;
  failures: number;
  totalLatencyMs: number;
}
export interface Agent {
  readonly identity: AgentIdentity;
  readonly profile: AgentProfile;
  readonly role: AgentRole;
  readonly capabilities: readonly AgentCapability[];
  readonly goals: readonly AgentGoal[];
  readonly memory: readonly AgentMemoryReference[];
  readonly policy: AgentPolicySpec;
  readonly metadata: AgentMetadata;
  readonly status: AgentStatus;
}
export interface AgentHistoryEntry {
  readonly at: number;
  readonly status: AgentStatus;
  readonly note?: string;
}
export interface AgentSnapshot {
  readonly agent: Agent;
  readonly takenAt: number;
}

// ---------------- Intent ----------------
export interface IntentConstraint { readonly kind: string; readonly value: unknown }
export interface IntentRelationship { readonly otherIntentId: string; readonly kind: "follows" | "refines" | "conflicts" }
export interface Intent {
  readonly id: string;
  readonly agentId: string;
  readonly classification: string;
  readonly confidence: number;
  readonly priority: IntentPriority;
  readonly scope: IntentScope;
  readonly domain: IntentDomain;
  readonly constraints: readonly IntentConstraint[];
  readonly relationships: readonly IntentRelationship[];
  readonly rawInput: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly createdAt: number;
}

// ---------------- Planning ----------------
export type TaskKind = "capability-request" | "workflow-request" | "delegate" | "observe" | "synthesize";
export interface AgentTask {
  readonly id: string;
  readonly kind: TaskKind;
  readonly capabilityId?: string;
  readonly workflowId?: string;
  readonly delegateAgentId?: string;
  readonly input?: Readonly<Record<string, unknown>>;
  readonly dependsOn: readonly string[];
  readonly optional?: boolean;
}
export type PlanStrategy = "sequential" | "parallel" | "mixed";
export interface AgentPlan {
  readonly id: string;
  readonly agentId: string;
  readonly intentId: string;
  readonly strategy: PlanStrategy;
  readonly tasks: readonly AgentTask[];
  readonly layers: readonly (readonly string[])[];
  readonly fallback?: readonly AgentTask[];
  readonly recovery?: readonly AgentTask[];
  readonly createdAt: number;
}

// ---------------- Reasoning / Observation ----------------
export interface AgentObservation {
  readonly id: string;
  readonly agentId: string;
  readonly source: string;
  readonly at: number;
  readonly data: Readonly<Record<string, unknown>>;
}
export interface AgentReasoningStep {
  readonly id: string;
  readonly at: number;
  readonly kind: "classify" | "plan" | "select" | "execute" | "synthesize" | "delegate";
  readonly note?: string;
  readonly data: Readonly<Record<string, unknown>>;
}
export interface AgentDecision {
  readonly capabilityId: string;
  readonly reason: string;
  readonly rejected: readonly { capabilityId: string; reason: string }[];
}

// ---------------- Response ----------------
export interface StructuredResult {
  readonly key: string;
  readonly value: unknown;
}
export interface EvidenceReference {
  readonly source: string;
  readonly id: string;
  readonly confidence?: number;
}
export interface AgentResponse {
  readonly id: string;
  readonly agentId: string;
  readonly sessionId: string;
  readonly conversationId: string;
  readonly turnId: string;
  readonly intentId: string;
  readonly planId: string;
  readonly results: readonly StructuredResult[];
  readonly evidence: readonly EvidenceReference[];
  readonly confidence: number;
  readonly warnings: readonly string[];
  readonly reasoningSummary: readonly string[];
  readonly capabilityTrace: readonly {
    readonly capabilityId?: string;
    readonly workflowId?: string;
    readonly status: "completed" | "failed" | "skipped" | "cancelled";
    readonly ms: number;
  }[];
  readonly diagnostics: Readonly<Record<string, unknown>>;
  readonly createdAt: number;
}

// ---------------- Conversation ----------------
export type ConversationStatus = "active" | "waiting" | "paused" | "completed" | "archived";
export interface ConversationTurn {
  readonly id: string;
  readonly at: number;
  readonly role: "user" | "agent" | "system";
  readonly intentId?: string;
  readonly planId?: string;
  readonly responseId?: string;
  readonly input?: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}
export interface ConversationContext {
  readonly agentId: string;
  readonly sessionId: string;
  readonly locale?: string;
  readonly timezone?: string;
  readonly variables: Readonly<Record<string, unknown>>;
}
export interface ConversationMetadata {
  readonly tags: readonly string[];
  readonly labels: Readonly<Record<string, string>>;
  readonly createdAt: number;
  readonly updatedAt: number;
}
export interface Conversation {
  readonly id: string;
  readonly sessionId: string;
  readonly agentId: string;
  readonly turns: readonly ConversationTurn[];
  readonly context: ConversationContext;
  readonly status: ConversationStatus;
  readonly metadata: ConversationMetadata;
}
export interface ConversationSummary {
  readonly conversationId: string;
  readonly turns: number;
  readonly lastTurnAt?: number;
  readonly status: ConversationStatus;
}
export interface ConversationSnapshot {
  readonly conversation: Conversation;
  readonly takenAt: number;
}

// ---------------- Session ----------------
export type SessionStatus = "active" | "idle" | "ended" | "expired";
export interface SessionContext {
  readonly userId?: string;
  readonly locale?: string;
  readonly timezone?: string;
  readonly variables: Readonly<Record<string, unknown>>;
}
export interface SessionMetadata {
  readonly tags: readonly string[];
  readonly labels: Readonly<Record<string, string>>;
  readonly createdAt: number;
  readonly lastActiveAt: number;
  readonly ttlMs: number;
}
export interface Session {
  readonly id: string;
  readonly agentId: string;
  readonly conversations: readonly string[];
  readonly context: SessionContext;
  readonly metadata: SessionMetadata;
  readonly status: SessionStatus;
}
export interface SessionHealth {
  readonly sessionId: string;
  readonly healthy: boolean;
  readonly checkedAt: number;
  readonly reason?: string;
}

// ---------------- Agent Context (execution) ----------------
export interface AgentContext {
  readonly agentId: string;
  readonly sessionId?: string;
  readonly conversationId?: string;
  readonly turnId?: string;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly signal: AbortSignal;
  readonly deadline?: number;
  readonly variables: Readonly<Record<string, unknown>>;
  readonly locale?: string;
  readonly timezone?: string;
}

// ---------------- History / Statistics ----------------
export interface AgentRunHistoryEntry {
  readonly at: number;
  readonly intentId?: string;
  readonly planId?: string;
  readonly responseId?: string;
  readonly ok: boolean;
  readonly ms: number;
}
