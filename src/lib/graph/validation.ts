/**
 * Graph Runtime — Validation.
 * Schema, referential integrity, cycle, consistency, version checks. Pure
 * functions so validation can be reused by the manager, the query engine,
 * and external audit tooling.
 */
import type { GraphConfiguration } from "./config";
import { GraphIntegrityError, GraphValidationError } from "./errors";
import type { EdgeInput, GraphEdge, GraphNode, NodeInput } from "./types";

const isNonEmptyString = (v: unknown): v is string => typeof v === "string" && v.length > 0;

export function validateNodeInput(input: NodeInput, config: GraphConfiguration): void {
  if (!isNonEmptyString(input.kind)) throw new GraphValidationError("node.kind is required");
  if (input.tags && input.tags.length > config.limits.maxTagsPerNode) {
    throw new GraphValidationError(
      `node has ${input.tags.length} tags but limit is ${config.limits.maxTagsPerNode}`,
    );
  }
  if (input.metadata) {
    const bytes = JSON.stringify(input.metadata).length;
    if (bytes > config.limits.maxMetadataBytes) {
      throw new GraphValidationError(
        `node metadata is ${bytes}B but limit is ${config.limits.maxMetadataBytes}B`,
      );
    }
  }
  if (
    config.validation.requireKnownNodeKinds &&
    config.validation.allowedNodeKinds &&
    !config.validation.allowedNodeKinds.includes(input.kind as string)
  ) {
    throw new GraphValidationError(`node.kind '${input.kind}' is not allowed`);
  }
}

export function validateEdgeInput(input: EdgeInput, config: GraphConfiguration): void {
  if (!isNonEmptyString(input.kind)) throw new GraphValidationError("edge.kind is required");
  if (!isNonEmptyString(input.from)) throw new GraphValidationError("edge.from is required");
  if (!isNonEmptyString(input.to)) throw new GraphValidationError("edge.to is required");
  if (config.validation.rejectSelfLoops && input.from === input.to) {
    throw new GraphValidationError("self-loops are disallowed");
  }
  if (input.weight !== undefined && (!Number.isFinite(input.weight) || input.weight < 0)) {
    throw new GraphValidationError("edge.weight must be a finite, non-negative number");
  }
  if (
    input.confidence !== undefined &&
    (!Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1)
  ) {
    throw new GraphValidationError("edge.confidence must be in [0,1]");
  }
  if (
    config.validation.allowedEdgeKinds &&
    !config.validation.allowedEdgeKinds.includes(input.kind as string)
  ) {
    throw new GraphValidationError(`edge.kind '${input.kind}' is not allowed`);
  }
}

export interface IntegrityReport {
  ok: boolean;
  issues: string[];
}

export function checkIntegrity(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
): IntegrityReport {
  const ids = new Set(nodes.map((n) => n.id));
  const issues: string[] = [];
  for (const e of edges) {
    if (!ids.has(e.from)) issues.push(`edge ${e.id}: missing source ${e.from}`);
    if (!ids.has(e.to)) issues.push(`edge ${e.id}: missing target ${e.to}`);
  }
  return { ok: issues.length === 0, issues };
}

export function assertIntegrity(nodes: readonly GraphNode[], edges: readonly GraphEdge[]): void {
  const r = checkIntegrity(nodes, edges);
  if (!r.ok) throw new GraphIntegrityError("graph integrity check failed", { issues: r.issues });
}

/** Detect any directed cycle. Returns the first cycle path or null. */
export function detectCycle(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  edgeKinds?: readonly string[],
): string[] | null {
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) {
    if (edgeKinds && !edgeKinds.includes(e.kind as string)) continue;
    if (e.direction === "undirected") continue;
    (adj.get(e.from) ?? []).push(e.to);
  }
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  for (const id of adj.keys()) color.set(id, WHITE);
  const stack: string[] = [];

  const visit = (id: string): string[] | null => {
    color.set(id, GRAY);
    stack.push(id);
    for (const next of adj.get(id) ?? []) {
      const c = color.get(next);
      if (c === GRAY) {
        const idx = stack.indexOf(next);
        return stack.slice(idx).concat(next);
      }
      if (c === WHITE) {
        const found = visit(next);
        if (found) return found;
      }
    }
    color.set(id, BLACK);
    stack.pop();
    return null;
  };

  for (const id of adj.keys()) {
    if (color.get(id) === WHITE) {
      const c = visit(id);
      if (c) return c;
    }
  }
  return null;
}

export function checkConsistency(nodes: readonly GraphNode[], edges: readonly GraphEdge[]): IntegrityReport {
  const issues: string[] = [];
  const nodeIds = new Set<string>();
  for (const n of nodes) {
    if (nodeIds.has(n.id)) issues.push(`duplicate node id ${n.id}`);
    nodeIds.add(n.id);
    if (n.version < 1) issues.push(`node ${n.id}: invalid version ${n.version}`);
  }
  const edgeIds = new Set<string>();
  for (const e of edges) {
    if (edgeIds.has(e.id)) issues.push(`duplicate edge id ${e.id}`);
    edgeIds.add(e.id);
    if (e.version < 1) issues.push(`edge ${e.id}: invalid version ${e.version}`);
  }
  return { ok: issues.length === 0, issues };
}
