/**
 * Graph Runtime — Node/Edge factories.
 * Deterministic construction with defaults, immutability, and lifecycle
 * enforcement. Factories NEVER mutate incoming inputs.
 */
import type { GraphConfiguration } from "./config";
import { newEdgeId, newNodeId } from "./ids";
import type {
  EdgeInput,
  EdgePatch,
  GraphEdge,
  GraphNode,
  LifecycleState,
  NodeInput,
  NodePatch,
} from "./types";

const now = () => Date.now();

const freezeTags = (tags?: readonly string[]): readonly string[] =>
  Object.freeze([...(tags ?? [])].map((t) => t.trim()).filter(Boolean));

const freezeMeta = (meta?: Record<string, unknown>): Readonly<Record<string, unknown>> =>
  Object.freeze({ ...(meta ?? {}) });

export function createNode<T>(input: NodeInput<T>, config: GraphConfiguration): GraphNode<T> {
  const t = now();
  const node: GraphNode<T> = {
    id: input.id ?? newNodeId(),
    kind: input.kind,
    data: input.data,
    tags: freezeTags(input.tags),
    metadata: freezeMeta(input.metadata),
    version: 1,
    lifecycle: input.lifecycle ?? config.defaults.nodeLifecycle,
    createdAt: t,
    updatedAt: t,
  };
  return Object.freeze(node);
}

export function applyNodePatch<T>(current: GraphNode<T>, patch: NodePatch<T>): GraphNode<T> {
  const next: GraphNode<T> = {
    ...current,
    data: patch.data ?? current.data,
    tags: patch.tags ? freezeTags(patch.tags) : current.tags,
    metadata: patch.metadata ? freezeMeta(patch.metadata) : current.metadata,
    lifecycle: patch.lifecycle ?? current.lifecycle,
    version: current.version + 1,
    updatedAt: now(),
  };
  return Object.freeze(next);
}

export function transitionNode<T>(node: GraphNode<T>, lifecycle: LifecycleState): GraphNode<T> {
  if (node.lifecycle === lifecycle) return node;
  return Object.freeze({ ...node, lifecycle, version: node.version + 1, updatedAt: now() });
}

export function createEdge<T>(input: EdgeInput<T>, config: GraphConfiguration): GraphEdge<T> {
  const t = now();
  const edge: GraphEdge<T> = {
    id: input.id ?? newEdgeId(),
    kind: input.kind,
    from: input.from,
    to: input.to,
    direction: input.direction ?? config.defaults.edgeDirection,
    weight: input.weight ?? config.defaults.edgeWeight,
    confidence: input.confidence ?? config.defaults.edgeConfidence,
    data: (input.data ?? ({} as T)) as T,
    metadata: freezeMeta(input.metadata),
    version: 1,
    lifecycle: input.lifecycle ?? config.defaults.edgeLifecycle,
    createdAt: t,
    updatedAt: t,
  };
  return Object.freeze(edge);
}

export function applyEdgePatch<T>(current: GraphEdge<T>, patch: EdgePatch<T>): GraphEdge<T> {
  const next: GraphEdge<T> = {
    ...current,
    weight: patch.weight ?? current.weight,
    confidence: patch.confidence ?? current.confidence,
    data: patch.data ?? current.data,
    metadata: patch.metadata ? freezeMeta(patch.metadata) : current.metadata,
    lifecycle: patch.lifecycle ?? current.lifecycle,
    version: current.version + 1,
    updatedAt: now(),
  };
  return Object.freeze(next);
}

export function transitionEdge<T>(edge: GraphEdge<T>, lifecycle: LifecycleState): GraphEdge<T> {
  if (edge.lifecycle === lifecycle) return edge;
  return Object.freeze({ ...edge, lifecycle, version: edge.version + 1, updatedAt: now() });
}
