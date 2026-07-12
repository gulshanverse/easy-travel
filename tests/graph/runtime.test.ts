import { describe, it, expect } from "vitest";
import {
  createGraphRuntime,
  createSnapshot,
  diffSnapshots,
  compressSnapshot,
  decompressSnapshot,
  detectCycle,
  GraphValidationError,
  GraphNotFoundError,
} from "@/lib/graph";

const mkRuntime = () => {
  const rt = createGraphRuntime();
  const g = rt.createGraph({ id: "g1" });
  return { rt, g };
};

describe("GraphRuntime: nodes & edges", () => {
  it("creates, updates, deletes nodes with lifecycle events", async () => {
    const { g } = mkRuntime();
    const events: string[] = [];
    g.events.on((e) => { events.push(e.name); });
    const a = await g.addNode({ kind: "UserNode", data: { name: "A" }, tags: ["vip"] });
    expect(a.version).toBe(1);
    const b = await g.updateNode(a.id, { data: { name: "A2" } });
    expect(b.version).toBe(2);
    await g.deleteNode(a.id);
    expect(g.getNode(a.id)).toBeUndefined();
    expect(events).toContain("NodeCreated");
    expect(events).toContain("NodeUpdated");
    expect(events).toContain("NodeDeleted");
  });

  it("enforces referential integrity for edges", async () => {
    const { g } = mkRuntime();
    await expect(g.addEdge({ kind: "RELATED_TO", from: "x", to: "y" })).rejects.toBeInstanceOf(GraphNotFoundError);
  });

  it("rejects invalid confidence", async () => {
    const { g } = mkRuntime();
    const a = await g.addNode({ kind: "A", data: {} });
    const b = await g.addNode({ kind: "B", data: {} });
    await expect(g.addEdge({ kind: "R", from: a.id, to: b.id, confidence: 2 }))
      .rejects.toBeInstanceOf(GraphValidationError);
  });

  it("cascades edge removal on node delete", async () => {
    const { g } = mkRuntime();
    const a = await g.addNode({ kind: "A", data: {} });
    const b = await g.addNode({ kind: "B", data: {} });
    await g.addEdge({ kind: "R", from: a.id, to: b.id });
    expect(g.edgeCount()).toBe(1);
    await g.deleteNode(a.id);
    expect(g.edgeCount()).toBe(0);
  });
});

describe("GraphRuntime: query & traversal", () => {
  it("finds nodes by kind, tag, and metadata", async () => {
    const { g } = mkRuntime();
    await g.addNode({ id: "n1", kind: "DestinationNode", data: {}, tags: ["beach"], metadata: { country: "IT" } });
    await g.addNode({ id: "n2", kind: "DestinationNode", data: {}, tags: ["city"], metadata: { country: "FR" } });
    expect(g.query.findNodes({ kind: "DestinationNode" }).length).toBe(2);
    expect(g.query.findNodes({ tags: ["beach"] }).map((n) => n.id)).toEqual(["n1"]);
    expect(g.query.findNodes({ metadata: { country: "FR" } }).map((n) => n.id)).toEqual(["n2"]);
  });

  it("bfs and dfs traversal respect depth", async () => {
    const { g } = mkRuntime();
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) ids.push((await g.addNode({ id: `n${i}`, kind: "N", data: {} })).id);
    for (let i = 0; i < 4; i++) await g.addEdge({ kind: "R", from: ids[i]!, to: ids[i + 1]! });
    const bfs = await g.traverse("n0", { strategy: "bfs", direction: "out", maxDepth: 2 });
    expect(bfs.nodesVisited).toBe(3);
    expect(bfs.maxDepthReached).toBe(2);
    const dfs = await g.traverse("n0", { strategy: "dfs", direction: "out" });
    expect(dfs.nodesVisited).toBe(5);
  });

  it("computes shortest path deterministically", async () => {
    const { g } = mkRuntime();
    for (const id of ["a", "b", "c", "d"]) await g.addNode({ id, kind: "N", data: {} });
    await g.addEdge({ kind: "R", from: "a", to: "b" });
    await g.addEdge({ kind: "R", from: "b", to: "c" });
    await g.addEdge({ kind: "R", from: "c", to: "d" });
    await g.addEdge({ kind: "R", from: "a", to: "d", weight: 10 });
    const p = g.traversal.shortestPath("a", "d");
    expect(p?.length).toBe(1); // BFS picks a->d directly (fewer hops)
    expect(p?.edges[0]?.weight).toBe(10);
  });

  it("detects cycles", async () => {
    const { g } = mkRuntime();
    for (const id of ["a", "b", "c"]) await g.addNode({ id, kind: "N", data: {} });
    await g.addEdge({ kind: "R", from: "a", to: "b" });
    await g.addEdge({ kind: "R", from: "b", to: "c" });
    await g.addEdge({ kind: "R", from: "c", to: "a" });
    const cycle = detectCycle(g.allNodes(), g.allEdges());
    expect(cycle).not.toBeNull();
    expect(cycle!.length).toBeGreaterThanOrEqual(3);
  });

  it("extracts subgraphs", async () => {
    const { g } = mkRuntime();
    for (const id of ["a", "b", "c"]) await g.addNode({ id, kind: "N", data: {} });
    await g.addEdge({ kind: "R", from: "a", to: "b" });
    await g.addEdge({ kind: "R", from: "b", to: "c" });
    const sub = await g.extractSubgraph(["a", "b"]);
    expect(sub.nodes.length).toBe(2);
    expect(sub.edges.length).toBe(1);
  });

  it("search finds text across metadata", async () => {
    const { g } = mkRuntime();
    await g.addNode({ id: "x", kind: "D", data: {}, metadata: { name: "Kyoto" } });
    const r = g.query.search("kyo");
    expect(r.map((n) => n.id)).toEqual(["x"]);
  });
});

