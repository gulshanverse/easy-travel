/**
 * Graph Runtime — GraphManager.
 * Owns node/edge lifecycle, index maintenance, event emission, validation,
 * traversal, query, subgraph extraction, and snapshot/rollback.
 */
import type { GraphConfiguration } from "./config";
import { GraphNotFoundError, GraphValidationError } from "./errors";
import {
  GraphEventBus,
  makeEventEnvelope,
  type EventContext,
} from "./events";
import {
  applyEdgePatch,
  applyNodePatch,
  createEdge,
  createNode,
} from "./factories";
import { newSubgraphId } from "./ids";
import { GraphIndex } from "./index-set";
import { GraphQueryEngine } from "./query";
import {
  createSnapshot,
  diffSnapshots,
  mergeSnapshots,
} from "./serialization";
import { GraphTraversalEngine } from "./traversal";
import type {
  EdgeInput,
  EdgePatch,
  GraphDiff,
  GraphEdge,
  GraphNode,
  GraphSnapshot,
  NodeInput,
  NodePatch,
  Subgraph,
  TraversalOptions,
  TraversalResult,
} from "./types";
import {
  assertIntegrity,
  checkConsistency,
  checkIntegrity,
  detectCycle,
  validateEdgeInput,
  validateNodeInput,
} from "./validation";
import type {
  GraphMetrics,
  GraphTelemetry,
} from "./telemetry";
import {
  createInMemoryMetrics,
  createNoopTelemetry,
} from "./telemetry";

export interface GraphManagerOptions {
  config: GraphConfiguration;
  metrics?: GraphMetrics;
  telemetry?: GraphTelemetry;
  eventBus?: GraphEventBus;
}

export class GraphManager {
  readonly id: string;
  readonly config: GraphConfiguration;
  readonly metrics: GraphMetrics;
  readonly telemetry: GraphTelemetry;
  readonly events: GraphEventBus;
  readonly query: GraphQueryEngine;
  readonly traversal: GraphTraversalEngine;
  private readonly index = new GraphIndex();

  constructor(opts: GraphManagerOptions) {
    this.id = opts.config.id;
    this.config = opts.config;
    this.metrics = opts.metrics ?? createInMemoryMetrics();
    this.telemetry = opts.telemetry ?? createNoopTelemetry();
    this.events = opts.eventBus ?? new GraphEventBus();
    this.query = new GraphQueryEngine(this.index);
    this.traversal = new GraphTraversalEngine(this.index, this.config);
  }

  // ----- Node lifecycle -----
  async addNode<T>(input: NodeInput<T>, ctx: EventContext = {}): Promise<GraphNode<T>> {
    validateNodeInput(input, this.config);
    if (this.index.nodeCount() >= this.config.limits.maxNodes) {
      throw new GraphValidationError("graph node limit exceeded");
    }
    if (input.id && this.index.hasNode(input.id)) {
      throw new GraphValidationError(`node id already exists: ${input.id}`);
    }
    const node = createNode(input, this.config);
    this.index.addNode(node);
    this.metrics.counter("graph.node.created", 1, { kind: String(node.kind) });
    this.metrics.gauge("graph.node.count", this.index.nodeCount());
    if (this.config.observability.emitLifecycleEvents) {
      await this.events.emit(makeEventEnvelope(this.id, "NodeCreated", { node }, ctx));
    }
    return node as GraphNode<T>;
  }

  async updateNode<T>(id: string, patch: NodePatch<T>, ctx: EventContext = {}): Promise<GraphNode<T>> {
    const before = this.index.getNode(id);
    if (!before) throw new GraphNotFoundError("node", id);
    const after = applyNodePatch(before, patch);
    this.index.updateNode(before, after);
    this.metrics.counter("graph.node.updated");
    if (this.config.observability.emitLifecycleEvents) {
      await this.events.emit(makeEventEnvelope(this.id, "NodeUpdated", { before, after }, ctx));
    }
    return after as GraphNode<T>;
  }

