/**
 * Graph Runtime — Traversal engine.
 * BFS, DFS, shortest-path (unweighted and Dijkstra-style weighted), cycle
 * detection, depth/node limits, expansion rules. Deterministic ordering.
 */
import type { GraphConfiguration } from "./config";
import { GraphNotFoundError, GraphTraversalError } from "./errors";
import { GraphIndex } from "./index-set";
import { newTraversalId } from "./ids";
import type {
  GraphEdge,
  GraphNode,
  PathResult,
  TraversalOptions,
  TraversalResult,
  TraversalStep,
} from "./types";

const stableIdSort = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

interface Frontier {
  push(item: FrontierItem): void;
  pop(): FrontierItem | undefined;
  size(): number;
}

interface FrontierItem { nodeId: string; edge: GraphEdge | null; depth: number; }

class Queue implements Frontier {
  private items: FrontierItem[] = [];
  push(i: FrontierItem) { this.items.push(i); }
  pop() { return this.items.shift(); }
  size() { return this.items.length; }
}
class Stack implements Frontier {
  private items: FrontierItem[] = [];
  push(i: FrontierItem) { this.items.push(i); }
  pop() { return this.items.pop(); }
  size() { return this.items.length; }
}

export class GraphTraversalEngine {
  constructor(
    private readonly index: GraphIndex,
    private readonly config: GraphConfiguration,
  ) {}

  traverse(rootId: string, opts: TraversalOptions = {}): TraversalResult {
    const root = this.index.getNode(rootId);
    if (!root) throw new GraphNotFoundError("node", rootId);
    const strategy = opts.strategy ?? "bfs";
    const maxDepth = Math.min(opts.maxDepth ?? this.config.limits.maxTraversalDepth, this.config.limits.maxTraversalDepth);
    const maxNodes = Math.min(opts.maxNodes ?? this.config.limits.maxTraversalNodes, this.config.limits.maxTraversalNodes);
    const direction = opts.direction ?? "both";
    const start = Date.now();

    const frontier: Frontier = strategy === "bfs" ? new Queue() : new Stack();
    frontier.push({ nodeId: rootId, edge: null, depth: 0 });
    const visited = new Set<string>();
    const steps: TraversalStep[] = [];
    let edgesTraversed = 0;
    let maxDepthReached = 0;
    let truncated = false;

    while (frontier.size() > 0) {
      const item = frontier.pop()!;
      if (visited.has(item.nodeId)) continue;
      const node = this.index.getNode(item.nodeId);
      if (!node) continue;
      if (opts.nodeKinds && !opts.nodeKinds.includes(node.kind)) continue;
      if (opts.filterNode && !opts.filterNode(node)) continue;
      visited.add(item.nodeId);
      steps.push({ node, edge: item.edge, depth: item.depth });
      if (item.depth > maxDepthReached) maxDepthReached = item.depth;
      if (steps.length >= maxNodes) { truncated = true; break; }
      if (item.depth >= maxDepth) continue;

      const nextIds = direction === "in"
        ? this.index.edgesIn(item.nodeId)
        : direction === "out"
          ? this.index.edgesOut(item.nodeId)
          : this.index.edgesIncident(item.nodeId);
      const orderedIds = [...nextIds].sort(stableIdSort);
      // DFS reverses so that lower ids are explored first.
      const iterOrder = strategy === "dfs" ? orderedIds.slice().reverse() : orderedIds;
      for (const eid of iterOrder) {
        const edge = this.index.getEdge(eid);
        if (!edge) continue;
        if (opts.edgeKinds && !opts.edgeKinds.includes(edge.kind)) continue;
        if (opts.minWeight !== undefined && edge.weight < opts.minWeight) continue;
        if (opts.minConfidence !== undefined && edge.confidence < opts.minConfidence) continue;
        if (opts.filterEdge && !opts.filterEdge(edge)) continue;
        const nextNodeId = edge.from === item.nodeId ? edge.to : edge.from;
        if (nextNodeId === item.nodeId) continue; // self-loop
        if (visited.has(nextNodeId)) continue;
        edgesTraversed += 1;
        frontier.push({ nodeId: nextNodeId, edge, depth: item.depth + 1 });
      }
    }

    return Object.freeze({
      id: newTraversalId(),
      rootId,
      strategy,
      steps: Object.freeze(steps),
      nodesVisited: steps.length,
      edgesTraversed,
      maxDepthReached,
      truncated,
      durationMs: Date.now() - start,
    });
  }

  /** Unweighted BFS shortest path. Returns null if unreachable. */
  shortestPath(fromId: string, toId: string, opts: TraversalOptions = {}): PathResult | null {
    if (!this.index.hasNode(fromId)) throw new GraphNotFoundError("node", fromId);
    if (!this.index.hasNode(toId)) throw new GraphNotFoundError("node", toId);
    if (fromId === toId) {
      const node = this.index.getNode(fromId)!;
      return { from: fromId, to: toId, nodes: [node], edges: [], length: 0, totalWeight: 0 };
    }
    const maxDepth = Math.min(opts.maxDepth ?? this.config.limits.maxPathLength, this.config.limits.maxPathLength);
    const direction = opts.direction ?? "out";
    const parent = new Map<string, { via: GraphEdge; from: string }>();
    const visited = new Set<string>([fromId]);
    const queue: { id: string; depth: number }[] = [{ id: fromId, depth: 0 }];
    while (queue.length) {
      const { id, depth } = queue.shift()!;
      if (depth >= maxDepth) continue;
      const eids = direction === "in"
        ? this.index.edgesIn(id)
        : direction === "out"
          ? this.index.edgesOut(id)
          : this.index.edgesIncident(id);
      const ordered = [...eids].sort(stableIdSort);
      for (const eid of ordered) {
        const edge = this.index.getEdge(eid);
        if (!edge) continue;
        if (opts.edgeKinds && !opts.edgeKinds.includes(edge.kind)) continue;
        if (opts.minWeight !== undefined && edge.weight < opts.minWeight) continue;
        if (opts.minConfidence !== undefined && edge.confidence < opts.minConfidence) continue;
        if (opts.filterEdge && !opts.filterEdge(edge)) continue;
        const next = edge.from === id ? edge.to : edge.from;
        if (visited.has(next)) continue;
        visited.add(next);
        parent.set(next, { via: edge, from: id });
        if (next === toId) return this.reconstructPath(fromId, toId, parent);
        queue.push({ id: next, depth: depth + 1 });
      }
    }
    return null;
  }

  private reconstructPath(
    fromId: string,
    toId: string,
    parent: Map<string, { via: GraphEdge; from: string }>,
  ): PathResult {
    const nodesRev: GraphNode[] = [];
    const edgesRev: GraphEdge[] = [];
    let cur = toId;
    while (cur !== fromId) {
      const step = parent.get(cur);
      if (!step) throw new GraphTraversalError("path reconstruction failed", { from: fromId, to: toId });
      const node = this.index.getNode(cur);
      if (node) nodesRev.push(node);
      edgesRev.push(step.via);
      cur = step.from;
    }
    const fromNode = this.index.getNode(fromId)!;
    const nodes = [fromNode, ...nodesRev.reverse()];
    const edges = edgesRev.reverse();
    const totalWeight = edges.reduce((acc, e) => acc + e.weight, 0);
    return { from: fromId, to: toId, nodes, edges, length: edges.length, totalWeight };
  }
}