describe("GraphRuntime: serialization & validation", () => {
  it("snapshot, compress, decompress round-trip", async () => {
    const { g } = mkRuntime();
    const a = await g.addNode({ kind: "A", data: { v: 1 } });
    const b = await g.addNode({ kind: "B", data: {} });
    await g.addEdge({ kind: "R", from: a.id, to: b.id });
    const snap = await g.save();
    const comp = compressSnapshot(snap);
    const back = decompressSnapshot(comp);
    expect(back.nodes.length).toBe(2);
    expect(back.edges.length).toBe(1);
  });

  it("diff detects added/changed/removed", async () => {
    const { g } = mkRuntime();
    const a = await g.addNode({ kind: "A", data: {} });
    const s1 = await g.save();
    await g.updateNode(a.id, { data: { changed: true } });
    await g.addNode({ kind: "B", data: {} });
    const s2 = await g.save();
    const d = diffSnapshots(s1, s2);
    expect(d.nodesAdded.length).toBe(1);
    expect(d.nodesChanged.length).toBe(1);
  });

  it("validate & rollback restore prior state", async () => {
    const { g } = mkRuntime();
    const a = await g.addNode({ kind: "A", data: {} });
    const snap = await g.save();
    await g.deleteNode(a.id);
    expect(g.nodeCount()).toBe(0);
    await g.rollback(snap);
    expect(g.nodeCount()).toBe(1);
    const v = await g.validate();
    expect(v.ok).toBe(true);
  });

  it("handles stress: 1000 nodes, 2000 edges", async () => {
    const { g } = mkRuntime();
    const N = 1000;
    for (let i = 0; i < N; i++) await g.addNode({ id: `n${i}`, kind: "N", data: {} });
    for (let i = 0; i < N; i++) {
      await g.addEdge({ kind: "R", from: `n${i}`, to: `n${(i + 1) % N}` });
      await g.addEdge({ kind: "R", from: `n${i}`, to: `n${(i + 3) % N}` });
    }
    const t0 = Date.now();
    const r = await g.traverse("n0", { direction: "out", maxNodes: 500 });
    expect(r.nodesVisited).toBeGreaterThan(0);
    expect(Date.now() - t0).toBeLessThan(2000);
  });
});

describe("GraphRuntime: registry & health", () => {
  it("registers and lists multiple graphs", () => {
    const rt = createGraphRuntime();
    rt.createGraph({ id: "g-a" });
    rt.createGraph({ id: "g-b" });
    expect(rt.listGraphs().length).toBe(2);
    expect(rt.health().status).toBe("healthy");
  });
});
