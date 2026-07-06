/**
 * AI Core — Centralized configuration.
 * Everything else in the AI Core reads from here. Never hardcode elsewhere.
 */

export type ProviderId = "lovable"; // Additional providers routed through Lovable AI Gateway.

export type ModelId =
  // Google Gemini family
  | "google/gemini-3-flash-preview"
  | "google/gemini-2.5-flash"
  | "google/gemini-2.5-flash-lite"
  | "google/gemini-2.5-pro"
  // OpenAI family
  | "openai/gpt-5"
  | "openai/gpt-5-mini"
  | "openai/gpt-5-nano";

export interface ModelProfile {
  id: ModelId;
  provider: ProviderId;
  displayName: string;
  supportsStructured: boolean;
  supportsTools: boolean;
  supportsStreaming: boolean;
  costTier: "low" | "medium" | "high";
}

export const MODEL_CATALOG: Record<ModelId, ModelProfile> = {
  "google/gemini-3-flash-preview": {
    id: "google/gemini-3-flash-preview",
    provider: "lovable",
    displayName: "Gemini 3 Flash (preview)",
    supportsStructured: true,
    supportsTools: true,
    supportsStreaming: true,
    costTier: "low",
  },
  "google/gemini-2.5-flash": {
    id: "google/gemini-2.5-flash",
    provider: "lovable",
    displayName: "Gemini 2.5 Flash",
    supportsStructured: true,
    supportsTools: true,
    supportsStreaming: true,
    costTier: "low",
  },
  "google/gemini-2.5-flash-lite": {
    id: "google/gemini-2.5-flash-lite",
    provider: "lovable",
    displayName: "Gemini 2.5 Flash Lite",
    supportsStructured: true,
    supportsTools: false,
    supportsStreaming: true,
    costTier: "low",
  },
  "google/gemini-2.5-pro": {
    id: "google/gemini-2.5-pro",
    provider: "lovable",
    displayName: "Gemini 2.5 Pro",
    supportsStructured: true,
    supportsTools: true,
    supportsStreaming: true,
    costTier: "high",
  },
  "openai/gpt-5": {
    id: "openai/gpt-5",
    provider: "lovable",
    displayName: "GPT-5",
    supportsStructured: true,
    supportsTools: true,
    supportsStreaming: true,
    costTier: "high",
  },
  "openai/gpt-5-mini": {
    id: "openai/gpt-5-mini",
    provider: "lovable",
    displayName: "GPT-5 Mini",
    supportsStructured: true,
    supportsTools: true,
    supportsStreaming: true,
    costTier: "medium",
  },
  "openai/gpt-5-nano": {
    id: "openai/gpt-5-nano",
    provider: "lovable",
    displayName: "GPT-5 Nano",
    supportsStructured: true,
    supportsTools: false,
    supportsStreaming: true,
    costTier: "low",
  },
};

export interface AIConfig {
  defaultModel: ModelId;
  fallbackModel: ModelId;
  structuredModel: ModelId;
  reasoningModel: ModelId;
  temperature: number;
  topP: number;
  maxOutputTokens: number;
  timeoutMs: number;
  retries: number;
  streaming: boolean;
  cachePromptsTtlMs: number;
  contextTokenBudget: number;
  memoryTopK: number;
  rateLimit: {
    perUserPerMinute: number;
    perUserPerDay: number;
  };
}

export const AI_CONFIG: AIConfig = {
  defaultModel: "google/gemini-3-flash-preview",
  fallbackModel: "google/gemini-2.5-flash",
  structuredModel: "google/gemini-2.5-flash",
  reasoningModel: "google/gemini-2.5-pro",
  temperature: 0.7,
  topP: 0.95,
  maxOutputTokens: 2048,
  timeoutMs: 45_000,
  retries: 1,
  streaming: true,
  cachePromptsTtlMs: 60_000,
  contextTokenBudget: 6_000,
  memoryTopK: 8,
  rateLimit: {
    perUserPerMinute: 30,
    perUserPerDay: 500,
  },
};

export function resolveModel(input?: ModelId): ModelProfile {
  const id = input ?? AI_CONFIG.defaultModel;
  const profile = MODEL_CATALOG[id];
  if (!profile) throw new Error(`Unknown model: ${id}`);
  return profile;
}
