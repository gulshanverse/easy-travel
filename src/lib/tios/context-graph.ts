/**
 * TIOS Context Graph.
 * Dynamic in-memory graph of user/trip/environment nodes plus typed edges.
 * Snapshots are passed into DecisionContext so downstream layers work on
 * immutable views.
 */
import { emitTIOSEvent, makeRequestId } from "./events";
import type {
  ContextEdge, ContextEdgeType, ContextGraphSnapshot, ContextNode, ContextNodeType,
} from "./types";

export class ContextGraph {
  private nodes = new Map<string, ContextNode>();
  private edges: ContextEdge[] = [];

  upsertNode<T extends Record<string, unknown>>(
    id: string, type: ContextNodeType, data: T,
  ): ContextNode<T> {
    const node: ContextNode<T> = { id, type, data, updatedAt: Date.now() };
    this.nodes.set(id, node as ContextNode);
    emitTIOSEvent({
      name: "CONTEXT_UPDATED",
      requestId: makeRequestId("ctx"),
      timestamp: Date.now(),
      data: { op: "upsertNode", id, type },
    });
    return node;
  }

  connect(from: string, to: string, type: ContextEdgeType, weight = 1,
          data?: Record<string, unknown>): void {
    this.edges.push({ from, to, type, weight, data });
    emitTIOSEvent({
      name: "CONTEXT_UPDATED",
      requestId: makeRequestId("ctx"),
      timestamp: Date.now(),
      data: { op: "connect", from, to, type },
    });
  }

  neighbors(id: string, type?: ContextEdgeType): ContextNode[] {
    return this.edges
      .filter((e) => e.from === id && (!type || e.type === type))
      .map((e) => this.nodes.get(e.to))
      .filter((n): n is ContextNode => Boolean(n));
  }

  getNode(id: string): ContextNode | undefined { return this.nodes.get(id); }

  snapshot(): ContextGraphSnapshot {
    return {
      nodes: Array.from(this.nodes.values()).map((n) => ({ ...n, data: { ...n.data } })),
      edges: this.edges.map((e) => ({ ...e })),
    };
  }

  clear(): void {
    this.nodes.clear();
    this.edges = [];
  }
}

/** Build a graph from a plain user/trip context payload. Safe to call per-request. */
export function buildGraph(seed: {
  userId?: string | null;
  tripId?: string | null;
  destination?: { id: string; name: string; country?: string };
  companions?: Array<{ id: string; name: string }>;
  budget?: { currency: string; total?: number; remaining?: number };
  weather?: { severity?: string; summary?: string };
  preferences?: Record<string, unknown>;
  locale?: string;
  currency?: string;
}): ContextGraph {
  const g = new ContextGraph();
  if (seed.userId) g.upsertNode(`user:${seed.userId}`, "user", { userId: seed.userId });
  if (seed.tripId) g.upsertNode(`trip:${seed.tripId}`, "trip", { tripId: seed.tripId });
  if (seed.userId && seed.tripId) {
    g.connect(`user:${seed.userId}`, `trip:${seed.tripId}`, "belongs_to");
  }
  if (seed.destination) {
    const id = `destination:${seed.destination.id}`;
    g.upsertNode(id, "destination", { ...seed.destination });
    if (seed.tripId) g.connect(`trip:${seed.tripId}`, id, "travelling_to");
  }
  for (const c of seed.companions ?? []) {
    const id = `companion:${c.id}`;
    g.upsertNode(id, "companion", { ...c });
    if (seed.tripId) g.connect(`trip:${seed.tripId}`, id, "contains");
  }
  if (seed.budget) g.upsertNode("budget:current", "budget", { ...seed.budget });
  if (seed.weather) g.upsertNode("weather:current", "weather", { ...seed.weather });
  if (seed.preferences) g.upsertNode("preference:user", "preference", { ...seed.preferences });
  if (seed.locale) g.upsertNode("language:current", "language", { locale: seed.locale });
  if (seed.currency) g.upsertNode("currency:current", "currency", { code: seed.currency });
  g.upsertNode("time:now", "time", { ts: Date.now() });
  return g;
}
