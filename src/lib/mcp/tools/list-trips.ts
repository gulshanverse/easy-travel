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
  name: "list_trips",
  title: "List my trips",
  description: "List trips owned by the signed-in Easy Trip user.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(20).describe("Max number of trips to return."),
    status: z
      .string()
      .optional()
      .describe("Optional trip status to filter by (e.g. 'draft', 'planned', 'active')."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, status }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    let query = sb
      .from("trips")
      .select("id, title, summary, status, start_date, end_date, currency, budget_total_cents, traveler_count, updated_at")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { trips: data ?? [] },
    };
  },
});
