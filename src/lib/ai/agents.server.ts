/**
 * AI Core — Agent framework + registry.
 * Every registered agent ships an AgentManifest describing its tuning,
 * permissions, cost limits, and provider compatibility. The manifest is
 * merged into every invocation so behavior is declarative, not hidden.
 */
import { invokeAI } from "./core.server";
import type { AIInvokeParams, AIRequestContext, AIResult } from "./types";
import type { ModelId } from "./config";
import { emitAIEvent } from "./events";
import { mergeManifest, type AgentManifest } from "./manifest";

export interface AgentDefinition<TInput = unknown, TOutput = string> {
  name: string;
  description: string;
  version: string;
  defaultModel?: ModelId;
  systemPromptKey?: string;
  tools?: string[];
  manifest?: Partial<AgentManifest>;
  buildRequest: (input: TInput, ctx: AIRequestContext) => Promise<AIInvokeParams<TOutput>> | AIInvokeParams<TOutput>;
  parse?: (result: AIResult<TOutput>) => TOutput | Promise<TOutput>;
}

interface RegisteredAgent {
  definition: AgentDefinition<any, any>;
  manifest: AgentManifest;
}

const agents = new Map<string, RegisteredAgent>();

export function registerAgent<I, O>(agent: AgentDefinition<I, O>) {
  const manifest = mergeManifest({
    name: agent.name,
    description: agent.description,
    version: agent.version,
    defaultModel: agent.defaultModel ?? "google/gemini-3-flash-preview",
    systemPromptKey: agent.systemPromptKey,
    allowedTools: agent.tools ?? [],
    ...(agent.manifest ?? {}),
  });
  agents.set(agent.name, { definition: agent as AgentDefinition<any, any>, manifest });
}

export function getAgent(name: string) {
  return agents.get(name)?.definition;
}

export function getAgentManifest(name: string): AgentManifest | undefined {
  return agents.get(name)?.manifest;
}

export function listAgents(): AgentManifest[] {
  return Array.from(agents.values()).map((a) => a.manifest);
}

/** Dispatch an agent by name with typed input. Emits lifecycle events. */
export async function runAgent<I, O = string>(
  name: string,
  input: I,
  ctx: AIRequestContext,
): Promise<AIResult<O>> {
  const entry = agents.get(name);
  if (!entry) throw new Error(`Unknown agent: ${name}`);
  const { definition, manifest } = entry;
  const params = await definition.buildRequest(input, { ...ctx, agent: manifest.name });

  // Apply manifest defaults unless the agent's buildRequest overrode them.
  const merged: AIInvokeParams<O> = {
    ...params,
    model: params.model ?? manifest.defaultModel,
    temperature: params.temperature ?? manifest.temperature,
    maxOutputTokens: params.maxOutputTokens ?? manifest.maxOutputTokens,
    tools: params.tools ?? (manifest.allowedTools.length ? manifest.allowedTools : undefined),
  };

  try {
    const result = await invokeAI<O>(merged);
    if (definition.parse) result.output = (await definition.parse(result)) as O;
    emitAIEvent({
      name: "AI_COMPLETED",
      requestId: result.requestId,
      agent: manifest.name,
      feature: merged.ctx.feature,
      userId: merged.ctx.userId,
      data: { model: result.model, latencyMs: result.latencyMs, usage: result.usage },
    });
    return result;
  } catch (err) {
    emitAIEvent({
      name: "AI_FAILED",
      requestId: "unknown",
      agent: manifest.name,
      feature: merged.ctx.feature,
      userId: merged.ctx.userId,
      data: { message: err instanceof Error ? err.message : String(err) },
    });
    throw err;
  }
}

// -------------------- Registered agents (manifest-driven stubs) --------------------

registerAgent({
  name: "planner",
  description: "Generates a complete travel itinerary from user intent.",
  version: "0.1.0",
  systemPromptKey: "agent.planner.system",
  defaultModel: "google/gemini-2.5-pro",
  manifest: {
    category: "planning",
    priority: "high",
    temperature: 0.6,
    maxOutputTokens: 4096,
    memoryScope: ["trip", "preference", "long_term"],
    permissions: { requiresAuth: true, allowsTools: true, allowsMemoryWrite: true },
    costLimits: { maxTokensPerCall: 8000, maxCallsPerHour: 20, maxCreditsPerCall: 15 },
  },
  buildRequest: (input: { prompt: string }, ctx) => ({
    ctx: { ...ctx, feature: "planner" },
    promptKey: "agent.planner.system",
    promptVariables: {},
    messages: [{ role: "user", content: input.prompt }],
  }),
});

const stubs: Array<[string, string, Partial<AgentManifest>]> = [
  ["budget", "Budget analysis and optimization.", { category: "planning" }],
  ["recommendation", "Personalized destination and activity suggestions.", { category: "search" }],
  ["weather", "Weather-aware advice for a trip.", { category: "utility", allowedTools: ["get_current_weather"] }],
  ["safety", "Travel safety, visa, and emergency guidance.", { category: "safety", priority: "high" }],
  ["translator", "Traveler-friendly translation.", { category: "content", temperature: 0.3 }],
  ["memory", "Extracts persistent preferences from a conversation.", { category: "utility", permissions: { requiresAuth: true, allowsTools: false, allowsMemoryWrite: true } }],
  ["booking", "Assists with search/compare/book flows (uses tools).", { category: "assistant", priority: "high" }],
  ["expense", "Categorizes and summarizes trip expenses.", { category: "utility" }],
  ["local_guide", "Local tips: food, culture, hidden gems.", { category: "content" }],
  ["packing", "Packing checklist tailored to trip + weather.", { category: "content", allowedTools: ["get_current_weather"] }],
  ["emergency", "Emergency contacts and step-by-step help.", { category: "safety", priority: "high", temperature: 0.2 }],
];

for (const [name, description, manifest] of stubs) {
  registerAgent({
    name,
    description,
    version: "0.1.0",
    manifest,
    buildRequest: (input: { prompt: string }, ctx) => ({
      ctx: { ...ctx, feature: name },
      system: `You are the ${name} agent for Easy Trip. Be concise and practical.`,
      messages: [{ role: "user", content: input.prompt }],
    }),
  });
}
