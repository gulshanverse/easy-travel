/**
 * AI Core — Agent Manifest.
 * Every registered agent ships a manifest with tuning, permissions, cost
 * limits, and provider compatibility. Manifests are declarative and safe
 * to serialize to the client (no executables).
 */
import type { ModelId, ProviderId } from "./config";
import type { MemoryKind } from "./memory.server";

export type AgentCategory = "planning" | "search" | "content" | "assistant" | "safety" | "utility";
export type AgentPriority = "low" | "normal" | "high";

export interface AgentPermissions {
  requiresAuth: boolean;
  requiresRole?: string;
  allowsTools: boolean;
  allowsMemoryWrite: boolean;
}

export interface AgentCostLimits {
  /** Max tokens per single call. */
  maxTokensPerCall: number;
  /** Max calls per user per hour. */
  maxCallsPerHour: number;
  /** Soft cap on gateway credits per call. */
  maxCreditsPerCall: number;
}

export interface AgentManifest {
  name: string;
  description: string;
  version: string;
  category: AgentCategory;
  priority: AgentPriority;
  defaultModel: ModelId;
  fallbackModel?: ModelId;
  systemPromptKey?: string;
  allowedTools: string[];
  memoryScope: MemoryKind[];
  temperature: number;
  maxOutputTokens: number;
  streaming: boolean;
  timeoutMs: number;
  retries: number;
  permissions: AgentPermissions;
  costLimits: AgentCostLimits;
  providerCompatibility: ProviderId[];
  metadata?: Record<string, unknown>;
}

export const DEFAULT_PERMISSIONS: AgentPermissions = {
  requiresAuth: true,
  allowsTools: true,
  allowsMemoryWrite: false,
};

export const DEFAULT_COST_LIMITS: AgentCostLimits = {
  maxTokensPerCall: 4_000,
  maxCallsPerHour: 60,
  maxCreditsPerCall: 5,
};

export function mergeManifest(partial: Partial<AgentManifest> & Pick<AgentManifest, "name" | "description">): AgentManifest {
  return {
    version: "0.1.0",
    category: "utility",
    priority: "normal",
    defaultModel: "google/gemini-3-flash-preview",
    allowedTools: [],
    memoryScope: ["short_term", "long_term"],
    temperature: 0.7,
    maxOutputTokens: 2048,
    streaming: true,
    timeoutMs: 45_000,
    retries: 1,
    permissions: DEFAULT_PERMISSIONS,
    costLimits: DEFAULT_COST_LIMITS,
    providerCompatibility: ["lovable"],
    ...partial,
  };
}
