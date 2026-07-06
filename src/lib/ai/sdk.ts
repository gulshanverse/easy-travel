/**
 * Easy Trip AI SDK — the ONLY module frontend code should import for AI.
 * Provider-agnostic, backend-agnostic. Wraps the AI Core server functions
 * and the streaming HTTP endpoint behind a stable client API.
 *
 * Usage:
 *   import { aiClient } from "@/lib/ai/sdk";
 *   const res = await aiClient.runAgent({ agent: "planner", prompt: "..." });
 */
import {
  invokeAgentFn,
  listAgentsFn,
  searchMemoryFn,
  saveMemoryFn,
  invokeToolFn,
} from "./ai.functions";
import { supabase } from "@/integrations/supabase/client";
import type { MemoryKind } from "./memory.server";

// ---------- Types ----------

export interface RunAgentParams {
  agent: string;
  prompt: string;
  conversationId?: string;
  locale?: string;
  currency?: string;
  timezone?: string;
}

export interface StreamAgentParams extends RunAgentParams {
  onChunk: (chunk: string) => void;
  signal?: AbortSignal;
}

export interface SearchMemoryParams {
  conversationId?: string;
  kinds?: MemoryKind[];
  limit?: number;
}

export interface SaveMemoryParams {
  kind: MemoryKind;
  key: string;
  content: string;
  conversationId?: string;
  importance?: number;
  expiresAt?: string;
}

export interface InvokeToolParams {
  name: string;
  input?: Record<string, unknown>;
  allowed?: string[];
}

// ---------- Cancellation registry ----------

const inflight = new Map<string, AbortController>();

function makeController(requestId?: string): { id: string; controller: AbortController } {
  const id = requestId ?? `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const controller = new AbortController();
  inflight.set(id, controller);
  return { id, controller };
}

// ---------- SDK ----------

export const aiClient = {
  /** Non-streaming agent call via typed RPC. */
  async runAgent(params: RunAgentParams) {
    return await invokeAgentFn({ data: params });
  },

  /**
   * Streaming agent call. Chunks are delivered via `onChunk`.
   * Returns a `requestId` usable with `cancelRequest`.
   */
  async streamAgent(params: StreamAgentParams): Promise<{ requestId: string; text: string | null; error?: string }> {
    const { id, controller } = makeController();
    const externalSignal = params.signal;
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort();
      externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
    }
    try {
      const { data: sessionRes } = await supabase.auth.getSession();
      const token = sessionRes.session?.access_token;
      if (!token) return { requestId: id, text: null, error: "Not signed in" };

      const res = await fetch("/api/ai/invoke", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          agent: params.agent,
          prompt: params.prompt,
          conversationId: params.conversationId,
          locale: params.locale,
          currency: params.currency,
          timezone: params.timezone,
        }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "Request failed");
        return { requestId: id, text: null, error: errText };
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        full += chunk;
        params.onChunk(chunk);
      }
      return { requestId: id, text: full };
    } catch (err) {
      if (controller.signal.aborted) return { requestId: id, text: null, error: "Cancelled" };
      return { requestId: id, text: null, error: err instanceof Error ? err.message : "Stream failed" };
    } finally {
      inflight.delete(id);
    }
  },

  /**
   * Run a server-side workflow. Because workflows compose agents (which
   * require auth), workflow execution is exposed today via the same
   * runAgent RPC — call individual agents client-side; wire full workflow
   * server functions per feature (e.g. `planTripFn` in the Trip Engine).
   */
  async runWorkflow(_params: { workflow: string; input?: Record<string, unknown> }): Promise<never> {
    throw new Error(
      "runWorkflow is exposed per-feature. Call the feature's dedicated workflow server function.",
    );
  },

  async invokeTool(params: InvokeToolParams) {
    return await invokeToolFn({
      data: {
        name: params.name,
        input: params.input ?? {},
        allowed: params.allowed,
      },
    });
  },

  async searchMemory(params: SearchMemoryParams = {}) {
    return await searchMemoryFn({ data: params });
  },

  async saveMemory(params: SaveMemoryParams) {
    return await saveMemoryFn({ data: params });
  },

  async listAgents() {
    return await listAgentsFn();
  },

  /** Cancel a streaming call by requestId. Returns true if cancelled. */
  cancelRequest(requestId: string): boolean {
    const c = inflight.get(requestId);
    if (!c) return false;
    c.abort();
    inflight.delete(requestId);
    return true;
  },

  /** Cancel all in-flight streaming calls. */
  cancelAll(): number {
    let n = 0;
    for (const [, c] of inflight) {
      c.abort();
      n += 1;
    }
    inflight.clear();
    return n;
  },
};

export type AIClient = typeof aiClient;
