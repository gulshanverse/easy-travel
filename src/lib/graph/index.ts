/**
 * Graph Runtime — Public API surface.
 *
 * The Knowledge Graph Runtime is the ONLY owner of graph operations across
 * Easy Trip. Downstream subsystems (Journey Engine, Recommendation Engine,
 * Trust Engine, Goal Intelligence, Spatial Intelligence, AI Agents) MUST
 * consume this runtime through its exported interfaces — never through
 * private internals.
 *
 * Provider-independent. Persistence-independent. Deterministic behaviour.
 */
export * from "./types";
export * from "./errors";
export * from "./config";
export * from "./ids";
export * from "./events";
export * from "./factories";
export { GraphIndex, type GraphIndexView } from "./index-set";
export { GraphQueryEngine } from "./query";
export { GraphTraversalEngine } from "./traversal";
export * from "./serialization";
export * from "./validation";
export {
  createInMemoryMetrics,
  createNoopTelemetry,
  createConsoleTelemetry,
  aggregateHealth,
  type GraphMetrics,
  type GraphMetricsSnapshot,
  type GraphTelemetry,
  type TelemetryLevel,
  type HealthStatus,
  type HealthCheckResult,
  type AggregatedHealth,
} from "./telemetry";
export { GraphManager, type GraphManagerOptions } from "./manager";
export {
  GraphRuntime,
  GraphRegistry,
  GraphFactory,
  createGraphRuntime,
  graphHealthCheck,
  runtimeHealth,
  DEFAULT_GRAPH_POLICIES,
  type GraphPolicies,
  type GraphRuntimeOptions,
  type GraphFactoryOptions,
} from "./runtime";
export * from "./ports";
