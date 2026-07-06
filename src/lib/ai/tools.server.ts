/**
 * AI Core — Tool Registry.
 * Tools are declared server-side and referenced by name.
 * Execution is isolated: the LLM proposes; the registry validates and runs.
 */
import { z, type ZodSchema } from "zod";
import { AISafetyError } from "./errors";
import type { ToolExecContext } from "./types";

export interface RegisteredTool<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: ZodSchema<TInput>;
  execute: (input: TInput, ctx: ToolExecContext) => Promise<TOutput>;
  requiresApproval?: boolean;
  /** Free-form category for permissioning. */
  category: "search" | "info" | "content" | "action";
}

const registry = new Map<string, RegisteredTool<any, any>>();

export function registerTool<TInput, TOutput>(tool: RegisteredTool<TInput, TOutput>) {
  registry.set(tool.name, tool as RegisteredTool<any, any>);
}

export function getTool(name: string) {
  return registry.get(name);
}

export function listTools(names?: string[]): RegisteredTool[] {
  if (!names) return Array.from(registry.values());
  return names.map((n) => {
    const t = registry.get(n);
    if (!t) throw new AISafetyError(`Unknown tool: ${n}`);
    return t;
  });
}

/** Execute a tool call proposed by the model, with validation and permission. */
export async function invokeTool(
  name: string,
  rawInput: unknown,
  ctx: ToolExecContext,
  allowed: string[],
) {
  if (!allowed.includes(name)) throw new AISafetyError(`Tool not permitted: ${name}`);
  const tool = registry.get(name);
  if (!tool) throw new AISafetyError(`Unknown tool: ${name}`);
  const parsed = tool.inputSchema.safeParse(rawInput);
  if (!parsed.success) throw new AISafetyError(`Invalid tool input: ${parsed.error.message}`);
  if (tool.requiresApproval) {
    return { pendingApproval: true, tool: tool.name, input: parsed.data };
  }
  return await tool.execute(parsed.data, ctx);
}

// -------------------- Built-in stub tools --------------------
// Real implementations arrive with future milestones. Interfaces are stable now.

registerTool({
  name: "get_current_weather",
  description: "Get current weather for a city.",
  category: "info",
  inputSchema: z.object({ city: z.string(), country: z.string().optional() }),
  execute: async (input) => ({
    city: input.city,
    country: input.country ?? null,
    tempC: null,
    condition: "unknown",
    note: "Weather provider not yet wired. Interface reserved.",
  }),
});

registerTool({
  name: "convert_currency",
  description: "Convert an amount from one currency to another.",
  category: "info",
  inputSchema: z.object({
    amount: z.number().positive(),
    from: z.string().length(3),
    to: z.string().length(3),
  }),
  execute: async (input) => ({ ...input, converted: null, rate: null, note: "FX provider not yet wired." }),
});

registerTool({
  name: "search_destinations",
  description: "Search Easy Trip's destinations catalog.",
  category: "search",
  inputSchema: z.object({
    query: z.string().min(1),
    limit: z.number().int().min(1).max(20).optional(),
  }),
  execute: async (input) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("destinations")
      .select("id, name")
      .ilike("name", `%${input.query}%`)
      .limit(input.limit ?? 5);
    return { results: data ?? [] };
  },
});
