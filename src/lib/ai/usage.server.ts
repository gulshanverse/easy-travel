/**
 * AI Core — Usage Tracker.
 * Best-effort logging to public.ai_usage. Never throws.
 */
import type { AIRequestContext, AIUsage } from "./types";
import type { ModelId } from "./config";

// ai_usage.agent is an enum; unknown agents fall back to "general".
const AGENT_ENUM = new Set([
  "planner", "budget", "booking", "recommendation", "weather",
  "safety", "memory", "translator", "general",
]);
type AgentEnum = "planner" | "budget" | "booking" | "recommendation" | "weather" | "safety" | "memory" | "translator" | "general";

function toAgentEnum(agent: string | null | undefined): AgentEnum {
  if (agent && AGENT_ENUM.has(agent)) return agent as AgentEnum;
  return "general";
}

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
      conversation_id: rec.ctx.conversationId ?? null,
      agent: toAgentEnum(rec.ctx.agent ?? rec.ctx.feature),
      provider: rec.model.split("/")[0],
      model: rec.model,
      operation: rec.ctx.feature,
      input_tokens: rec.usage.promptTokens,
      output_tokens: rec.usage.completionTokens,
      total_tokens: rec.usage.totalTokens,
      cost_micros: Math.round(rec.usage.costCredits * 1_000_000),
      duration_ms: rec.latencyMs,
      status: rec.success ? "success" : "error",
      error: rec.errorCode ?? null,
    });
  } catch (err) {
    console.error("[ai/usage] failed to record", err);
  }
}

const rlBuckets = new Map<string, { minute: { start: number; count: number }; day: { start: number; count: number } }>();

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
