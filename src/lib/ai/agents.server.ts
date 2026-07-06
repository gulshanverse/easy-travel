/**
 * AI Core — Agent framework.
 * Every future agent implements the Agent interface. The registry maps names
 * to implementations; the AI Core resolves and dispatches.
 */
import { invokeAI } from "./core.server";
import type { AIInvokeParams, AIRequestContext, AIResult } from "./types";
import type { ModelId } from "./config";

export interface AgentDefinition<TInput = unknown, TOutput = string> {
  name: string;
  description: string;
  version: string;
  defaultModel?: ModelId;
  systemPromptKey?: string;
  tools?: string[];
  /** Turn the agent's typed input into AI Core invoke params. */
  buildRequest: (input: TInput, ctx: AIRequestContext) => Promise<AIInvokeParams<TOutput>> | AIInvokeParams<TOutput>;
  /** Optional post-processing on the raw AI result. */
  parse?: (result: AIResult<TOutput>) => TOutput | Promise<TOutput>;
}

const agents = new Map<string, AgentDefinition<any, any>>();

export function registerAgent<I, O>(agent: AgentDefinition<I, O>) {
  agents.set(agent.name, agent as AgentDefinition<any, any>);
}

export function getAgent(name: string) {
  return agents.get(name);
}

export function listAgents() {
  return Array.from(agents.values()).map((a) => ({
    name: a.name,
    description: a.description,
    version: a.version,
  }));
}

/** Dispatch an agent by name with typed input. */
export async function runAgent<I, O = string>(
  name: string,
  input: I,
  ctx: AIRequestContext,
): Promise<AIResult<O>> {
  const agent = agents.get(name) as AgentDefinition<I, O> | undefined;
  if (!agent) throw new Error(`Unknown agent: ${name}`);
  const params = await agent.buildRequest(input, { ...ctx, agent: agent.name });
  const result = await invokeAI<O>(params);
  if (agent.parse) result.output = (await agent.parse(result)) as O;
  return result;
}

// -------------------- Registered agent stubs --------------------
// Interfaces only. Implementations arrive as future milestones use them.

registerAgent({
  name: "planner",
  description: "Generates a complete travel itinerary from user intent.",
  version: "0.1.0",
  systemPromptKey: "agent.planner.system",
  buildRequest: (input: { prompt: string }, ctx) => ({
    ctx: { ...ctx, feature: "planner" },
    promptKey: "agent.planner.system",
    promptVariables: {},
    messages: [{ role: "user", content: input.prompt }],
  }),
});

for (const [name, description] of [
  ["budget", "Budget analysis and optimization."],
  ["recommendation", "Personalized destination and activity suggestions."],
  ["weather", "Weather-aware advice for a trip."],
  ["safety", "Travel safety, visa, and emergency guidance."],
  ["translator", "Traveler-friendly translation."],
  ["memory", "Extracts persistent preferences from a conversation."],
  ["booking", "Assists with search/compare/book flows (uses tools)."],
  ["expense", "Categorizes and summarizes trip expenses."],
  ["local_guide", "Local tips: food, culture, hidden gems."],
  ["packing", "Packing checklist tailored to trip + weather."],
  ["emergency", "Emergency contacts and step-by-step help."],
] as const) {
  registerAgent({
    name,
    description,
    version: "0.1.0",
    buildRequest: (input: { prompt: string }, ctx) => ({
      ctx: { ...ctx, feature: name },
      system: `You are the ${name} agent for Easy Trip. Be concise and practical.`,
      messages: [{ role: "user", content: input.prompt }],
    }),
  });
}
