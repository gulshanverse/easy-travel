/**
 * RecommendationService — produces & persists recommendations via AI Core.
 * The AI agents own the intelligence; this service owns storage, dedup,
 * visibility, and lifecycle only.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { Recommendation, RecommendationSubject, TIEResult } from "./types";
import { ok, fail } from "./types";
import { emitTIEEvent } from "./events";
import { runAgent } from "@/lib/ai/agents.server";
import type { AIRequestContext } from "@/lib/ai/types";

type SB = SupabaseClient<Database>;
type AiAgent = Database["public"]["Enums"]["ai_agent"];

export interface GenerateRecsInput {
  agent: AiAgent;
  tripId?: string;
  userId: string;
  subjectKind: RecommendationSubject;
  subjectId?: string | null;
  input: Record<string, unknown>;
  expiresInMinutes?: number;
}

export class RecommendationService {
  constructor(private readonly supabase: SB) {}

  async list(userId: string, subjectKind?: RecommendationSubject): Promise<TIEResult<Recommendation[]>> {
    let q = this.supabase
      .from("ai_recommendations")
      .select("*")
      .eq("user_id", userId)
      .is("dismissed_at", null)
      .order("score", { ascending: false, nullsFirst: false })
      .limit(50);
    if (subjectKind) q = q.eq("subject_kind", subjectKind);
    const { data, error } = await q;
    if (error) return fail("recs.list_failed", error.message);
    return ok((data ?? []).map(toRec));
  }

  async record(
    userId: string,
    payload: {
      agent: AiAgent;
      subjectKind: RecommendationSubject;
      subjectId?: string | null;
      reason?: string | null;
      score?: number | null;
      payload: Record<string, unknown>;
      expiresAt?: string | null;
    },
  ): Promise<TIEResult<Recommendation>> {
    const { data, error } = await this.supabase
      .from("ai_recommendations")
      .insert({
        user_id: userId,
        agent: payload.agent,
        subject_kind: payload.subjectKind,
        subject_id: payload.subjectId ?? null,
        reason: payload.reason ?? null,
        score: payload.score ?? null,
        payload: payload.payload as Database["public"]["Tables"]["ai_recommendations"]["Insert"]["payload"],
        expires_at: payload.expiresAt ?? null,
        shown_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (error) return fail("recs.record_failed", error.message, error);
    emitTIEEvent({
      name: "AI_RECOMMENDATION_CREATED",
      tripId: null,
      userId,
      data: { id: data.id, subjectKind: payload.subjectKind, agent: payload.agent },
    });
    return ok(toRec(data));
  }

  /** Invoke an AI agent and persist each returned suggestion as a recommendation. */
  async generate(input: GenerateRecsInput): Promise<TIEResult<Recommendation[]>> {
    const ctx: AIRequestContext = {
      userId: input.userId,
      feature: "tie.recommendation",
      metadata: input.tripId ? { tripId: input.tripId } : undefined,
    };
    let output: unknown;
    try {
      const result = await runAgent(input.agent, input.input, ctx);
      output = result.output;
    } catch (err) {
      return fail("recs.ai_failed", err instanceof Error ? err.message : String(err), err);
    }

    const suggestions = normalizeSuggestions(output);
    const expiresAt = input.expiresInMinutes
      ? new Date(Date.now() + input.expiresInMinutes * 60_000).toISOString()
      : null;

    const out: Recommendation[] = [];
    for (const s of suggestions) {
      const rec = await this.record(input.userId, {
        agent: input.agent,
        subjectKind: input.subjectKind,
        subjectId: input.subjectId ?? null,
        reason: s.reason ?? null,
        score: s.score ?? null,
        payload: s.payload,
        expiresAt,
      });
      if (rec.ok) out.push(rec.data);
    }
    return ok(out);
  }

  async dismiss(id: string, userId: string): Promise<TIEResult<{ id: string }>> {
    const { error } = await this.supabase
      .from("ai_recommendations")
      .update({ dismissed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId);
    if (error) return fail("recs.dismiss_failed", error.message);
    return ok({ id });
  }

  async click(id: string, userId: string): Promise<TIEResult<{ id: string }>> {
    const { error } = await this.supabase
      .from("ai_recommendations")
      .update({ clicked_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId);
    if (error) return fail("recs.click_failed", error.message);
    emitTIEEvent({ name: "AI_RECOMMENDATION_APPLIED", tripId: null, userId, data: { id } });
    return ok({ id });
  }
}

function toRec(r: Database["public"]["Tables"]["ai_recommendations"]["Row"]): Recommendation {
  return {
    id: r.id,
    agent: r.agent,
    subjectKind: r.subject_kind as RecommendationSubject,
    subjectId: r.subject_id,
    score: r.score,
    reason: r.reason,
    payload: (r.payload as Record<string, unknown>) ?? {},
    createdAt: r.created_at,
    expiresAt: r.expires_at,
  };
}

interface RawSuggestion {
  reason?: string | null;
  score?: number | null;
  payload: Record<string, unknown>;
}

function normalizeSuggestions(output: unknown): RawSuggestion[] {
  if (!output) return [];
  if (Array.isArray(output)) {
    return output.map((p) => ({ payload: (p ?? {}) as Record<string, unknown> }));
  }
  if (typeof output === "object") {
    const o = output as { suggestions?: unknown; items?: unknown; recommendations?: unknown };
    const arr = (o.suggestions ?? o.items ?? o.recommendations) as unknown;
    if (Array.isArray(arr)) {
      return arr.map((s) => {
        if (s && typeof s === "object" && "payload" in (s as object))
          return s as RawSuggestion;
        return { payload: (s ?? {}) as Record<string, unknown> };
      });
    }
    return [{ payload: output as Record<string, unknown> }];
  }
  return [];
}
