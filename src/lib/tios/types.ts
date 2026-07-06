/**
 * TIOS — Travel Intelligence Operating System
 * Shared types for capabilities, decisions, policies, context, and recommendations.
 */

export type CapabilityId =
  | "planner" | "budget" | "weather" | "maps" | "flights" | "hotels"
  | "restaurants" | "experiences" | "packing" | "translator" | "visa"
  | "booking" | "safety" | "emergency" | "notifications" | "calendar"
  | "currency" | "reviews" | "analytics" | (string & {});

export type HealthStatus = "healthy" | "degraded" | "down" | "unknown";

export interface CapabilityManifest {
  id: CapabilityId;
  version: string;
  description: string;
  dependencies: CapabilityId[];
  permissions: string[];
  inputSchema?: unknown;   // JSONSchema-compatible, optional
  outputSchema?: unknown;
  supportedAgents: string[];
  supportedProviders: string[];
  priority: number;        // 1 (low) → 100 (high)
  featureFlags: string[];  // flags gating this capability
  tags?: string[];
}

export interface CapabilityRuntime {
  manifest: CapabilityManifest;
  health: HealthStatus;
  registeredAt: number;
  invoke?: (input: unknown, ctx: DecisionContext) => Promise<unknown>;
}

// ---------- Policies ----------
export type PolicyEffect = "allow" | "deny" | "warn";

export interface PolicyRule<TInput = Record<string, unknown>> {
  id: string;
  description: string;
  category: string;
  enabled: boolean;
  effect: PolicyEffect;
  evaluate: (input: TInput, ctx: DecisionContext) => boolean | Promise<boolean>;
  message?: string;
}

export interface PolicyDecision {
  ruleId: string;
  effect: PolicyEffect;
  matched: boolean;
  message?: string;
}

// ---------- Context Graph ----------
export type ContextNodeType =
  | "user" | "trip" | "destination" | "companion" | "budget" | "weather"
  | "booking" | "preference" | "time" | "device" | "language" | "currency";

export type ContextEdgeType =
  | "travelling_to" | "prefers" | "contains" | "belongs_to"
  | "depends_on" | "scheduled_at";

export interface ContextNode<T = Record<string, unknown>> {
  id: string;
  type: ContextNodeType;
  data: T;
  updatedAt: number;
}

export interface ContextEdge {
  from: string; // node id
  to: string;
  type: ContextEdgeType;
  weight?: number;
  data?: Record<string, unknown>;
}

export interface DecisionContext {
  requestId: string;
  userId?: string | null;
  tripId?: string | null;
  locale?: string;
  currency?: string;
  now: number;
  graph: ContextGraphSnapshot;
  flags: Record<string, boolean>;
  metadata?: Record<string, unknown>;
}

export interface ContextGraphSnapshot {
  nodes: ContextNode[];
  edges: ContextEdge[];
}

// ---------- Recommendations ----------
export interface RecommendationCandidate<T = Record<string, unknown>> {
  id: string;
  type: string;         // e.g. "destination", "hotel"
  payload: T;
  baseScore: number;    // from knowledge/business rules (0..1)
}

export interface RecommendationScored<T = Record<string, unknown>>
  extends RecommendationCandidate<T> {
  score: number;             // final ranked score (0..1)
  confidence: number;        // 0..1
  reasons: string[];         // WHY
  antiReasons?: string[];    // WHY NOT
  alternativeIds?: string[]; // alternative candidate ids
}

export interface Explanation {
  summary: string;
  reasons: string[];
  antiReasons: string[];
  alternatives: Array<{ id: string; label: string }>;
  confidence: number;
}

export interface Decision<T = unknown> {
  id: string;
  capabilityId: CapabilityId;
  createdAt: number;
  output: T;
  explanation: Explanation;
  policies: PolicyDecision[];
  latencyMs: number;
}

// ---------- Feature Flags ----------
export type FeatureFlagName =
  | "PlannerV2" | "BudgetV2" | "Claude" | "Gemini" | "OpenAI"
  | "Weather" | "Maps" | "KnowledgeGraph" | "DecisionEngine"
  | (string & {});

// ---------- Knowledge Graph interfaces ----------
export type KnowledgeEntityType =
  | "country" | "city" | "airport" | "station" | "hotel" | "restaurant"
  | "experience" | "weather" | "visa" | "currency" | "language"
  | "transport" | "festival" | "emergency_service" | "medical"
  | "embassy" | "review" | "event";

export interface KnowledgeQuery {
  entity: KnowledgeEntityType;
  filters?: Record<string, unknown>;
  limit?: number;
}

export interface KnowledgeResult<T = Record<string, unknown>> {
  entity: KnowledgeEntityType;
  items: T[];
  source: string;
}

export interface KnowledgeProvider {
  id: string;
  supports: (entity: KnowledgeEntityType) => boolean;
  query: <T = Record<string, unknown>>(q: KnowledgeQuery) => Promise<KnowledgeResult<T>>;
}
