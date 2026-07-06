/**
 * AI Core — Public server-function facade.
 * Backward compatible with Milestone 4. Adds workflow + memory RPC entrypoints.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { toPublicError } from "./errors";

const InvokeInput = z.object({
  agent: z.string().min(1).max(64),
  prompt: z.string().min(1).max(4000),
  conversationId: z.string().uuid().optional(),
  locale: z.string().max(16).optional(),
  currency: z.string().length(3).optional(),
  timezone: z.string().max(64).optional(),
});

export const invokeAgentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InvokeInput.parse(data))
  .handler(async ({ data, context }) => {
    const { runAgent } = await import("./agents.server");
    try {
      const result = await runAgent(data.agent, { prompt: data.prompt }, {
        userId: context.userId,
        conversationId: data.conversationId ?? null,
        feature: data.agent,
        locale: data.locale,
        currency: data.currency,
        timezone: data.timezone,
      });
      return {
        ok: true as const,
        requestId: result.requestId,
        model: result.model,
        output: result.output,
        usage: result.usage,
        latencyMs: result.latencyMs,
      };
    } catch (err) {
      return { ok: false as const, error: toPublicError(err) };
    }
  });

export const listAgentsFn = createServerFn({ method: "GET" }).handler(async () => {
  const { listAgents } = await import("./agents.server");
  return listAgents();
});

// -------------------- Memory RPC --------------------

const SearchMemoryInput = z.object({
  conversationId: z.string().uuid().optional(),
  kinds: z.array(z.enum(["short_term", "long_term", "trip", "preference", "summary"])).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export const searchMemoryFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SearchMemoryInput.parse(data))
  .handler(async ({ data, context }) => {
    const { retrieveMemories } = await import("./memory.server");
    try {
      const records = await retrieveMemories({
        userId: context.userId,
        conversationId: data.conversationId ?? null,
        kinds: data.kinds,
        limit: data.limit,
      });
      return { ok: true as const, records };
    } catch (err) {
      return { ok: false as const, error: toPublicError(err) };
    }
  });

const SaveMemoryInput = z.object({
  conversationId: z.string().uuid().optional(),
  kind: z.enum(["short_term", "long_term", "trip", "preference", "summary"]),
  key: z.string().min(1).max(200),
  content: z.string().min(1).max(4000),
  importance: z.number().min(0).max(1).optional(),
  expiresAt: z.string().datetime().optional(),
});

export const saveMemoryFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SaveMemoryInput.parse(data))
  .handler(async ({ data, context }) => {
    const { writeMemory } = await import("./memory.server");
    try {
      const record = await writeMemory({
        userId: context.userId,
        conversationId: data.conversationId ?? null,
        kind: data.kind,
        key: data.key,
        content: data.content,
        importance: data.importance,
        expiresAt: data.expiresAt ?? null,
      });
      return { ok: true as const, record };
    } catch (err) {
      return { ok: false as const, error: toPublicError(err) };
    }
  });

// -------------------- Tool RPC --------------------

const InvokeToolInput = z.object({
  name: z.string().min(1).max(64),
  input: z.record(z.string(), z.unknown()).default({}),
  allowed: z.array(z.string()).optional(),
});

export const invokeToolFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InvokeToolInput.parse(data))
  .handler(async ({ data, context }) => {
    const { invokeTool } = await import("./tools.server");
    try {
      const result = await invokeTool(
        data.name,
        data.input,
        { userId: context.userId, requestId: `tool_${Date.now()}` },
        data.allowed ?? [data.name],
      );
      return { ok: true as const, result };
    } catch (err) {
      return { ok: false as const, error: toPublicError(err) };
    }
  });