  async deleteNode(id: string, ctx: EventContext = {}): Promise<GraphNode | undefined> {
    // Capture incident edges BEFORE removing the node — the index drops
    // the node's edge sets on removeNode.
    const incident = [...this.index.edgesIncident(id)];
    const removed = this.index.removeNode(id);
    if (!removed) return undefined;
    for (const eid of incident) this.index.removeEdge(eid);
    this.metrics.counter("graph.node.deleted");
    this.metrics.gauge("graph.node.count", this.index.nodeCount());
    if (this.config.observability.emitLifecycleEvents) {
      await this.events.emit(makeEventEnvelope(this.id, "NodeDeleted", { node: removed }, ctx));
    }
    return removed;
  }

  // ----- Edge lifecycle -----
  async addEdge<T>(input: EdgeInput<T>, ctx: EventContext = {}): Promise<GraphEdge<T>> {
    validateEdgeInput(input, this.config);
    if (this.index.edgeCount() >= this.config.limits.maxEdges) {
      throw new GraphValidationError("graph edge limit exceeded");
    }
    if (this.config.validation.enforceReferentialIntegrity) {
      if (!this.index.hasNode(input.from)) throw new GraphNotFoundError("node", input.from);
      if (!this.index.hasNode(input.to)) throw new GraphNotFoundError("node", input.to);
    }
    if (this.config.validation.rejectDuplicateEdges) {
      for (const eid of this.index.edgesOut(input.from)) {
        const e = this.index.getEdge(eid);
        if (e && e.to === input.to && e.kind === input.kind) {
          throw new GraphValidationError(`duplicate edge ${input.kind} ${input.from}->${input.to}`);
        }
      }
    }
    const edge = createEdge(input, this.config);
    this.index.addEdge(edge);
    this.metrics.counter("graph.edge.created", 1, { kind: String(edge.kind) });
    this.metrics.gauge("graph.edge.count", this.index.edgeCount());
    if (this.config.observability.emitLifecycleEvents) {
      await this.events.emit(makeEventEnvelope(this.id, "EdgeCreated", { edge }, ctx));
    }
    return edge as GraphEdge<T>;
  }

  async updateEdge<T>(id: string, patch: EdgePatch<T>, ctx: EventContext = {}): Promise<GraphEdge<T>> {
    const before = this.index.getEdge(id);
    if (!before) throw new GraphNotFoundError("edge", id);
    const after = applyEdgePatch(before, patch);
    this.index.updateEdge(before, after);
    this.metrics.counter("graph.edge.updated");
    if (this.config.observability.emitLifecycleEvents) {
      await this.events.emit(makeEventEnvelope(this.id, "EdgeUpdated", { before, after }, ctx));
    }
    return after as GraphEdge<T>;
  }

  async deleteEdge(id: string, ctx: EventContext = {}): Promise<GraphEdge | undefined> {
    const removed = this.index.removeEdge(id);
    if (!removed) return undefined;
    this.metrics.counter("graph.edge.deleted");
    this.metrics.gauge("graph.edge.count", this.index.edgeCount());
    if (this.config.observability.emitLifecycleEvents) {
      await this.events.emit(makeEventEnvelope(this.id, "EdgeDeleted", { edge: removed }, ctx));
    }
    return removed;
  }

  // ----- Reads -----
  getNode(id: string): GraphNode | undefined { return this.index.getNode(id); }
  getEdge(id: string): GraphEdge | undefined { return this.index.getEdge(id); }
  allNodes(): readonly GraphNode[] { return this.index.allNodes(); }
  allEdges(): readonly GraphEdge[] { return this.index.allEdges(); }
  nodeCount(): number { return this.index.nodeCount(); }
  edgeCount(): number { return this.index.edgeCount(); }

  // ----- Traversal -----
  async traverse(rootId: string, opts: TraversalOptions = {}, ctx: EventContext = {}): Promise<TraversalResult> {
    if (this.config.observability.emitTraversalEvents) {
      await this.events.emit(makeEventEnvelope(this.id, "TraversalStarted", {
        rootId, strategy: opts.strategy ?? "bfs",
      }, ctx));
    }
    const result = await this.telemetry.span("graph.traverse", () => this.traversal.traverse(rootId, opts));
    this.metrics.histogram("graph.traverse.nodes", result.nodesVisited);
    this.metrics.histogram("graph.traverse.duration_ms", result.durationMs);
    if (this.config.observability.emitTraversalEvents) {
      await this.events.emit(makeEventEnvelope(this.id, "TraversalCompleted", { result }, ctx));
    }
    return result;
  }

