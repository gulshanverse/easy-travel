/**
 * AI Core — Usage Tracker.
 * Best-effort logging to public.ai_usage. Never throws to the caller.
 */
import type { AIRequestContext, AIUsage } from "./types";
import type { ModelId } from "./config";

export interface UsageRecord {
  ctx: AIRequestContext;
  model: ModelId;
  usage: AIUsage;
  latencyMs: number;
  success: boolean;
  errorCode?: string;
  requestId: string;
  runId?: string;
}

export async function recordUsage(rec: UsageRecord) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("ai_usage").insert({
      user_id: rec.ctx.userId,
      feature: rec.ctx.feature,
      agent: rec.ctx.agent ?? null,
      model: rec.model,
      provider: rec.model.split("/")[0],
      prompt_tokens: rec.usage.promptTokens,
      completion_tokens: rec.usage.completionTokens,
      total_tokens: rec.usage.totalTokens,
      cost_credits: rec.usage.costCredits,
      latency_ms: rec.latencyMs,
      success: rec.success,
      error_code: rec.errorCode ?? null,
      request_id: rec.requestId,
      run_id: rec.runId ?? null,
      metadata: rec.ctx.metadata ?? {},
    });
  } catch (err) {
    console.error("[ai/usage] failed to record", err);
  }
}

const rlBuckets = new Map<string, { minute: { start: number; count: number }; day: { start: number; count: number } }>();

/** In-memory per-worker rate limit. Suitable for burst protection; real limits use DB counters. */
export function checkRateLimit(userId: string | null, perMinute: number, perDay: number) {
  const key = userId ?? "anon";
  const now = Date.now();
  const b = rlBuckets.get(key) ?? {
    minute: { start: now, count: 0 },
    day: { start: now, count: 0 },
  };
  if (now - b.minute.start > 60_000) b.minute = { start: now, count: 0 };
  if (now - b.day.start > 86_400_000) b.day = { start: now, count: 0 };
  b.minute.count += 1;
  b.day.count += 1;
  rlBuckets.set(key, b);
  return b.minute.count <= perMinute && b.day.count <= perDay;
}
