/**
 * Canonical persisted collections. Every adapter maps exactly one engine
 * concept onto one collection name — never two.
 */

export const COLLECTIONS = Object.freeze({
  users: "users",
  profiles: "profiles",
  travelProfiles: "travel_profiles",
  preferences: "preferences",
  journeys: "journeys",
  savedJourneys: "saved_journeys",
  workflowInstances: "workflow_instances",
  workflowCheckpoints: "workflow_checkpoints",
  memoryRecords: "memory_records",
  graphNodes: "graph_nodes",
  graphEdges: "graph_edges",
  notifications: "notifications",
  capabilities: "capabilities",
  connectorMetadata: "connector_metadata",
  auditLogs: "audit_logs",
  travelRecords: "travel_records",
} as const);

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

export const ALL_COLLECTIONS: readonly CollectionName[] = Object.freeze(
  Object.values(COLLECTIONS),
);
