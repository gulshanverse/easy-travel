/**
 * Memory Engine — Runtime configuration (EDS-001 v2.0 §9).
 *
 * All tunables live here — never hardcoded elsewhere. Values are derived from
 * environment (server-side) or from the caller (tests). Class policies mirror
 * the §2 table.
 */
import type { MemoryClass, RetrievalBudget, RetrievalPurpose } from "./types";

// ─── Feature flags ──────────────────────────────────────────────────────────
export interface MemoryFeatureFlags {
  enableCompression: boolean;
  enablePromotion: boolean;
  enableSemanticSearch: boolean;
  enableRelationshipExpansion: boolean;
  strictContradictionCheck: boolean;
  softDeleteEnabled: boolean;
}

const DEFAULT_FLAGS: MemoryFeatureFlags = {
  enableCompression: true,
  enablePromotion: true,
  enableSemanticSearch: true,
  enableRelationshipExpansion: true,
  strictContradictionCheck: false,
  softDeleteEnabled: true,
};

// ─── Class policies (defaults) ──────────────────────────────────────────────
export interface ClassPolicy {
  ttlSeconds: number | null; // null = indefinite
  decayHalfLifeSeconds: number; // 0 = no decay
  promotable: boolean;
  archiveOnExpire: boolean;
  archiveOrHardDelete: "archive" | "hard_delete";
  softDeleteGraceSeconds: number;
  compressionThreshold: number; // #memories in cluster before compress
  maxImportance: number;
  minImportanceToPromote: number;
}

const HOUR = 3600;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

export const DEFAULT_CLASS_POLICIES: Record<MemoryClass, ClassPolicy> = {
  short_term: pol({ ttl: 5 * 60, half: 60, promo: true }),
  working: pol({ ttl: 4 * HOUR, half: 30 * 60, promo: true }),
  conversation: pol({ ttl: 30 * DAY, half: 3 * DAY, promo: true }),
  journey: pol({ ttl: null, half: 30 * DAY, promo: true }),
  preference: pol({ ttl: 24 * MONTH, half: 90 * DAY, promo: true }),
  semantic: pol({ ttl: null, half: 180 * DAY, promo: false }),
  episodic: pol({ ttl: 5 * YEAR, half: 180 * DAY, promo: true }),
  goal: pol({ ttl: null, half: 30 * DAY, promo: true }),
  relationship: pol({ ttl: null, half: 180 * DAY, promo: false }),
  spatial: pol({ ttl: null, half: 180 * DAY, promo: true }),
  trust: pol({ ttl: null, half: 30 * DAY, promo: false }),
  reflection: pol({ ttl: 12 * MONTH, half: 60 * DAY, promo: true }),
  portfolio: pol({ ttl: null, half: 180 * DAY, promo: false }),
  archive: pol({ ttl: null, half: 0, promo: false, archive: true }),
  knowledge_graph: pol({ ttl: null, half: 0, promo: false }),
};

function pol(opts: {
  ttl: number | null;
  half: number;
  promo: boolean;
  archive?: boolean;
}): ClassPolicy {
  return {
    ttlSeconds: opts.ttl,
    decayHalfLifeSeconds: opts.half,
    promotable: opts.promo,
    archiveOnExpire: !opts.archive,
    archiveOrHardDelete: "archive",
    softDeleteGraceSeconds: 30 * DAY,
    compressionThreshold: 20,
    maxImportance: 1,
    minImportanceToPromote: 0.4,
  };
}

// ─── Ranking weight profiles (§5.8) ─────────────────────────────────────────
export interface RankWeights {
  confidence: number;
  similarity: number;
  recency: number;
  importance: number;
  trust: number;
  goalAlignment: number;
  contradictionPenalty: number;
}

export interface RankProfile {
  name: RetrievalPurpose;
  version: number;
  weights: RankWeights;
}

