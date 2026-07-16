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
  name: "get_trip",
  title: "Get trip detail",
  description: "Fetch one Easy Trip trip with its day-by-day itinerary and activities.",
  inputSchema: {
    trip_id: z.string().uuid().describe("The trip UUID (from list_trips)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ trip_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const [tripRes, daysRes, actsRes] = await Promise.all([
      sb.from("trips").select("*").eq("id", trip_id).is("deleted_at", null).maybeSingle(),
      sb.from("trip_days").select("*").eq("trip_id", trip_id).order("day_number", { ascending: true }),
      sb.from("trip_activities").select("*").eq("trip_id", trip_id),
    ]);
    if (tripRes.error) return { content: [{ type: "text", text: tripRes.error.message }], isError: true };
    if (!tripRes.data) return { content: [{ type: "text", text: "Trip not found" }], isError: true };
    const payload = {
      trip: tripRes.data,
      days: daysRes.data ?? [],
      activities: actsRes.data ?? [],
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload) }],
      structuredContent: payload,
    };
  },
});
