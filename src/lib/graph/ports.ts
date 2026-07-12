/**
 * Graph Runtime — Ports.
 * Interface-only contracts for external subsystems. Ports let the graph
 * runtime consume other runtimes (memory, prompt, runtime kernel, provider)
 * and be consumed by future runtimes (journey, recommendation, trust,
 * goal intelligence, spatial intelligence, AI agents) without direct
 * implementation coupling.
 *
 * NOTE: No concrete implementations live here. Adapters are wired in the
 *       composition root of each subsystem.
 */
import type { GraphNode, GraphEdge, GraphSnapshot } from "./types";

/** Contract exposed by the Memory Engine to the Graph Runtime. */
export interface MemoryEngineGraphPort {
  fetchMemoryNode(memoryId: string): Promise<GraphNode | null>;
  linkMemoryToNode(memoryId: string, nodeId: string): Promise<void>;
}

/** Contract exposed by the Prompt Runtime. */
export interface PromptRuntimeGraphPort {
  fetchPromptNode(promptId: string): Promise<GraphNode | null>;
}

/** Contract exposed by the Runtime Kernel. */
export interface RuntimeKernelGraphPort {
  resolveCapabilityNode(capabilityId: string): Promise<GraphNode | null>;
}

/** Contract exposed by the Provider Runtime. */
export interface ProviderRuntimeGraphPort {
  fetchProviderNode(providerId: string): Promise<GraphNode | null>;
}

/** Contract the graph exposes to future engines. */
export interface GraphReadPort {
  getNode(id: string): GraphNode | undefined;
  getEdge(id: string): GraphEdge | undefined;
  snapshot(): GraphSnapshot;
}

export interface GraphWritePort {
  upsertNode(node: GraphNode): Promise<void>;
  upsertEdge(edge: GraphEdge): Promise<void>;
}

/** Ports for downstream consumers — declared here so consumers can import
 *  types without depending on the manager implementation. */
export interface JourneyEnginePort {
  readonly kind: "journey";
}
export interface RecommendationEnginePort {
  readonly kind: "recommendation";
}
export interface TrustEnginePort {
  readonly kind: "trust";
}
export interface GoalIntelligencePort {
  readonly kind: "goal";
}
export interface SpatialIntelligencePort {
  readonly kind: "spatial";
}
export interface AIAgentPort {
  readonly kind: "ai-agent";
}
