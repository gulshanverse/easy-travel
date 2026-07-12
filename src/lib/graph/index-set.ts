/**
 * Graph Runtime — In-memory index set.
 * Maintains inverted indices for node kind, tag, metadata keys, edge kind,
 * edge incidence, and version. Update-on-mutation, O(1) lookup surface.
 * Persistence adapters can implement the same shape.
 */
import type { GraphEdge, GraphNode, EdgeKind, NodeKind } from "./types";

export interface GraphIndexView {
  nodeIds(): readonly string[];
  edgeIds(): readonly string[];
  nodesByKind(kind: NodeKind): readonly string[];
  nodesByTag(tag: string): readonly string[];
  nodesByMetadataKey(key: string): readonly string[];
  edgesByKind(kind: EdgeKind): readonly string[];
  edgesOut(nodeId: string): readonly string[];
  edgesIn(nodeId: string): readonly string[];
  edgesIncident(nodeId: string): readonly string[];
  hasNode(id: string): boolean;
  hasEdge(id: string): boolean;
}

export class GraphIndex implements GraphIndexView {
  private nodes = new Map<string, GraphNode>();
  private edges = new Map<string, GraphEdge>();
  private byNodeKind = new Map<string, Set<string>>();
  private byTag = new Map<string, Set<string>>();
  private byMetaKey = new Map<string, Set<string>>();
  private byEdgeKind = new Map<string, Set<string>>();
  private outEdges = new Map<string, Set<string>>();
  private inEdges = new Map<string, Set<string>>();
  private nodeVersions = new Map<string, number>();
  private edgeVersions = new Map<string, number>();

  addNode(node: GraphNode): void {
    this.nodes.set(node.id, node);
    this.nodeVersions.set(node.id, node.version);
    this.addToSet(this.byNodeKind, node.kind as string, node.id);
    for (const tag of node.tags) this.addToSet(this.byTag, tag, node.id);
    for (const key of Object.keys(node.metadata)) this.addToSet(this.byMetaKey, key, node.id);
    if (!this.outEdges.has(node.id)) this.outEdges.set(node.id, new Set());
    if (!this.inEdges.has(node.id)) this.inEdges.set(node.id, new Set());
  }

  removeNode(id: string): GraphNode | undefined {
    const node = this.nodes.get(id);
    if (!node) return undefined;
    this.nodes.delete(id);
    this.nodeVersions.delete(id);
    this.removeFromSet(this.byNodeKind, node.kind as string, id);
    for (const tag of node.tags) this.removeFromSet(this.byTag, tag, id);
    for (const key of Object.keys(node.metadata)) this.removeFromSet(this.byMetaKey, key, id);
    this.outEdges.delete(id);
    this.inEdges.delete(id);
    return node;
  }

  updateNode(before: GraphNode, after: GraphNode): void {
    this.removeNode(before.id);
    this.addNode(after);
  }

  addEdge(edge: GraphEdge): void {
    this.edges.set(edge.id, edge);
    this.edgeVersions.set(edge.id, edge.version);
    this.addToSet(this.byEdgeKind, edge.kind as string, edge.id);
    this.addToSet(this.outEdges, edge.from, edge.id);
    this.addToSet(this.inEdges, edge.to, edge.id);
    if (edge.direction === "undirected") {
      this.addToSet(this.outEdges, edge.to, edge.id);
      this.addToSet(this.inEdges, edge.from, edge.id);
    }
  }

  removeEdge(id: string): GraphEdge | undefined {
    const edge = this.edges.get(id);
    if (!edge) return undefined;
    this.edges.delete(id);
    this.edgeVersions.delete(id);
    this.removeFromSet(this.byEdgeKind, edge.kind as string, id);
    this.removeFromSet(this.outEdges, edge.from, id);
    this.removeFromSet(this.inEdges, edge.to, id);
    if (edge.direction === "undirected") {
      this.removeFromSet(this.outEdges, edge.to, id);
      this.removeFromSet(this.inEdges, edge.from, id);
    }
    return edge;
  }

  updateEdge(before: GraphEdge, after: GraphEdge): void {
    this.removeEdge(before.id);
    this.addEdge(after);
  }

  getNode(id: string): GraphNode | undefined { return this.nodes.get(id); }
  getEdge(id: string): GraphEdge | undefined { return this.edges.get(id); }
  allNodes(): readonly GraphNode[] { return Array.from(this.nodes.values()); }
  allEdges(): readonly GraphEdge[] { return Array.from(this.edges.values()); }
  nodeCount(): number { return this.nodes.size; }
  edgeCount(): number { return this.edges.size; }

  // View surface
  nodeIds(): readonly string[] { return Array.from(this.nodes.keys()); }
  edgeIds(): readonly string[] { return Array.from(this.edges.keys()); }
  nodesByKind(kind: NodeKind): readonly string[] { return Array.from(this.byNodeKind.get(kind as string) ?? []); }
  nodesByTag(tag: string): readonly string[] { return Array.from(this.byTag.get(tag) ?? []); }
  nodesByMetadataKey(key: string): readonly string[] { return Array.from(this.byMetaKey.get(key) ?? []); }
  edgesByKind(kind: EdgeKind): readonly string[] { return Array.from(this.byEdgeKind.get(kind as string) ?? []); }
  edgesOut(nodeId: string): readonly string[] { return Array.from(this.outEdges.get(nodeId) ?? []); }
  edgesIn(nodeId: string): readonly string[] { return Array.from(this.inEdges.get(nodeId) ?? []); }
  edgesIncident(nodeId: string): readonly string[] {
    const out = new Set(this.outEdges.get(nodeId) ?? []);
    for (const id of this.inEdges.get(nodeId) ?? []) out.add(id);
    return Array.from(out);
  }
  hasNode(id: string): boolean { return this.nodes.has(id); }
  hasEdge(id: string): boolean { return this.edges.has(id); }

  nodeVersion(id: string): number | undefined { return this.nodeVersions.get(id); }
  edgeVersion(id: string): number | undefined { return this.edgeVersions.get(id); }

  clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.byNodeKind.clear();
    this.byTag.clear();
    this.byMetaKey.clear();
    this.byEdgeKind.clear();
    this.outEdges.clear();
    this.inEdges.clear();
    this.nodeVersions.clear();
    this.edgeVersions.clear();
  }

  private addToSet<K>(map: Map<K, Set<string>>, key: K, value: string): void {
    let s = map.get(key);
    if (!s) { s = new Set(); map.set(key, s); }
    s.add(value);
  }
  private removeFromSet<K>(map: Map<K, Set<string>>, key: K, value: string): void {
    const s = map.get(key);
    if (!s) return;
    s.delete(value);
    if (s.size === 0) map.delete(key);
  }
}
