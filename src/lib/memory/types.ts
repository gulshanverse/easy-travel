/**
 * Memory Engine — Type contracts (EDS-001 v2.0 §2, §4).
 *
 * Every memory shares the common envelope defined in §4.1. Class-specific
 * bodies live inside `payload` and are validated against class-scoped Zod
 * schemas at the boundary (see validators.ts).
 */

// ─── Classes (§2) ────────────────────────────────────────────────────────────
export const MEMORY_CLASSES = [
  "short_term",
  "working",
  "conversation",
  "journey",
  "preference",
  "semantic",
  "episodic",
  "goal",
  "relationship",
  "spatial",
  "trust",
  "reflection",
  "portfolio",
  "archive",
  "knowledge_graph",
] as const;
export type MemoryClass = (typeof MEMORY_CLASSES)[number];

// ─── Scope, visibility, status, source ──────────────────────────────────────
export type MemoryScope = "session" | "thread" | "journey" | "user" | "group" | "tenant" | "global";

export type MemoryVisibility = "private" | "shared" | "team" | "public";

export type MemoryStatus =
  | "active"
  | "needs_reconciliation"
  | "superseded"
  | "archived"
  | "deleted"
  | "hard_deleted";

export type SourceKind =
  | "user_explicit"
  | "user_implicit"
  | "agent_inference"
  | "system_derived"
  | "import";

export interface MemorySource {
  kind: SourceKind;
  actorId: string;
  provenance?: {
    poeRunId?: string;
    toolCallId?: string;
    upstreamMemoryIds?: string[];
    [k: string]: unknown;
  };
}

export type EvidenceKind = "citation" | "observation" | "computation" | "user_statement";

export interface EvidenceRef {
  evidenceId: string;
  kind: EvidenceKind;
  weight: number; // [0,1]
  uri?: string;
}

export type EdgeType =
  | "derived_from"
  | "contradicts"
  | "supports"
  | "refines"
  | "about_entity"
  | "about_place"
  | "about_time"
  | "member_of_cluster"
  | "promoted_from"
  | "compressed_into";

export interface MemoryEdge {
  type: EdgeType;
  targetId: string;
  weight: number; // [0,1]
  meta?: Record<string, unknown>;
}

export interface DecayState {
  halfLifeSeconds: number;
  lastReinforcedAt: string; // ISO
  readCount: number;
}

export interface RedactionDescriptor {
  fields: string[]; // JSON pointers into payload
  reason: string;
  appliedAt: string;
  actorId: string;
}

// ─── Envelope (§4.1) ────────────────────────────────────────────────────────
export interface MemoryEnvelope<TPayload = unknown> {
  memoryId: string;
  class: MemoryClass;
  kind: string;
  ownerId: string;
  tenantId: string | null;
  scope: MemoryScope;
  visibility: MemoryVisibility;
  payload: TPayload;
  payloadSchemaVersion: number;
  source: MemorySource;
  evidence: EvidenceRef[];
  confidence: number; // stored [0,1]
  importance: number; // [0,1]
  trustSourceId: string | null;
  tags: string[];
  relationships: MemoryEdge[];
  relatedIds: string[];
  ttlExpiresAt: string | null;
  decayState: DecayState;
  status: MemoryStatus;
  version: number;
  contentHash: string;
  createdAt: string;
  updatedAt: string;
  lastReadAt: string | null;
  readCount: number;
  promotedFrom: string | null;
  supersededBy: string | null;
  redaction: RedactionDescriptor | null;
  // Extended scoping (optional, per-class semantics)
  threadId?: string | null;
  journeyId?: string | null;
  goalIds?: string[];
}

// Draft accepted by MemoryManager.write — the server assigns id, timestamps,
// version, hash, decay defaults, etc.
export interface MemoryDraft<TPayload = unknown> {
  class: MemoryClass;
  kind: string;
  ownerId: string;
  tenantId?: string | null;
  scope: MemoryScope;
  visibility?: MemoryVisibility;
  payload: TPayload;
  payloadSchemaVersion?: number;
  source: MemorySource;
  evidence?: EvidenceRef[];
  confidence?: number;
  importance?: number;
  trustSourceId?: string | null;
  tags?: string[];
  relationships?: MemoryEdge[];
  relatedIds?: string[];
  ttlExpiresAt?: string | null;
  threadId?: string | null;
  journeyId?: string | null;
  goalIds?: string[];
}

// ─── Retrieval (§5) ─────────────────────────────────────────────────────────
export type RetrievalPurpose =
  | "companion_turn"
  | "composer_suggest"
  | "recommendation"
  | "explanation";

export interface RetrievalBudget {
  maxItems: number;
  maxTokens: number;
  perClassCaps?: Partial<Record<MemoryClass, number>>;
  minConfidence?: number;
  diversityFloor?: number;
}

export interface RetrievalQuery {
  ownerId: string;
  purpose: RetrievalPurpose;
  text?: string;
  classes?: MemoryClass[];
  threadId?: string | null;
  journeyId?: string | null;
  goalIds?: string[];
  tags?: string[];
  filters?: Record<string, unknown>;
  budget?: Partial<RetrievalBudget>;
  minTrust?: number;
  includeArchived?: boolean;
  now?: number; // ms epoch — for determinism/tests
}

export interface ScoreDecomposition {
  confidenceEffective: number;
  similarity: number;
  recency: number;
  importance: number;
  trust: number;
  goalAlignment: number;
  contradictionPenalty: number;
  final: number;
}

export interface RankedMemory<T = unknown> {
  memory: MemoryEnvelope<T>;
  score: ScoreDecomposition;
  stage: string; // last stage that touched the item
  alsoSeenIds?: string[];
}

export interface RetrievalTrace {
  queryHash: string;
  purpose: RetrievalPurpose;
  stageCounts: Record<string, number>;
  dropped: Array<{ memoryId: string; reason: string }>;
  weightsProfile: string;
  weightsVersion: number;
  degraded: boolean;
  degradedReason?: string;
  latencyMs: number;
}

export interface RetrievalResult<T = unknown> {
  items: RankedMemory<T>[];
  trace: RetrievalTrace;
  correlationId: string;
}
