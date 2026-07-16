import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "create_trip",
  title: "Create trip",
  description: "Create a new draft trip owned by the signed-in Easy Trip user.",
  inputSchema: {
    title: z.string().trim().min(1).max(200).describe("Trip title."),
    summary: z.string().trim().max(2000).optional().describe("Short trip summary."),
    start_date: z.string().optional().describe("ISO date (YYYY-MM-DD) trip start."),
    end_date: z.string().optional().describe("ISO date (YYYY-MM-DD) trip end."),
    currency: z.string().length(3).optional().describe("ISO 4217 currency code."),
    traveler_count: z.number().int().min(1).max(50).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("trips")
      .insert({
        user_id: ctx.getUserId(),
        title: input.title,
        summary: input.summary ?? null,
        start_date: input.start_date ?? null,
        end_date: input.end_date ?? null,
        currency: input.currency ?? null,
        traveler_count: input.traveler_count ?? null,
      })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { trip: data },
    };
  },
});
