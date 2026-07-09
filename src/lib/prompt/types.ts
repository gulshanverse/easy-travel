/**
 * Prompt Orchestration Runtime — Core Types (EDS-002 v2.0).
 *
 * Provider-independent. No LLM SDKs, no vendor payloads. The runtime
 * produces a CompiledPrompt that a ProviderAdapter can translate into
 * whatever wire format a downstream integration requires.
 */

// ─── Identity & correlation ──────────────────────────────────────────────────
export type PromptId = string;
export type PromptVersion = string; // semver: "1.4.2"
export type CorrelationId = string;
export type CausationId = string;
export type TraceId = string;

// ─── Lifecycle stages (EDS-002 §Prompt Lifecycle) ────────────────────────────
export const PROMPT_STAGES = [
  "requested",
  "context_collection",
  "memory_retrieval",
  "context_assembly",
  "prompt_assembly",
  "compilation",
  "validation",
  "budget_enforcement",
  "provider_preparation",
  "execution",
  "streaming",
  "output_validation",
  "structured_parsing",
  "completed",
] as const;
export type PromptStage = (typeof PROMPT_STAGES)[number];

// ─── Fragments (assembled into a PromptIR) ───────────────────────────────────
export type PromptRole = "system" | "developer" | "user" | "assistant" | "tool";

export type FragmentKind =
  | "mission"
  | "capability"
  | "safety"
  | "journey"
  | "memory"
  | "tool"
  | "output"
  | "identity"
  | "goal"
  | "relationship"
  | "preference"
  | "timeline"
  | "budget"
  | "trust"
  | "knowledge"
  | "conversation"
  | "user_input"
  | "custom";

export interface PromptFragment {
  id: string;
  kind: FragmentKind;
  role: PromptRole;
  /** Ordering priority; lower runs first. */
  order: number;
  /** Trimming priority; higher survives longer under pressure. */
  priority: number;
  content: string;
  /** Optional structured metadata; never serialised into wire payload. */
  metadata?: Record<string, unknown>;
  /** Deterministic tag used for de-duplication. */
  dedupeKey?: string;
  /** Cheap estimate; PromptBudgetManager may recompute. */
  estimatedTokens?: number;
}

// ─── Context objects (EDS-002 §Context Assembly) ─────────────────────────────
export interface ConversationTurn {
  role: PromptRole;
  content: string;
  timestamp?: number;
}

export interface ConversationContext {
  turns: ConversationTurn[];
  summary?: string;
}

export interface JourneyContext {
  journeyId?: string;
  phase?: string;
  destination?: string;
  window?: { start?: string; end?: string };
  travellers?: number;
  notes?: string;
}

export interface MemoryContextItem {
  memoryId: string;
  class: string;
  content: string;
  confidence: number;
  createdAt: number;
}
export interface MemoryContext {
  items: MemoryContextItem[];
  truncated?: boolean;
}

export interface IdentityContext {
  userId?: string;
  displayName?: string;
  locale?: string;
  timezone?: string;
}

export interface GoalContext {
  primary?: string;
  secondary?: string[];
}

export interface RelationshipContext {
  travellingWith?: string[];
  relationships?: Record<string, string>;
}

export interface PreferenceContext {
  values: Record<string, unknown>;
}

export interface TimelineContext {
  now: number;
  daysToDeparture?: number;
  keyDates?: { label: string; date: string }[];
}

export interface BudgetContext {
  total?: number;
  currency?: string;
  perDay?: number;
  flexibility?: "strict" | "flexible" | "unbounded";
}

export interface TrustContext {
  score: number; // 0..1
  signals?: string[];
}

export interface CapabilityContext {
  capabilities: string[];
}

export interface ToolDescriptor {
  name: string;
  description: string;
  schema?: Record<string, unknown>;
}
export interface ToolContext {
  tools: ToolDescriptor[];
}

export interface KnowledgeGraphContext {
  nodes: { id: string; label: string; kind: string }[];
  edges: { from: string; to: string; kind: string }[];
}

/** Fully-assembled context bundle handed to the assembler. */
export interface AssembledContext {
  conversation?: ConversationContext;
  journey?: JourneyContext;
  memory?: MemoryContext;
  identity?: IdentityContext;
  goal?: GoalContext;
  relationship?: RelationshipContext;
  preference?: PreferenceContext;
  timeline?: TimelineContext;
  budget?: BudgetContext;
  trust?: TrustContext;
  capability?: CapabilityContext;
  tool?: ToolContext;
  knowledge?: KnowledgeGraphContext;
  extras?: Record<string, unknown>;
}

