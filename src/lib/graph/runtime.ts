/**
 * Graph Runtime — Registry, Factory, Runtime facade, Health, Policies.
 * A single process can host multiple named graphs (e.g. per-user overlays,
 * per-tenant knowledge slices). The registry keeps them addressable; the
 * factory constructs them from configuration; the runtime is the public
 * facade the rest of the platform consumes.
 */
import type { GraphConfiguration } from "./config";
import { defineGraphConfig } from "./config";
import { GraphConfigurationError, GraphNotFoundError } from "./errors";
import { GraphEventBus } from "./events";
import { GraphManager } from "./manager";
import {
  aggregateHealth,
  createInMemoryMetrics,
  createNoopTelemetry,
  type AggregatedHealth,
  type GraphMetrics,
  type GraphTelemetry,
  type HealthCheckResult,
} from "./telemetry";

export interface GraphPolicies {
  readonly maxGraphs: number;
  readonly allowDynamicCreation: boolean;
}

export const DEFAULT_GRAPH_POLICIES: GraphPolicies = Object.freeze({
  maxGraphs: 64,
  allowDynamicCreation: true,
});

export interface GraphFactoryOptions {
  metrics?: GraphMetrics;
  telemetry?: GraphTelemetry;
  eventBus?: GraphEventBus;
}

export class GraphFactory {
  constructor(private readonly opts: GraphFactoryOptions = {}) {}
  create(config: GraphConfiguration): GraphManager {
    return new GraphManager({
      config,
      metrics: this.opts.metrics ?? createInMemoryMetrics(),
      telemetry: this.opts.telemetry ?? createNoopTelemetry(),
      eventBus: this.opts.eventBus ?? new GraphEventBus(),
    });
  }
}

export class GraphRegistry {
  private graphs = new Map<string, GraphManager>();
  constructor(private readonly policies: GraphPolicies = DEFAULT_GRAPH_POLICIES) {}

  register(graph: GraphManager): void {
    if (this.graphs.has(graph.id)) {
      throw new GraphConfigurationError(`graph already registered: ${graph.id}`);
    }
    if (this.graphs.size >= this.policies.maxGraphs) {
      throw new GraphConfigurationError("registry graph limit exceeded");
    }
    this.graphs.set(graph.id, graph);
  }

  unregister(id: string): boolean { return this.graphs.delete(id); }
  get(id: string): GraphManager | undefined { return this.graphs.get(id); }
  require(id: string): GraphManager {
    const g = this.graphs.get(id);
    if (!g) throw new GraphNotFoundError("subgraph", id);
    return g;
  }
  list(): readonly GraphManager[] { return Array.from(this.graphs.values()); }
  count(): number { return this.graphs.size; }
  clear(): void { this.graphs.clear(); }
}

// ----- Health checks -----
export function graphHealthCheck(graph: GraphManager): HealthCheckResult {
  const nodes = graph.nodeCount();
  const edges = graph.edgeCount();
  const softNodeLimit = graph.config.limits.maxNodes * 0.9;
  const softEdgeLimit = graph.config.limits.maxEdges * 0.9;
  const status = nodes > softNodeLimit || edges > softEdgeLimit ? "degraded" : "healthy";
  return {
    name: `graph:${graph.id}`,
    status,
    details: { nodes, edges },
  };
}

export function runtimeHealth(registry: GraphRegistry): AggregatedHealth {
  const checks: HealthCheckResult[] = [];
  for (const g of registry.list()) checks.push(graphHealthCheck(g));
  if (!checks.length) {
    checks.push({ name: "graph:runtime", status: "healthy", details: { graphs: 0 } });
  }
  return aggregateHealth(checks);
}

// ----- Runtime facade -----
export interface GraphRuntimeOptions {
  policies?: GraphPolicies;
  factory?: GraphFactory;
  registry?: GraphRegistry;
  metrics?: GraphMetrics;
  telemetry?: GraphTelemetry;
  eventBus?: GraphEventBus;
}

export class GraphRuntime {
  readonly policies: GraphPolicies;
  readonly registry: GraphRegistry;
  readonly factory: GraphFactory;
  readonly metrics: GraphMetrics;
  readonly telemetry: GraphTelemetry;
  readonly events: GraphEventBus;

  constructor(opts: GraphRuntimeOptions = {}) {
    this.policies = opts.policies ?? DEFAULT_GRAPH_POLICIES;
    this.metrics = opts.metrics ?? createInMemoryMetrics();
    this.telemetry = opts.telemetry ?? createNoopTelemetry();
    this.events = opts.eventBus ?? new GraphEventBus();
    this.factory = opts.factory ?? new GraphFactory({
      metrics: this.metrics, telemetry: this.telemetry, eventBus: this.events,
    });
    this.registry = opts.registry ?? new GraphRegistry(this.policies);
  }

  createGraph(config: Partial<GraphConfiguration> & { id: string }): GraphManager {
    if (!this.policies.allowDynamicCreation) {
      throw new GraphConfigurationError("dynamic graph creation is disabled");
    }
    const full = defineGraphConfig(config);
    const graph = this.factory.create(full);
    this.registry.register(graph);
    return graph;
  }

  graph(id: string): GraphManager { return this.registry.require(id); }
  tryGraph(id: string): GraphManager | undefined { return this.registry.get(id); }
  listGraphs(): readonly GraphManager[] { return this.registry.list(); }
  removeGraph(id: string): boolean { return this.registry.unregister(id); }
  health(): AggregatedHealth { return runtimeHealth(this.registry); }
  shutdown(): void {
    for (const g of this.registry.list()) g.clear();
    this.registry.clear();
    this.events.clear();
  }
}

export function createGraphRuntime(opts: GraphRuntimeOptions = {}): GraphRuntime {
  return new GraphRuntime(opts);
}
