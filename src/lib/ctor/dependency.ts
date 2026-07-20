/** CTOR — dependency resolution & topological sorting. */
import { DependencyCycleError, DependencyUnresolvedError } from "./errors";

export interface DAGNode {
  readonly id: string;
  readonly dependsOn: readonly string[];
}

/** Kahn's algorithm; stable ordering by input index for determinism. */
export function topologicalSort<T extends DAGNode>(nodes: readonly T[]): readonly T[] {
  const byId = new Map<string, T>();
  const indeg = new Map<string, number>();
  const order = new Map<string, number>();
  nodes.forEach((n, i) => { byId.set(n.id, n); indeg.set(n.id, 0); order.set(n.id, i); });
  for (const n of nodes) {
    for (const d of n.dependsOn) {
      if (!byId.has(d)) throw new DependencyUnresolvedError(n.id, d);
      indeg.set(n.id, (indeg.get(n.id) ?? 0) + 1);
    }
  }
  const ready: T[] = [];
  for (const n of nodes) if ((indeg.get(n.id) ?? 0) === 0) ready.push(n);
  ready.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  const out: T[] = [];
  const remaining = new Set(nodes.map(n => n.id));
  while (ready.length) {
    const n = ready.shift()!;
    out.push(n);
    remaining.delete(n.id);
    for (const m of nodes) {
      if (!remaining.has(m.id)) continue;
      if (m.dependsOn.includes(n.id)) {
        indeg.set(m.id, (indeg.get(m.id) ?? 0) - 1);
        if ((indeg.get(m.id) ?? 0) === 0) {
          ready.push(m);
          ready.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
        }
      }
    }
  }
  if (out.length !== nodes.length) {
    throw new DependencyCycleError(findCycle(nodes));
  }
  return out;
}

export function findCycle<T extends DAGNode>(nodes: readonly T[]): readonly string[] {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const state = new Map<string, 0 | 1 | 2>();
  const stack: string[] = [];
  function dfs(id: string): string[] | null {
    const s = state.get(id) ?? 0;
    if (s === 1) {
      const idx = stack.indexOf(id);
      return stack.slice(idx).concat(id);
    }
    if (s === 2) return null;
    state.set(id, 1);
    stack.push(id);
    for (const d of byId.get(id)?.dependsOn ?? []) {
      const c = dfs(d);
      if (c) return c;
    }
    stack.pop();
    state.set(id, 2);
    return null;
  }
  for (const n of nodes) {
    const c = dfs(n.id);
    if (c) return c;
  }
  return [];
}

/** Group nodes into execution layers (each layer runs in parallel). */
export function computeLayers<T extends DAGNode>(nodes: readonly T[]): readonly (readonly T[])[] {
  topologicalSort(nodes); // validates
  const byId = new Map(nodes.map(n => [n.id, n]));
  const done = new Set<string>();
  const layers: T[][] = [];
  while (done.size < nodes.length) {
    const layer: T[] = [];
    for (const n of nodes) {
      if (done.has(n.id)) continue;
      if (n.dependsOn.every(d => done.has(d))) layer.push(n);
    }
    if (!layer.length) throw new DependencyCycleError([...byId.keys()].filter(k => !done.has(k)));
    layers.push(layer);
    for (const n of layer) done.add(n.id);
  }
  return layers;
}
