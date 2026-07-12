/**
 * Graph Runtime — Query engine.
 * Deterministic filters, neighbour search, ranking, and search over the
 * in-memory index. All results are sorted by stable id secondary keys so
 * outputs are reproducible.
 */
import { GraphIndex } from "./index-set";
import type {
  EdgeQuery,
  GraphEdge,
  GraphNode,
  NodeQuery,
  Subgraph,
} from "./types";
import { newSubgraphId } from "./ids";

const stableById = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

const asArray = <T>(v: T | readonly T[] | undefined): readonly T[] =>
  v === undefined ? [] : Array.isArray(v) ? (v as readonly T[]) : [v as T];

function metadataMatches(node: GraphNode, filter?: Record<string, unknown>): boolean {
  if (!filter) return true;
  for (const [k, v] of Object.entries(filter)) if (node.metadata[k] !== v) return false;
  return true;
}

export class GraphQueryEngine {
  constructor(private readonly index: GraphIndex) {}

  getNode(id: string): GraphNode | undefined { return this.index.getNode(id); }
  getEdge(id: string): GraphEdge | undefined { return this.index.getEdge(id); }

  findNodes(query: NodeQuery = {}): readonly GraphNode[] {
    let candidates: string[];
    const kinds = asArray(query.kind);
    if (query.ids?.length) {
      candidates = [...query.ids];
    } else if (kinds.length) {
      const s = new Set<string>();
      for (const k of kinds) for (const id of this.index.nodesByKind(k)) s.add(id);
      candidates = Array.from(s);
    } else if (query.tags?.length) {
      const s = new Set<string>(this.index.nodesByTag(query.tags[0]!));
      for (let i = 1; i < query.tags.length; i++) {
        const t = new Set(this.index.nodesByTag(query.tags[i]!));
        for (const id of s) if (!t.has(id)) s.delete(id);
      }
      candidates = Array.from(s);
    } else {
      candidates = [...this.index.nodeIds()];
    }
    const lifecycles = asArray(query.lifecycle);
    const requiredTags = query.tags ?? [];
    const results: GraphNode[] = [];
    for (const id of candidates) {
      const n = this.index.getNode(id);
      if (!n) continue;
      if (lifecycles.length && !lifecycles.includes(n.lifecycle)) continue;
      if (requiredTags.length && !requiredTags.every((t) => n.tags.includes(t))) continue;
      if (!metadataMatches(n, query.metadata)) continue;
      results.push(n);
    }
    results.sort(stableById);
    return query.limit ? results.slice(0, query.limit) : results;
  }

  findEdges(query: EdgeQuery = {}): readonly GraphEdge[] {
    let candidateIds: string[];
    const kinds = asArray(query.kind);
    if (query.incident) {
      candidateIds = [...this.index.edgesIncident(query.incident)];
    } else if (query.from) {
      candidateIds = [...this.index.edgesOut(query.from)];
    } else if (query.to) {
      candidateIds = [...this.index.edgesIn(query.to)];
    } else if (kinds.length) {
      const s = new Set<string>();
      for (const k of kinds) for (const id of this.index.edgesByKind(k)) s.add(id);
      candidateIds = Array.from(s);
    } else {
      candidateIds = [...this.index.edgeIds()];
    }
    const lifecycles = asArray(query.lifecycle);
    const results: GraphEdge[] = [];
    for (const id of candidateIds) {
      const e = this.index.getEdge(id);
      if (!e) continue;
      if (kinds.length && !kinds.includes(e.kind)) continue;
      if (query.from && e.from !== query.from && !(e.direction === "undirected" && e.to === query.from)) continue;
      if (query.to && e.to !== query.to && !(e.direction === "undirected" && e.from === query.to)) continue;
      if (query.minWeight !== undefined && e.weight < query.minWeight) continue;
      if (query.minConfidence !== undefined && e.confidence < query.minConfidence) continue;
      if (lifecycles.length && !lifecycles.includes(e.lifecycle)) continue;
      results.push(e);
    }
    results.sort(stableById);
    return query.limit ? results.slice(0, query.limit) : results;
  }

  neighbours(nodeId: string, opts: {
    direction?: "in" | "out" | "both";
    edgeKinds?: readonly string[];
    minWeight?: number;
    minConfidence?: number;
  } = {}): readonly { node: GraphNode; edge: GraphEdge }[] {
    const direction = opts.direction ?? "both";
    const source = this.index.getNode(nodeId);
    if (!source) return [];
    const ids = direction === "in"
      ? this.index.edgesIn(nodeId)
      : direction === "out"
        ? this.index.edgesOut(nodeId)
        : this.index.edgesIncident(nodeId);
    const out: { node: GraphNode; edge: GraphEdge }[] = [];
    for (const id of ids) {
      const e = this.index.getEdge(id);
      if (!e) continue;
      if (opts.edgeKinds && !opts.edgeKinds.includes(e.kind as string)) continue;
      if (opts.minWeight !== undefined && e.weight < opts.minWeight) continue;
      if (opts.minConfidence !== undefined && e.confidence < opts.minConfidence) continue;
      const otherId = e.from === nodeId ? e.to : e.from;
      const other = this.index.getNode(otherId);
      if (!other) continue;
      out.push({ node: other, edge: e });
    }
    out.sort((a, b) => stableById(a.node, b.node));
    return out;
  }

  /** Rank nodes by a scoring function; ties resolved by stable id. */
  rankNodes(
    nodes: readonly GraphNode[],
    score: (n: GraphNode) => number,
    limit?: number,
  ): readonly { node: GraphNode; score: number }[] {
    const scored = nodes.map((n) => ({ node: n, score: score(n) }));
    scored.sort((a, b) => (b.score - a.score) || stableById(a.node, b.node));
    return limit ? scored.slice(0, limit) : scored;
  }

  /** Substring search over selected metadata keys and tags. Deterministic. */
  search(term: string, opts: { fields?: readonly string[]; limit?: number } = {}): readonly GraphNode[] {
    const needle = term.trim().toLowerCase();
    if (!needle) return [];
    const fields = opts.fields;
    const out: GraphNode[] = [];
    for (const n of this.index.allNodes()) {
      const hay: string[] = [n.id.toLowerCase(), (n.kind as string).toLowerCase(), ...n.tags.map((t) => t.toLowerCase())];
      for (const [k, v] of Object.entries(n.metadata)) {
        if (fields && !fields.includes(k)) continue;
        if (typeof v === "string") hay.push(v.toLowerCase());
      }
      if (hay.some((h) => h.includes(needle))) out.push(n);
    }
    out.sort(stableById);
    return opts.limit ? out.slice(0, opts.limit) : out;
  }

  extractSubgraph(nodeIds: readonly string[]): Subgraph {
    const nodeSet = new Set(nodeIds);
    const nodes: GraphNode[] = [];
    for (const id of nodeIds) {
      const n = this.index.getNode(id);
      if (n) nodes.push(n);
    }
    nodes.sort(stableById);
    const edges: GraphEdge[] = [];
    const seenEdges = new Set<string>();
    for (const id of nodeSet) {
      for (const eid of this.index.edgesIncident(id)) {
        if (seenEdges.has(eid)) continue;
        const e = this.index.getEdge(eid);
        if (!e) continue;
        if (nodeSet.has(e.from) && nodeSet.has(e.to)) {
          edges.push(e);
          seenEdges.add(eid);
        }
      }
    }
    edges.sort(stableById);
    return {
      id: newSubgraphId(),
      nodes: Object.freeze(nodes),
      edges: Object.freeze(edges),
      createdAt: Date.now(),
    };
  }
}
