/**
 * AI Core — Memory Engine.
 * Short-term (recent messages), long-term (persisted memories), summaries.
 * Backed by public.conversation_memory + public.ai_messages.
 */
import { AI_CONFIG } from "./config";

export type MemoryKind = "short_term" | "long_term" | "trip" | "preference" | "summary";

export interface MemoryRecord {
  id: string;
  userId: string;
  conversationId: string | null;
  kind: MemoryKind;
  content: string;
  importance: number; // 0..1
  createdAt: string;
  expiresAt: string | null;
}

export interface WriteMemoryInput {
  userId: string;
  conversationId?: string | null;
  kind: MemoryKind;
  content: string;
  importance?: number;
  expiresAt?: string | null;
}

export async function writeMemory(input: WriteMemoryInput) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("conversation_memory")
    .insert({
      user_id: input.userId,
      conversation_id: input.conversationId ?? null,
      kind: input.kind,
      content: input.content,
      importance: input.importance ?? 0.5,
      expires_at: input.expiresAt ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Retrieve top-K memories ranked by importance + recency. */
export async function retrieveMemories(params: {
  userId: string;
  conversationId?: string | null;
  kinds?: MemoryKind[];
  limit?: number;
}): Promise<MemoryRecord[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const limit = params.limit ?? AI_CONFIG.memoryTopK;
  let q = supabaseAdmin
    .from("conversation_memory")
    .select("*")
    .eq("user_id", params.userId)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("importance", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (params.kinds?.length) q = q.in("kind", params.kinds);
  if (params.conversationId) q = q.eq("conversation_id", params.conversationId);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    userId: r.user_id,
    conversationId: r.conversation_id,
    kind: r.kind,
    content: r.content,
    importance: r.importance,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
  }));
}

/** Render memories as compact bullet list for the system prompt. */
export function renderMemories(records: MemoryRecord[]): string {
  if (!records.length) return "";
  return ["Relevant user memory:", ...records.map((r) => `- (${r.kind}) ${r.content}`)].join("\n");
}
