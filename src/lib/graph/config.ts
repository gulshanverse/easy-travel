/**
 * Graph Runtime — Immutable configuration.
 * Environment-independent. Callers pass full or partial config; missing
 * fields are filled from defaults.
 */
import type { EdgeDirection, LifecycleState } from "./types";

export interface GraphLimits {
  readonly maxNodes: number;
  readonly maxEdges: number;
  readonly maxTagsPerNode: number;
  readonly maxMetadataBytes: number;
  readonly maxTraversalDepth: number;
  readonly maxTraversalNodes: number;
  readonly maxSubgraphNodes: number;
  readonly maxPathLength: number;
}

export interface GraphDefaults {
  readonly edgeDirection: EdgeDirection;
  readonly edgeWeight: number;
  readonly edgeConfidence: number;
  readonly nodeLifecycle: LifecycleState;
  readonly edgeLifecycle: LifecycleState;
}

export interface GraphValidationPolicy {
  readonly enforceReferentialIntegrity: boolean;
  readonly rejectSelfLoops: boolean;
  readonly rejectDuplicateEdges: boolean;
  readonly requireKnownNodeKinds: boolean;
  readonly allowedNodeKinds?: readonly string[];
  readonly allowedEdgeKinds?: readonly string[];
}

export interface GraphObservabilityPolicy {
  readonly emitLifecycleEvents: boolean;
  readonly emitTraversalEvents: boolean;
  readonly sampleTraversalMetrics: boolean;
}

export interface GraphConfiguration {
  readonly id: string;
  readonly limits: GraphLimits;
  readonly defaults: GraphDefaults;
  readonly validation: GraphValidationPolicy;
  readonly observability: GraphObservabilityPolicy;
}

export const DEFAULT_GRAPH_LIMITS: GraphLimits = Object.freeze({
  maxNodes: 100_000,
  maxEdges: 500_000,
  maxTagsPerNode: 64,
  maxMetadataBytes: 32 * 1024,
  maxTraversalDepth: 32,
  maxTraversalNodes: 10_000,
  maxSubgraphNodes: 10_000,
  maxPathLength: 64,
});

export const DEFAULT_GRAPH_DEFAULTS: GraphDefaults = Object.freeze({
  edgeDirection: "directed",
  edgeWeight: 1,
  edgeConfidence: 1,
  nodeLifecycle: "active",
  edgeLifecycle: "active",
});

export const DEFAULT_GRAPH_VALIDATION: GraphValidationPolicy = Object.freeze({
  enforceReferentialIntegrity: true,
  rejectSelfLoops: false,
  rejectDuplicateEdges: false,
  requireKnownNodeKinds: false,
});

export const DEFAULT_GRAPH_OBSERVABILITY: GraphObservabilityPolicy = Object.freeze({
  emitLifecycleEvents: true,
  emitTraversalEvents: true,
  sampleTraversalMetrics: true,
});

export function defineGraphConfig(partial: Partial<GraphConfiguration> & { id: string }): GraphConfiguration {
  return Object.freeze({
    id: partial.id,
    limits: Object.freeze({ ...DEFAULT_GRAPH_LIMITS, ...partial.limits }),
    defaults: Object.freeze({ ...DEFAULT_GRAPH_DEFAULTS, ...partial.defaults }),
    validation: Object.freeze({ ...DEFAULT_GRAPH_VALIDATION, ...partial.validation }),
    observability: Object.freeze({ ...DEFAULT_GRAPH_OBSERVABILITY, ...partial.observability }),
  });
}
