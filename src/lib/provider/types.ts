/**
 * Provider Runtime — Public type surface.
 * Provider-independent. No vendor SDKs or payload shapes.
 */

export type ProviderId = string;
export type ModelId = string;

export type ProviderKind =
  | "openai"
  | "anthropic"
  | "gemini"
  | "groq"
  | "nvidia"
  | "ollama"
  | "openrouter"
  | "azure-openai"
  | "local"
  | "custom";

export type ModelInputType = "text" | "image" | "audio" | "video" | "tool_call";
export type ModelOutputType = "text" | "image" | "audio" | "embedding" | "tool_call";

export type LatencyTier = "realtime" | "low" | "medium" | "high";
export type CostTier = "free" | "cheap" | "standard" | "premium" | "enterprise";
export type Availability = "ga" | "preview" | "beta" | "experimental" | "deprecated";
export type ModelStatus = "active" | "degraded" | "disabled" | "retired";
export type ModelLifecycle = "draft" | "released" | "deprecated" | "retired";

export interface ProviderCapabilityFlags {
  streaming: boolean;
  jsonOutput: boolean;
  toolCalling: boolean;
  functionCalling: boolean;
  vision: boolean;
  speech: boolean;
  embeddings: boolean;
  fineTuning?: boolean;
}

export interface ModelDescriptor {
  id: ModelId;
  providerId: ProviderId;
  providerKind: ProviderKind;
  version: string;
  contextWindow: number;
  maxOutputTokens?: number;
  inputTypes: readonly ModelInputType[];
  outputTypes: readonly ModelOutputType[];
  capabilities: ProviderCapabilityFlags;
  latencyTier: LatencyTier;
  costTier: CostTier;
  availability: Availability;
  status: ModelStatus;
  lifecycle: ModelLifecycle;
  pricing?: PricingModel;
  tags?: readonly string[];
  metadata?: Readonly<Record<string, unknown>>;
}

export interface PricingModel {
  inputPer1kTokens: number;
  outputPer1kTokens: number;
  currency?: string;
}

export interface TokenBudget {
  maxInputTokens?: number;
  maxOutputTokens?: number;
  maxTotalTokens?: number;
  /** Cost cap in the pricing model's currency. */
  maxCost?: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costEstimate?: number;
}

export interface ProviderCredentialsRef {
  /** Named reference resolved by a SecretProvider — NEVER a raw secret value. */
  ref: string;
  scheme?: "api-key" | "oauth2" | "aws-sigv4" | "custom";
}

export interface ProviderConfig {
  id: ProviderId;
  kind: ProviderKind;
  displayName: string;
  baseURL?: string;
  weight?: number;
  priority?: number;
  enabled?: boolean;
  credentials?: ProviderCredentialsRef;
  capabilities: ProviderCapabilityFlags;
  regions?: readonly string[];
  tags?: readonly string[];
  metadata?: Readonly<Record<string, unknown>>;
}

export type ProviderHealthState = "healthy" | "degraded" | "unavailable" | "unknown";

export interface ProviderHealthSnapshot {
  providerId: ProviderId;
  state: ProviderHealthState;
  circuit: "closed" | "open" | "half-open";
  successStreak: number;
  failureStreak: number;
  lastLatencyMs?: number;
  lastCheckedAt: number;
  cooldownUntil?: number;
  reason?: string;
}

export type RoutingStrategy =
  | "capability"
  | "latency"
  | "cost"
  | "context-window"
  | "weighted"
  | "sticky"
  | "affinity"
  | "health-aware";

export interface RoutingRule {
  id: string;
  strategy: RoutingStrategy;
  weight?: number;
  requires?: Partial<ProviderCapabilityFlags>;
  minContextWindow?: number;
  preferProviders?: readonly ProviderId[];
  preferModels?: readonly ModelId[];
  affinityKey?: string;
  maxLatencyTier?: LatencyTier;
  maxCostTier?: CostTier;
}

export interface ExecutionRequest {
  requestId: string;
  correlationId: string;
  causationId?: string;
  /** Session key used for sticky routing. */
  sessionId?: string;
  requires: Partial<ProviderCapabilityFlags>;
  minContextWindow?: number;
  requestedProvider?: ProviderId;
  requestedModel?: ModelId;
  budget?: TokenBudget;
  routing?: readonly RoutingRule[];
  /** Opaque provider-independent payload. Adapter interprets it. */
  payload: unknown;
  streaming?: boolean;
  signal?: AbortSignal;
  metadata?: Readonly<Record<string, unknown>>;
}

export interface ExecutionResult<T = unknown> {
  requestId: string;
  correlationId: string;
  executionId: string;
  providerId: ProviderId;
  modelId: ModelId;
  output: T;
  usage: TokenUsage;
  latencyMs: number;
  attempts: number;
  fallbacks: number;
  finishReason?: string;
  streamed: boolean;
  metadata?: Readonly<Record<string, unknown>>;
}

export type StreamChunk<T = unknown> =
  | { kind: "delta"; delta: T }
  | { kind: "usage"; usage: TokenUsage }
  | { kind: "finish"; finishReason?: string };