// ─── Request / IR / Compiled prompt ──────────────────────────────────────────
export interface PromptRequest {
  promptId: PromptId;
  version?: PromptVersion; // if omitted, use active version
  userInput?: string;
  variables?: Record<string, unknown>;
  correlationId?: CorrelationId;
  causationId?: CausationId;
  traceId?: TraceId;
  contextOverrides?: Partial<AssembledContext>;
  /** Optional output schema for structured responses. */
  outputSchema?: OutputSchema;
  /** Optional budget override. */
  budget?: Partial<TokenBudget>;
  /** Provider hint (still provider-independent — adapter honours it). */
  providerHint?: string;
  /** Abort signal for cancellation. */
  signal?: AbortSignal;
}

/** Deterministic, ordered intermediate representation. */
export interface PromptIR {
  promptId: PromptId;
  version: PromptVersion;
  fragments: PromptFragment[];
  outputSchema?: OutputSchema;
  metadata: {
    correlationId: CorrelationId;
    causationId?: CausationId;
    traceId?: TraceId;
    createdAt: number;
    templateFingerprint: string;
  };
}

export interface CompiledMessage {
  role: PromptRole;
  content: string;
}

/** Immutable compiled output; safe to cache. */
export interface CompiledPrompt {
  promptId: PromptId;
  version: PromptVersion;
  fingerprint: string; // stable hash over messages + schema
  messages: readonly CompiledMessage[];
  outputSchema?: OutputSchema;
  estimatedTokens: number;
  budget: TokenBudget;
  metadata: PromptIR["metadata"];
}

// ─── Output schema ───────────────────────────────────────────────────────────
export interface OutputSchema {
  name: string;
  /** JSON Schema-shaped record; deliberately permissive to stay provider-neutral. */
  schema: Record<string, unknown>;
  /** True when the runtime must parse response as JSON. */
  strict?: boolean;
}

// ─── Token budget ────────────────────────────────────────────────────────────
export interface TokenBudget {
  hard: number;
  soft: number;
  reservedOutput: number;
  /** Adaptive slack in tokens the manager may extend before hitting hard. */
  adaptiveSlack: number;
}

// ─── Execution ───────────────────────────────────────────────────────────────
export interface ExecutionOptions {
  timeoutMs?: number;
  maxRetries?: number;
  signal?: AbortSignal;
  /** When true, streaming chunks are emitted via events instead of aggregated. */
  stream?: boolean;
}

export interface ExecutionUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costEstimate?: number;
}

export interface ExecutionResult<T = string> {
  correlationId: CorrelationId;
  promptId: PromptId;
  version: PromptVersion;
  fingerprint: string;
  content: string;
  parsed?: T;
  usage: ExecutionUsage;
  cached: boolean;
  durationMs: number;
  finishReason: "stop" | "length" | "cancelled" | "error" | "tool_call";
}

// ─── Provider adapter contract ───────────────────────────────────────────────
export interface ProviderChunk {
  delta: string;
  index: number;
  finished?: boolean;
}

export interface ProviderResponse {
  content: string;
  usage: ExecutionUsage;
  finishReason: ExecutionResult["finishReason"];
}

/**
 * Provider-independent execution contract. Implementations live outside the
 * runtime (Sprint I-00X). The runtime never imports vendor SDKs.
 */
export interface ProviderAdapter {
  readonly name: string;
  execute(
    prompt: CompiledPrompt,
    opts: ExecutionOptions,
  ): Promise<ProviderResponse>;
  stream?(
    prompt: CompiledPrompt,
    opts: ExecutionOptions,
  ): AsyncIterable<ProviderChunk>;
  estimateCost?(usage: ExecutionUsage): number;
}

// ─── Registry entries ────────────────────────────────────────────────────────
export type PromptStatus = "draft" | "active" | "deprecated" | "retired";

export interface PromptRegistryEntry {
  promptId: PromptId;
  version: PromptVersion;
  status: PromptStatus;
  fragments: PromptFragment[];
  outputSchema?: OutputSchema;
  minRuntime?: string;
  createdAt: number;
  activatedAt?: number;
  deprecatedAt?: number;
  supersededBy?: PromptVersion;
  changelog?: string;
}

// ─── Templates ───────────────────────────────────────────────────────────────
export type TemplateCategory =
  | "mission"
  | "capability"
  | "journey"
  | "memory"
  | "tool"
  | "safety"
  | "output";

export interface PromptTemplate {
  id: string;
  category: TemplateCategory;
  role: PromptRole;
  order: number;
  priority: number;
  /** Mustache-style {{var}} placeholders. */
  body: string;
  requiredVariables?: string[];
}
