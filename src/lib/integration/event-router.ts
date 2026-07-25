/** IPCF — event router + normalizer for webhook & polling outputs. */
import { newEventId, newCorrelationId } from "./ids";
import type { NormalizedEvent } from "./types";

export type EventHandler = (e: NormalizedEvent) => void | Promise<void>;

export class EventNormalizer {
  normalize(input: {
    connectorId: string; kind: string; payload: unknown;
    at?: number; correlationId?: string;
    metadata?: Record<string, unknown>;
  }): NormalizedEvent {
    return Object.freeze({
      id: newEventId(),
      connectorId: input.connectorId,
      kind: input.kind,
      at: input.at ?? Date.now(),
      correlationId: input.correlationId ?? newCorrelationId(),
      payload: input.payload,
      metadata: Object.freeze({ ...(input.metadata ?? {}) }),
    });
  }
}

export class EventRouter {
  private readonly handlers = new Map<string, Set<EventHandler>>();
  private readonly wildcards = new Set<EventHandler>();

  on(kind: string, handler: EventHandler): () => void {
    if (kind === "*") { this.wildcards.add(handler); return () => this.wildcards.delete(handler); }
    let set = this.handlers.get(kind);
    if (!set) { set = new Set(); this.handlers.set(kind, set); }
    set.add(handler);
    return () => set!.delete(handler);
  }
  async route(event: NormalizedEvent): Promise<void> {
    const targets = this.handlers.get(event.kind);
    const all: EventHandler[] = [];
    if (targets) all.push(...targets);
    all.push(...this.wildcards);
    for (const h of all) {
      try { await h(event); } catch { /* swallow — routing must not throw */ }
    }
  }
  clear(): void { this.handlers.clear(); this.wildcards.clear(); }
}