  // ----- Subgraph -----
  async extractSubgraph(nodeIds: readonly string[], ctx: EventContext = {}): Promise<Subgraph> {
    if (nodeIds.length > this.config.limits.maxSubgraphNodes) {
      throw new GraphValidationError("subgraph exceeds max node limit");
    }
    const sub = this.query.extractSubgraph(nodeIds);
    await this.events.emit(makeEventEnvelope(this.id, "SubgraphCreated", {
      subgraphId: sub.id, nodes: sub.nodes.length, edges: sub.edges.length,
    }, ctx));
    return { ...sub, id: sub.id || newSubgraphId() };
  }

  // ----- Validation -----
  async validate(ctx: EventContext = {}): Promise<{ ok: boolean; issues: string[] }> {
    const nodes = this.allNodes();
    const edges = this.allEdges();
    const integrity = checkIntegrity(nodes, edges);
    const consistency = checkConsistency(nodes, edges);
    const issues = [...integrity.issues, ...consistency.issues];
    const ok = issues.length === 0;
    await this.events.emit(makeEventEnvelope(this.id, "GraphValidated", { ok, issues: issues.length }, ctx));
    return { ok, issues };
  }

  detectCycle(edgeKinds?: readonly string[]): string[] | null {
    return detectCycle(this.allNodes(), this.allEdges(), edgeKinds);
  }

  // ----- Compaction -----
  async compact(ctx: EventContext = {}): Promise<{ removedNodes: number; removedEdges: number }> {
    let removedNodes = 0;
    let removedEdges = 0;
    for (const n of this.allNodes()) {
      if (n.lifecycle === "deleted") {
        this.index.removeNode(n.id);
        removedNodes += 1;
      }
    }
    for (const e of this.allEdges()) {
      if (e.lifecycle === "deleted" || !this.index.hasNode(e.from) || !this.index.hasNode(e.to)) {
        this.index.removeEdge(e.id);
        removedEdges += 1;
      }
    }
    await this.events.emit(makeEventEnvelope(this.id, "GraphCompacted", { removedNodes, removedEdges }, ctx));
    return { removedNodes, removedEdges };
  }

  // ----- Snapshot / rollback -----
  async save(ctx: EventContext = {}, metadata: Record<string, unknown> = {}): Promise<GraphSnapshot> {
    const snap = createSnapshot(this.id, this.allNodes(), this.allEdges(), metadata);
    await this.events.emit(makeEventEnvelope(this.id, "GraphSaved", { snapshot: snap }, ctx));
    return snap;
  }

  async load(snap: GraphSnapshot, ctx: EventContext = {}): Promise<void> {
    assertIntegrity(snap.nodes, snap.edges);
    this.index.clear();
    for (const n of snap.nodes) this.index.addNode(n);
    for (const e of snap.edges) this.index.addEdge(e);
    this.metrics.gauge("graph.node.count", this.index.nodeCount());
    this.metrics.gauge("graph.edge.count", this.index.edgeCount());
    await this.events.emit(makeEventEnvelope(this.id, "GraphLoaded", { snapshot: snap }, ctx));
  }

  async rollback(snap: GraphSnapshot, ctx: EventContext = {}): Promise<void> {
    await this.load(snap, ctx);
  }

  diffAgainst(other: GraphSnapshot): GraphDiff {
    const current = createSnapshot(this.id, this.allNodes(), this.allEdges());
    return diffSnapshots(other, current);
  }

  mergeFrom(other: GraphSnapshot): GraphSnapshot {
    const current = createSnapshot(this.id, this.allNodes(), this.allEdges());
    return mergeSnapshots(current, other);
  }

  clear(): void {
    this.index.clear();
    this.metrics.gauge("graph.node.count", 0);
    this.metrics.gauge("graph.edge.count", 0);
  }
}
