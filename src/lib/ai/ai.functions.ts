/**
 * AI Core — Public server-function facade.
 * The rest of the app calls these; the AI Core internals stay server-only.
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
      const pub = toPublicError(err);
      return { ok: false as const, error: pub };
    }
  });

export const listAgentsFn = createServerFn({ method: "GET" }).handler(async () => {
  const { listAgents } = await import("./agents.server");
  return listAgents();
});
