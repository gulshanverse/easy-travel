/**
 * Graph Runtime — Typed events.
 * Every event carries correlation, causation, timestamp and version metadata
 * so downstream subsystems can assemble causal chains without inspecting
 * private state.
 */
import { newCausationId, newCorrelationId, newEventId } from "./ids";
import type { GraphEdge, GraphNode, GraphSnapshot, TraversalResult } from "./types";

export type GraphEventName =
  | "NodeCreated"
  | "NodeUpdated"
  | "NodeDeleted"
  | "EdgeCreated"
  | "EdgeUpdated"
  | "EdgeDeleted"
  | "TraversalStarted"
  | "TraversalCompleted"
  | "SubgraphCreated"
  | "GraphValidated"
  | "GraphCompacted"
  | "GraphLoaded"
  | "GraphSaved";

export interface GraphEventEnvelope<TName extends GraphEventName, TPayload> {
  readonly id: string;
  readonly name: TName;
  readonly correlationId: string;
  readonly causationId: string;
  readonly timestamp: number;
  readonly version: number;
  readonly graphId: string;
  readonly payload: TPayload;
  readonly metadata: Record<string, unknown>;
}

export type GraphEvent =
  | GraphEventEnvelope<"NodeCreated", { node: GraphNode }>
  | GraphEventEnvelope<"NodeUpdated", { before: GraphNode; after: GraphNode }>
  | GraphEventEnvelope<"NodeDeleted", { node: GraphNode }>
  | GraphEventEnvelope<"EdgeCreated", { edge: GraphEdge }>
  | GraphEventEnvelope<"EdgeUpdated", { before: GraphEdge; after: GraphEdge }>
  | GraphEventEnvelope<"EdgeDeleted", { edge: GraphEdge }>
  | GraphEventEnvelope<"TraversalStarted", { rootId: string; strategy: string }>
  | GraphEventEnvelope<"TraversalCompleted", { result: TraversalResult }>
  | GraphEventEnvelope<"SubgraphCreated", { subgraphId: string; nodes: number; edges: number }>
  | GraphEventEnvelope<"GraphValidated", { ok: boolean; issues: number }>
  | GraphEventEnvelope<"GraphCompacted", { removedNodes: number; removedEdges: number }>
  | GraphEventEnvelope<"GraphLoaded", { snapshot: GraphSnapshot }>
  | GraphEventEnvelope<"GraphSaved", { snapshot: GraphSnapshot }>;

export type GraphEventListener = (event: GraphEvent) => void | Promise<void>;

export interface EventContext {
  correlationId?: string;
  causationId?: string;
  metadata?: Record<string, unknown>;
}

export function makeEventEnvelope<TName extends GraphEventName, TPayload>(
  graphId: string,
  name: TName,
  payload: TPayload,
  ctx: EventContext = {},
): GraphEventEnvelope<TName, TPayload> {
  return {
    id: newEventId(),
    name,
    correlationId: ctx.correlationId ?? newCorrelationId(),
    causationId: ctx.causationId ?? newCausationId(),
    timestamp: Date.now(),
    version: 1,
    graphId,
    payload,
    metadata: ctx.metadata ?? {},
  };
}

export class GraphEventBus {
  private listeners = new Set<GraphEventListener>();
  private wildcardListeners = new Set<GraphEventListener>();

  on(listener: GraphEventListener): () => void {
    this.wildcardListeners.add(listener);
    return () => this.wildcardListeners.delete(listener);
  }

  onEvent<TName extends GraphEventName>(
    name: TName,
    listener: (event: Extract<GraphEvent, { name: TName }>) => void | Promise<void>,
  ): () => void {
    const filtered: GraphEventListener = (evt) => {
      if (evt.name === name) return listener(evt as Extract<GraphEvent, { name: TName }>);
    };
    this.listeners.add(filtered);
    return () => this.listeners.delete(filtered);
  }

  async emit(event: GraphEvent): Promise<void> {
    for (const l of this.wildcardListeners) await l(event);
    for (const l of this.listeners) await l(event);
  }

  clear(): void {
    this.listeners.clear();
    this.wildcardListeners.clear();
  }
}
