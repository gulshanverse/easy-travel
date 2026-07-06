/**
 * AI Core — Streaming HTTP endpoint.
 * Authenticated via Supabase bearer token. Frontend calls this for realtime UX.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

import { streamAI } from "@/lib/ai/core.server";
import { toPublicError } from "@/lib/ai/errors";
import {
  LOVABLE_AIG_RUN_ID_HEADER,
  getGatewayResponseHeaders,
} from "@/lib/ai/gateway.server";

const BodySchema = z.object({
  agent: z.string().min(1).max(64).default("chat"),
  prompt: z.string().min(1).max(4000),
  conversationId: z.string().uuid().optional(),
  locale: z.string().max(16).optional(),
  currency: z.string().length(3).optional(),
  timezone: z.string().max(64).optional(),
});

async function authenticate(request: Request): Promise<{ userId: string } | null> {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;
  const client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return { userId: data.user.id };
}

export const Route = createFileRoute("/api/ai/invoke")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const auth = await authenticate(request);
          if (!auth) return new Response("Unauthorized", { status: 401 });

          const raw = await request.json();
          const body = BodySchema.parse(raw);

          const { result, handle } = await streamAI({
            ctx: {
              userId: auth.userId,
              conversationId: body.conversationId ?? null,
              feature: body.agent,
              agent: body.agent,
              locale: body.locale,
              currency: body.currency,
              timezone: body.timezone,
            },
            system: `You are the ${body.agent} agent for Easy Trip. Reply concisely.`,
            messages: [{ role: "user", content: body.prompt }],
          });

          const runId = handle.getRunId();
          const response = result.toTextStreamResponse({
            headers: getGatewayResponseHeaders(undefined, {
              ...(runId ? { [LOVABLE_AIG_RUN_ID_HEADER]: runId } : {}),
            }),
          });
          return response;
        } catch (err) {
          const pub = toPublicError(err);
          return Response.json({ error: pub }, { status: pub.status });
        }
      },
    },
  },
});
