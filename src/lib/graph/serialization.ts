/**
 * Graph Runtime — Serialization: snapshot, export, import, diff, merge, rollback.
 * Persistence-independent. Snapshots are portable JSON structures.
 */
import { GraphSerializationError } from "./errors";
import { newSnapshotId } from "./ids";
import type { GraphDiff, GraphEdge, GraphNode, GraphSnapshot } from "./types";

const SNAPSHOT_VERSION = 1;

export function createSnapshot(
  graphId: string,
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  metadata: Record<string, unknown> = {},
): GraphSnapshot {
  return Object.freeze({
    id: newSnapshotId(),
    version: SNAPSHOT_VERSION,
    createdAt: Date.now(),
    nodes: Object.freeze([...nodes]),
    edges: Object.freeze([...edges]),
    metadata: Object.freeze({ graphId, ...metadata }),
  });
}

export function exportSnapshot(snap: GraphSnapshot): string {
  try {
    return JSON.stringify(snap);
  } catch (err) {
    throw new GraphSerializationError("failed to serialize snapshot", { cause: String(err) });
  }
}

export function importSnapshot(payload: string): GraphSnapshot {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch (err) {
    throw new GraphSerializationError("failed to parse snapshot", { cause: String(err) });
  }
  if (!parsed || typeof parsed !== "object") {
    throw new GraphSerializationError("snapshot is not an object");
  }
  const snap = parsed as GraphSnapshot;
  if (snap.version !== SNAPSHOT_VERSION) {
    throw new GraphSerializationError(`unsupported snapshot version ${snap.version}`);
  }
  if (!Array.isArray(snap.nodes) || !Array.isArray(snap.edges)) {
    throw new GraphSerializationError("snapshot missing nodes or edges");
  }
  return snap;
}

/**
 * Compress a snapshot to a compact form using inline id de-duplication.
 * The output is JSON-encoded and can be decompressed with `decompressSnapshot`.
 * We do not depend on any binary compression library so the runtime works in
 * any JS environment.
 */
export function compressSnapshot(snap: GraphSnapshot): string {
  const nodeIndex = new Map<string, number>();
  snap.nodes.forEach((n, i) => nodeIndex.set(n.id, i));
  const nodes = snap.nodes.map((n) => [n.id, n.kind, n.data, n.tags, n.metadata, n.version, n.lifecycle, n.createdAt, n.updatedAt]);
  const edges = snap.edges.map((e) => [
    e.id,
    e.kind,
    nodeIndex.get(e.from) ?? e.from,
    nodeIndex.get(e.to) ?? e.to,
    e.direction,
    e.weight,
    e.confidence,
    e.data,
    e.metadata,
    e.version,
    e.lifecycle,
    e.createdAt,
    e.updatedAt,
  ]);
  return JSON.stringify({ v: SNAPSHOT_VERSION, id: snap.id, ts: snap.createdAt, meta: snap.metadata, n: nodes, e: edges });
}

export function decompressSnapshot(payload: string): GraphSnapshot {
  let raw: any;
  try { raw = JSON.parse(payload); } catch (err) {
    throw new GraphSerializationError("failed to parse compressed snapshot", { cause: String(err) });
  }
  if (!raw || raw.v !== SNAPSHOT_VERSION) throw new GraphSerializationError("invalid compressed snapshot");
  const nodes: GraphNode[] = (raw.n as any[]).map((r) => ({
    id: r[0], kind: r[1], data: r[2], tags: Object.freeze([...(r[3] ?? [])]),
    metadata: Object.freeze({ ...(r[4] ?? {}) }), version: r[5], lifecycle: r[6],
    createdAt: r[7], updatedAt: r[8],
  }));
  const idxToId = nodes.map((n) => n.id);
  const edges: GraphEdge[] = (raw.e as any[]).map((r) => ({
    id: r[0], kind: r[1],
    from: typeof r[2] === "number" ? idxToId[r[2]] : r[2],
    to: typeof r[3] === "number" ? idxToId[r[3]] : r[3],
    direction: r[4], weight: r[5], confidence: r[6],
    data: r[7], metadata: Object.freeze({ ...(r[8] ?? {}) }),
    version: r[9], lifecycle: r[10], createdAt: r[11], updatedAt: r[12],
  }));
  return {
    id: raw.id, version: SNAPSHOT_VERSION, createdAt: raw.ts,
    nodes: Object.freeze(nodes), edges: Object.freeze(edges), metadata: Object.freeze({ ...(raw.meta ?? {}) }),
  };
}

export function diffSnapshots(a: GraphSnapshot, b: GraphSnapshot): GraphDiff {
  const aNodes = new Map(a.nodes.map((n) => [n.id, n]));
  const bNodes = new Map(b.nodes.map((n) => [n.id, n]));
  const aEdges = new Map(a.edges.map((e) => [e.id, e]));
  const bEdges = new Map(b.edges.map((e) => [e.id, e]));

  const nodesAdded: GraphNode[] = [];
  const nodesRemoved: string[] = [];
  const nodesChanged: { before: GraphNode; after: GraphNode }[] = [];
  for (const [id, n] of bNodes) {
    const prev = aNodes.get(id);
    if (!prev) nodesAdded.push(n);
    else if (prev.version !== n.version || prev.updatedAt !== n.updatedAt) nodesChanged.push({ before: prev, after: n });
  }
  for (const id of aNodes.keys()) if (!bNodes.has(id)) nodesRemoved.push(id);

  const edgesAdded: GraphEdge[] = [];
  const edgesRemoved: string[] = [];
  const edgesChanged: { before: GraphEdge; after: GraphEdge }[] = [];
  for (const [id, e] of bEdges) {
    const prev = aEdges.get(id);
    if (!prev) edgesAdded.push(e);
    else if (prev.version !== e.version || prev.updatedAt !== e.updatedAt) edgesChanged.push({ before: prev, after: e });
  }
  for (const id of aEdges.keys()) if (!bEdges.has(id)) edgesRemoved.push(id);

  return { nodesAdded, nodesRemoved, nodesChanged, edgesAdded, edgesRemoved, edgesChanged };
}

/** Naive merge: b wins on conflicts. Callers can layer smarter strategies. */
export function mergeSnapshots(a: GraphSnapshot, b: GraphSnapshot): GraphSnapshot {
  const nodeMap = new Map<string, GraphNode>();
  for (const n of a.nodes) nodeMap.set(n.id, n);
  for (const n of b.nodes) nodeMap.set(n.id, n);
  const edgeMap = new Map<string, GraphEdge>();
  for (const e of a.edges) edgeMap.set(e.id, e);
  for (const e of b.edges) edgeMap.set(e.id, e);
  return createSnapshot(
    String(b.metadata.graphId ?? a.metadata.graphId ?? "unknown"),
    Array.from(nodeMap.values()),
    Array.from(edgeMap.values()),
    { mergedFrom: [a.id, b.id] },
  );
}
