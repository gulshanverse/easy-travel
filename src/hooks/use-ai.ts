/**
 * useAI — Client-side facade for the AI Core.
 * Prefers the RPC path (invokeAgentFn); use `streamAgent` for streaming.
 */
import { useCallback, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { invokeAgentFn } from "@/lib/ai/ai.functions";
import { supabase } from "@/integrations/supabase/client";

export interface UseAIState {
  isLoading: boolean;
  error: string | null;
  output: string | null;
}

export function useAI() {
  const invoke = useServerFn(invokeAgentFn);
  const [state, setState] = useState<UseAIState>({ isLoading: false, error: null, output: null });

  const run = useCallback(
    async (params: { agent: string; prompt: string; conversationId?: string }) => {
      setState({ isLoading: true, error: null, output: null });
      try {
        const res = await invoke({ data: params });
        if (!res.ok) {
          setState({ isLoading: false, error: res.error.message, output: null });
          return null;
        }
        const output = typeof res.output === "string" ? res.output : JSON.stringify(res.output);
        setState({ isLoading: false, error: null, output });
        return res;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Request failed";
        setState({ isLoading: false, error: message, output: null });
        return null;
      }
    },
    [invoke],
  );

  const streamAgent = useCallback(
    async (
      params: { agent: string; prompt: string; conversationId?: string },
      onChunk: (chunk: string) => void,
    ) => {
      setState({ isLoading: true, error: null, output: "" });
      try {
        const { data: sessionRes } = await supabase.auth.getSession();
        const token = sessionRes.session?.access_token;
        if (!token) throw new Error("Not signed in");
        const res = await fetch("/api/ai/invoke", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(params),
        });
        if (!res.ok || !res.body) {
          const text = await res.text().catch(() => "Request failed");
          throw new Error(text);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let full = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          full += chunk;
          onChunk(chunk);
        }
        setState({ isLoading: false, error: null, output: full });
        return full;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Stream failed";
        setState({ isLoading: false, error: message, output: null });
        return null;
      }
    },
    [],
  );

  return { ...state, run, streamAgent };
}
