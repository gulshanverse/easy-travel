/**
 * Runtime configuration for the Prompt Orchestration Engine.
 * Values are provider-independent. Environment profiles override defaults.
 */
import type { TokenBudget } from "./types";

export type EnvironmentProfile = "development" | "staging" | "production";

export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitter: boolean;
}

export interface TimeoutPolicy {
  compileMs: number;
  executeMs: number;
  streamIdleMs: number;
}

export interface BudgetPolicy {
  default: TokenBudget;
  /** Enable adaptive slack (soft→hard extension). */
  adaptive: boolean;
  /** Trim below this ratio before compression fires. */
  compressionThreshold: number;
}

export interface ValidationPolicy {
  strictSchema: boolean;
  allowRepair: boolean;
  maxRepairAttempts: number;
}

export interface StreamingPolicy {
  enabled: boolean;
  backpressureBytes: number;
}

export interface CachePolicy {
  compiled: { enabled: boolean; ttlMs: number; maxEntries: number };
  semantic: { enabled: boolean; ttlMs: number; maxEntries: number };
  context: { enabled: boolean; ttlMs: number; maxEntries: number };
  template: { enabled: boolean; ttlMs: number; maxEntries: number };
}

export interface FeatureFlags {
  contextCompression: boolean;
  deterministicCompilation: boolean;
  semanticCache: boolean;
  streamChunkValidation: boolean;
}

export interface PromptConfiguration {
  profile: EnvironmentProfile;
  budget: BudgetPolicy;
  retry: RetryPolicy;
  timeout: TimeoutPolicy;
  validation: ValidationPolicy;
  streaming: StreamingPolicy;
  cache: CachePolicy;
  flags: FeatureFlags;
}

export const DEFAULT_BUDGET: TokenBudget = {
  hard: 16_000,
  soft: 12_000,
  reservedOutput: 2_000,
  adaptiveSlack: 512,
};

export const DEFAULT_PROMPT_CONFIG: PromptConfiguration = {
  profile: "production",
  budget: { default: DEFAULT_BUDGET, adaptive: true, compressionThreshold: 0.85 },
  retry: { maxAttempts: 3, baseDelayMs: 200, maxDelayMs: 4_000, jitter: true },
  timeout: { compileMs: 500, executeMs: 30_000, streamIdleMs: 15_000 },
  validation: { strictSchema: true, allowRepair: true, maxRepairAttempts: 2 },
  streaming: { enabled: true, backpressureBytes: 64 * 1024 },
  cache: {
    compiled: { enabled: true, ttlMs: 10 * 60 * 1000, maxEntries: 500 },
    semantic: { enabled: false, ttlMs: 5 * 60 * 1000, maxEntries: 500 },
    context: { enabled: true, ttlMs: 60 * 1000, maxEntries: 500 },
    template: { enabled: true, ttlMs: 60 * 60 * 1000, maxEntries: 500 },
  },
  flags: {
    contextCompression: true,
    deterministicCompilation: true,
    semanticCache: false,
    streamChunkValidation: true,
  },
};

export function loadPromptConfiguration(
  overrides: Partial<PromptConfiguration> = {},
): PromptConfiguration {
  return deepMerge(DEFAULT_PROMPT_CONFIG, overrides) as PromptConfiguration;
}

function deepMerge<T>(base: T, over: Partial<T>): T {
  if (!over || typeof over !== "object") return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(over as Record<string, unknown>)) {
    const cur = out[k];
    if (v && typeof v === "object" && !Array.isArray(v) && cur && typeof cur === "object" && !Array.isArray(cur)) {
      out[k] = deepMerge(cur, v as Record<string, unknown>);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out as T;
}
