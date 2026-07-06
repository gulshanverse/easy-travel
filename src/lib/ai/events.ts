/**
 * AI Core — Event Bus.
 * Isomorphic. In-worker pub/sub used for observability, tracing, side effects.
 * Listeners are registered once at boot and run in-process; failures are
 * swallowed so instrumentation never breaks an AI call.
 */

export type AIEventName =
  | "AI_STARTED"
  | "AI_CONTEXT_READY"
  | "MEMORY_RETRIEVED"
  | "PROMPT_RENDERED"
  | "TOOLS_SELECTED"
  | "TOOLS_EXECUTED"
  | "STREAM_STARTED"
  | "STREAM_COMPLETED"
  | "USAGE_RECORDED"
  | "AI_COMPLETED"
  | "AI_FAILED"
  | "WORKFLOW_STEP_STARTED"
  | "WORKFLOW_STEP_COMPLETED"
  | "WORKFLOW_STEP_FAILED"
  | "WORKFLOW_COMPLETED"
  | "WORKFLOW_FAILED";

export interface AIEvent<T = unknown> {
  name: AIEventName;
  requestId: string;
  timestamp: number;
  agent?: string;
  feature?: string;
  userId?: string | null;
  data?: T;
}

type Listener = (event: AIEvent) => void | Promise<void>;

const listeners = new Map<AIEventName | "*", Set<Listener>>();

export function onAIEvent(name: AIEventName | "*", listener: Listener): () => void {
  const set = listeners.get(name) ?? new Set<Listener>();
  set.add(listener);
  listeners.set(name, set);
  return () => set.delete(listener);
}

export function emitAIEvent<T>(event: Omit<AIEvent<T>, "timestamp"> & { timestamp?: number }) {
  const full: AIEvent<T> = { timestamp: Date.now(), ...event };
  const scoped = listeners.get(full.name);
  const all = listeners.get("*");
  const run = (l: Listener) => {
    try {
      const r = l(full);
      if (r && typeof (r as Promise<unknown>).catch === "function") {
        (r as Promise<unknown>).catch((err) => console.error("[ai/events] listener error", err));
      }
    } catch (err) {
      console.error("[ai/events] listener error", err);
    }
  };
  scoped?.forEach(run);
  all?.forEach(run);
}

/** Development default: log to console. Wire real sinks (Postgres, OTLP) here. */
if (process.env.NODE_ENV !== "production") {
  onAIEvent("*", (e) => {
    if (e.name === "AI_FAILED" || e.name === "WORKFLOW_FAILED") {
      console.warn(`[ai/event] ${e.name}`, { requestId: e.requestId, agent: e.agent, data: e.data });
    }
  });
}
