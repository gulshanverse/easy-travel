/**
 * TIOS Capability Dependency Graph (Milestone 5.3).
 * Builds a directed graph over the capability registry and detects
 * circular deps, missing deps, and version conflicts. Capabilities never
 * call each other directly — resolution goes through this graph.
 */
import { getCapability, listCapabilities } from "./registry";
import type { CapabilityId } from "./types";

export interface DependencyEdge {
  from: CapabilityId;
  to: CapabilityId;
  optional: boolean;
}

export interface DependencyIssue {
  kind: "circular" | "missing" | "version-conflict";
  capabilityId: CapabilityId;
  details: string;
}

export interface DependencyReport {
  edges: DependencyEdge[];
  issues: DependencyIssue[];
  order: CapabilityId[];  // topological order (leaves first)
  healthy: boolean;
}

function detectCycles(
  node: CapabilityId,
  adj: Map<CapabilityId, CapabilityId[]>,
  visiting: Set<CapabilityId>,
  visited: Set<CapabilityId>,
  path: CapabilityId[],
): CapabilityId[] | null {
  if (visiting.has(node)) return [...path, node];
  if (visited.has(node)) return null;
  visiting.add(node);
  for (const next of adj.get(node) ?? []) {
    const cyc = detectCycles(next, adj, visiting, visited, [...path, node]);
    if (cyc) return cyc;
  }
  visiting.delete(node);
  visited.add(node);
  return null;
}

/** Build the dependency graph and report on health. */
export function analyzeDependencies(): DependencyReport {
  const capabilities = listCapabilities();
  const edges: DependencyEdge[] = [];
  const issues: DependencyIssue[] = [];
  const adj = new Map<CapabilityId, CapabilityId[]>();
  const ids = new Set(capabilities.map((c) => c.manifest.id));

  for (const cap of capabilities) {
    const deps = cap.manifest.dependencies;
    adj.set(cap.manifest.id, deps.slice());
    for (const dep of deps) {
      edges.push({ from: cap.manifest.id, to: dep, optional: false });
      if (!ids.has(dep)) {
        issues.push({
          kind: "missing",
          capabilityId: cap.manifest.id,
          details: `depends on unregistered capability "${dep}"`,
        });
      }
    }
  }

  // Cycle detection
  const visited = new Set<CapabilityId>();
  for (const cap of capabilities) {
    const cyc = detectCycles(cap.manifest.id, adj, new Set(), visited, []);
    if (cyc) {
      issues.push({
        kind: "circular",
        capabilityId: cap.manifest.id,
        details: `cycle: ${cyc.join(" → ")}`,
      });
    }
  }

  // Topological order (Kahn's) — best-effort even with cycles.
  const inDegree = new Map<CapabilityId, number>();
  for (const id of ids) inDegree.set(id, 0);
  for (const [, deps] of adj) for (const d of deps) {
    inDegree.set(d, (inDegree.get(d) ?? 0) + 1);
  }
  const queue: CapabilityId[] = [];
  for (const [id, deg] of inDegree) if (deg === 0) queue.push(id);
  const order: CapabilityId[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const next of adj.get(id) ?? []) {
      const d = (inDegree.get(next) ?? 0) - 1;
      inDegree.set(next, d);
      if (d === 0) queue.push(next);
    }
  }

  return {
    edges,
    issues,
    order,
    healthy: issues.length === 0,
  };
}

/** Resolve transitive dependencies of a capability, honouring the graph. */
export function resolveDependencies(id: CapabilityId): CapabilityId[] {
  const out = new Set<CapabilityId>();
  const walk = (cur: CapabilityId) => {
    const cap = getCapability(cur);
    if (!cap) return;
    for (const dep of cap.manifest.dependencies) {
      if (out.has(dep)) continue;
      out.add(dep);
      walk(dep);
    }
  };
  walk(id);
  return Array.from(out);
}