export const DEFAULT_RANK_PROFILES: Record<RetrievalPurpose, RankProfile> = {
  companion_turn: {
    name: "companion_turn",
    version: 1,
    weights: {
      confidence: 0.25,
      similarity: 0.25,
      recency: 0.2,
      importance: 0.15,
      trust: 0.1,
      goalAlignment: 0.05,
      contradictionPenalty: 0.3,
    },
  },
  composer_suggest: {
    name: "composer_suggest",
    version: 1,
    weights: {
      confidence: 0.2,
      similarity: 0.3,
      recency: 0.15,
      importance: 0.15,
      trust: 0.05,
      goalAlignment: 0.15,
      contradictionPenalty: 0.3,
    },
  },
  recommendation: {
    name: "recommendation",
    version: 1,
    weights: {
      confidence: 0.25,
      similarity: 0.15,
      recency: 0.05,
      importance: 0.2,
      trust: 0.15,
      goalAlignment: 0.2,
      contradictionPenalty: 0.4,
    },
  },
  explanation: {
    name: "explanation",
    version: 1,
    weights: {
      confidence: 0.3,
      similarity: 0.2,
      recency: 0.05,
      importance: 0.15,
      trust: 0.2,
      goalAlignment: 0.1,
      contradictionPenalty: 0.5,
    },
  },
};

// ─── Retrieval budget defaults ──────────────────────────────────────────────
export const DEFAULT_BUDGET: RetrievalBudget = {
  maxItems: 24,
  maxTokens: 3000,
  minConfidence: 0.05,
  diversityFloor: 2,
  perClassCaps: {
    short_term: 4,
    working: 4,
    conversation: 6,
    journey: 6,
    preference: 6,
    semantic: 6,
    episodic: 4,
    goal: 3,
    relationship: 2,
    spatial: 3,
    trust: 2,
    reflection: 2,
    portfolio: 2,
    archive: 0,
    knowledge_graph: 2,
  },
};

// ─── Full configuration object ──────────────────────────────────────────────
export interface MemoryConfiguration {
  flags: MemoryFeatureFlags;
  classPolicies: Record<MemoryClass, ClassPolicy>;
  rankProfiles: Record<RetrievalPurpose, RankProfile>;
  defaultBudget: RetrievalBudget;
  stageTimeoutMs: number;
  outboxBatchSize: number;
  tombstoneRetentionSeconds: number;
}

const g = globalThis as unknown as { process?: { env?: Record<string, string | undefined> } };
const env = g.process?.env ?? {};

function num(name: string, def: number): number {
  const raw = env[name];
  if (!raw) return def;
  const n = Number(raw);
  return Number.isFinite(n) ? n : def;
}

function bool(name: string, def: boolean): boolean {
  const raw = env[name];
  if (raw === undefined) return def;
  return raw === "true" || raw === "1";
}

/** Load config from env, deep-merging with defaults. */
export function loadMemoryConfiguration(
  overrides: Partial<MemoryConfiguration> = {},
): MemoryConfiguration {
  const base: MemoryConfiguration = {
    flags: {
      ...DEFAULT_FLAGS,
      enableCompression: bool("MEMORY_ENABLE_COMPRESSION", DEFAULT_FLAGS.enableCompression),
      enablePromotion: bool("MEMORY_ENABLE_PROMOTION", DEFAULT_FLAGS.enablePromotion),
      enableSemanticSearch: bool(
        "MEMORY_ENABLE_SEMANTIC_SEARCH",
        DEFAULT_FLAGS.enableSemanticSearch,
      ),
      enableRelationshipExpansion: bool(
        "MEMORY_ENABLE_REL_EXPANSION",
        DEFAULT_FLAGS.enableRelationshipExpansion,
      ),
      strictContradictionCheck: bool(
        "MEMORY_STRICT_CONTRADICTIONS",
        DEFAULT_FLAGS.strictContradictionCheck,
      ),
      softDeleteEnabled: bool("MEMORY_SOFT_DELETE", DEFAULT_FLAGS.softDeleteEnabled),
    },
    classPolicies: DEFAULT_CLASS_POLICIES,
    rankProfiles: DEFAULT_RANK_PROFILES,
    defaultBudget: DEFAULT_BUDGET,
    stageTimeoutMs: num("MEMORY_STAGE_TIMEOUT_MS", 2000),
    outboxBatchSize: num("MEMORY_OUTBOX_BATCH", 32),
    tombstoneRetentionSeconds: num("MEMORY_TOMBSTONE_RETENTION_S", YEAR),
  };
  return { ...base, ...overrides };
}
