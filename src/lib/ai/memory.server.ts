/**
 * AI Core — Memory Engine.
 * Backed by public.conversation_memory: (scope, key, value jsonb, importance smallint, expires_at).
 * We treat `scope` as the memory kind and store text under value.text.
 */
import { AI_CONFIG } from "./config";

export type MemoryKind = "short_term" | "long_term" | "trip" | "preference" | "summary";

export interface MemoryRecord {
  id: string;
  userId: string;
  conversationId: string | null;
  kind: MemoryKind;
  key: string;
  content: string;
  importance: number;
  createdAt: string;
  expiresAt: string | null;
}

export interface WriteMemoryInput {
  userId: string;
  conversationId?: string | null;
  kind: MemoryKind;
  key: string;
  content: string;
  /** 0..100 in DB; we normalize 0..1 → 0..100. */
  importance?: number;
  expiresAt?: string | null;
}

export async function writeMemory(input: WriteMemoryInput) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const importance = Math.round(Math.min(1, Math.max(0, input.importance ?? 0.5)) * 100);
  const { data, error } = await supabaseAdmin
    .from("conversation_memory")
    .insert({
      user_id: input.userId,
      conversation_id: input.conversationId ?? null,
      scope: input.kind,
      key: input.key,
      value: { text: input.content } as unknown as never,
      importance,
      expires_at: input.expiresAt ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

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

  if (params.kinds?.length) q = q.in("scope", params.kinds);
  if (params.conversationId) q = q.eq("conversation_id", params.conversationId);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => {
    const value = r.value as { text?: string } | null;
    return {
      id: r.id,
      userId: r.user_id,
      conversationId: r.conversation_id,
      kind: (r.scope as MemoryKind) ?? "long_term",
      key: r.key,
      content: value?.text ?? JSON.stringify(r.value),
      importance: (r.importance ?? 0) / 100,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
    };
  });
}

export function renderMemories(records: MemoryRecord[]): string {
  if (!records.length) return "";
  return ["Relevant user memory:", ...records.map((r) => `- (${r.kind}) ${r.content}`)].join("\n");
}
