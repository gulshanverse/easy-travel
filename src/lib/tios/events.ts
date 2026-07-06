/**
 * TIOS Event Bus.
 * Extends the AI Core event bus with OS-level events. Isomorphic pub/sub.
 * Listener failures are swallowed to protect the caller.
 */

export type TIOSEventName =
  | "CAPABILITY_REGISTERED"
  | "CAPABILITY_UPDATED"
  | "CAPABILITY_HEALTH_CHANGED"
  | "DECISION_CREATED"
  | "POLICY_MATCHED"
  | "POLICY_DENIED"
  | "CONTEXT_UPDATED"
  | "RECOMMENDATION_CREATED"
  | "WORKFLOW_STARTED"
  | "WORKFLOW_COMPLETED"
  | "WORKFLOW_FAILED"
  | "PROVIDER_SELECTED"
  | "FAILOVER_OCCURRED"
  | "FLAG_EVALUATED";

export interface TIOSEvent<T = unknown> {
  name: TIOSEventName;
  requestId: string;
  timestamp: number;
  capability?: string;
  userId?: string | null;
  data?: T;
}

type Listener = (event: TIOSEvent) => void | Promise<void>;

const listeners = new Map<TIOSEventName | "*", Set<Listener>>();

export function onTIOSEvent(name: TIOSEventName | "*", listener: Listener): () => void {
  if (!listeners.has(name)) listeners.set(name, new Set());
  listeners.get(name)!.add(listener);
  return () => listeners.get(name)?.delete(listener);
}

export function emitTIOSEvent<T>(event: TIOSEvent<T>): void {
  const buckets = [listeners.get(event.name), listeners.get("*")];
  for (const bucket of buckets) {
    if (!bucket) continue;
    for (const l of bucket) {
      try {
        const r = l(event as TIOSEvent);
        if (r && typeof (r as Promise<unknown>).then === "function") {
          (r as Promise<unknown>).catch(() => void 0);
        }
      } catch {
        // instrumentation must never throw
      }
    }
  }
}

export function makeRequestId(prefix = "tios"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
