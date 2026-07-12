/**
 * Graph Runtime — Type surface.
 * Node kinds, edge kinds, lifecycle, metadata, query and traversal types.
 * Everything here is provider-independent and persistence-independent.
 */

// ---------- Node kinds ----------
export type CoreNodeKind =
  | "JourneyNode"
  | "DestinationNode"
  | "LocationNode"
  | "PreferenceNode"
  | "UserNode"
  | "BudgetNode"
  | "MemoryNode"
  | "ConversationNode"
  | "GoalNode"
  | "CapabilityNode"
  | "ProviderNode"
  | "RelationshipNode"
  | "EvidenceNode"
  | "ToolNode"
  | "SessionNode"
  | "ContextNode";

/** Node kinds are extensible; unknown strings are allowed. */
export type NodeKind = CoreNodeKind | (string & {});

// ---------- Edge kinds ----------
export type CoreEdgeKind =
  | "RELATED_TO"
  | "VISITED"
  | "PREFERS"
  | "BELONGS_TO"
  | "PART_OF"
  | "SIMILAR_TO"
  | "GENERATED_BY"
  | "REFERENCES"
  | "DEPENDS_ON"
  | "SUPPORTS"
  | "CONNECTED_TO"
  | "INFLUENCES"
  | "OWNS"
  | "HAS_MEMORY"
  | "HAS_GOAL"
  | "HAS_BUDGET";

export type EdgeKind = CoreEdgeKind | (string & {});

export type EdgeDirection = "directed" | "undirected";

export type LifecycleState =
  | "draft"
  | "active"
  | "archived"
  | "deleted";

export interface GraphMetadata {
  readonly [key: string]: unknown;
}

// ---------- Nodes ----------
export interface GraphNode<T = unknown> {
  readonly id: string;
  readonly kind: NodeKind;
  readonly data: T;
  readonly tags: readonly string[];
  readonly metadata: GraphMetadata;
  readonly version: number;
  readonly lifecycle: LifecycleState;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface NodeInput<T = unknown> {
  id?: string;
  kind: NodeKind;
  data: T;
  tags?: readonly string[];
  metadata?: GraphMetadata;
  lifecycle?: LifecycleState;
}

export interface NodePatch<T = unknown> {
  data?: T;
  tags?: readonly string[];
  metadata?: GraphMetadata;
  lifecycle?: LifecycleState;
}

// ---------- Edges ----------
export interface GraphEdge<T = unknown> {
  readonly id: string;
  readonly kind: EdgeKind;
  readonly from: string;
  readonly to: string;
  readonly direction: EdgeDirection;
  readonly weight: number;
  readonly confidence: number;
  readonly data: T;
  readonly metadata: GraphMetadata;
  readonly version: number;
  readonly lifecycle: LifecycleState;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface EdgeInput<T = unknown> {
  id?: string;
  kind: EdgeKind;
  from: string;
  to: string;
  direction?: EdgeDirection;
  weight?: number;
  confidence?: number;
  data?: T;
  metadata?: GraphMetadata;
  lifecycle?: LifecycleState;
}

export interface EdgePatch<T = unknown> {
  weight?: number;
  confidence?: number;
  data?: T;
  metadata?: GraphMetadata;
  lifecycle?: LifecycleState;
}

// ---------- Queries ----------
export interface NodeQuery {
  kind?: NodeKind | readonly NodeKind[];
  tags?: readonly string[];
  lifecycle?: LifecycleState | readonly LifecycleState[];
  metadata?: Record<string, unknown>;
  ids?: readonly string[];
  limit?: number;
}

export interface EdgeQuery {
  kind?: EdgeKind | readonly EdgeKind[];
  from?: string;
  to?: string;
  incident?: string;
  minWeight?: number;
  minConfidence?: number;
  lifecycle?: LifecycleState | readonly LifecycleState[];
  limit?: number;
}

// ---------- Traversal ----------
export type TraversalStrategy = "bfs" | "dfs";

export interface TraversalOptions {
  strategy?: TraversalStrategy;
  maxDepth?: number;
  maxNodes?: number;
  edgeKinds?: readonly EdgeKind[];
  nodeKinds?: readonly NodeKind[];
  direction?: "out" | "in" | "both";
  minWeight?: number;
  minConfidence?: number;
  filterNode?: (node: GraphNode) => boolean;
  filterEdge?: (edge: GraphEdge) => boolean;
}

export interface TraversalStep {
  readonly node: GraphNode;
  readonly edge: GraphEdge | null;
  readonly depth: number;
}

export interface TraversalResult {
  readonly id: string;
  readonly rootId: string;
  readonly strategy: TraversalStrategy;
  readonly steps: readonly TraversalStep[];
  readonly nodesVisited: number;
  readonly edgesTraversed: number;
  readonly maxDepthReached: number;
  readonly truncated: boolean;
  readonly durationMs: number;
}

export interface PathResult {
  readonly from: string;
  readonly to: string;
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
  readonly length: number;
  readonly totalWeight: number;
}

// ---------- Subgraph ----------
export interface Subgraph {
  readonly id: string;
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
  readonly createdAt: number;
}

// ---------- Snapshot ----------
export interface GraphSnapshot {
  readonly id: string;
  readonly version: number;
  readonly createdAt: number;
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
  readonly metadata: GraphMetadata;
}

// ---------- Diff ----------
export interface GraphDiff {
  readonly nodesAdded: readonly GraphNode[];
  readonly nodesRemoved: readonly string[];
  readonly nodesChanged: readonly { readonly before: GraphNode; readonly after: GraphNode }[];
  readonly edgesAdded: readonly GraphEdge[];
  readonly edgesRemoved: readonly string[];
  readonly edgesChanged: readonly { readonly before: GraphEdge; readonly after: GraphEdge }[];
}
