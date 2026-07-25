/** IPCF — Connector manager (lifecycle + invocation orchestration). */
import { AuthenticationRegistry } from "./auth";
import type { IntegrationEventBus } from "./events";
import {
  IntegrationExecutionError, IntegrationNotFoundError,
} from "./errors";
import { withUpdated, makeConnector, makeSnapshot } from "./factories";
import { CircuitBreaker, ConcurrencyLimiter, RateLimiter } from "./governance";
import { assertTransition } from "./lifecycle";
import type { IntegrationMetrics } from "./metrics";
import type { IntegrationPolicies } from "./policies";
import { createPipelineHooks, runPipeline, type PipelineHooks } from "./pipeline";
import type { IntegrationTelemetrySink } from "./telemetry";
import { ConnectorRegistry, type ConnectorQuery } from "./registry";
import { validateConnector, validateDefinition } from "./validation";
import type {
  Connector, ConnectorDefinition, ConnectorExecutor, ConnectorRequest,
  ConnectorResponse, ConnectorSnapshot, ConnectorStatus,
} from "./types";
import type { IntegrationConfig } from "./config";
import type { IntegrationAgentPort, IntegrationCtorPort } from "./ports";

export interface ConnectorManagerDeps {
  readonly config: IntegrationConfig;
  readonly policies: IntegrationPolicies;
  readonly registry: ConnectorRegistry;
  readonly events: IntegrationEventBus;
  readonly metrics: IntegrationMetrics;
  readonly telemetry: IntegrationTelemetrySink;
  readonly auth: AuthenticationRegistry;
  readonly rateLimiter: RateLimiter;
  readonly concurrency: ConcurrencyLimiter;
  readonly circuit: CircuitBreaker;
  readonly hooks: PipelineHooks;
  readonly ctor: IntegrationCtorPort;
  readonly agent: IntegrationAgentPort;
}

export class ConnectorManager {
  constructor(private readonly deps: ConnectorManagerDeps) {}

  async register(definition: ConnectorDefinition): Promise<Connector> {
    validateDefinition(definition);
    const connector = makeConnector({ definition });
    validateConnector(connector);
    this.deps.registry.register(connector);
    this.deps.metrics.connectorRegistered();
    this.deps.events.emit({ name: "ConnectorRegistered", connectorId: connector.id, data: { manifest: connector.definition.manifest } });
    for (const cap of connector.definition.manifest.capabilities) {
      await this.deps.ctor.advertiseCapability({
        connectorId: connector.id, capabilityId: cap.id, version: cap.version,
      });
    }
    return connector;
  }

  validate(connectorId: string): Connector {
    const c = this.deps.registry.require(connectorId);
    validateConnector(c);
    this.deps.registry.validateDependencies(c);
    assertTransition(c.status, "validated");
    const updated = withUpdated(c, { status: "validated" }, { kind: "validated" });
    this.deps.registry.update(updated);
    this.deps.metrics.connectorValidated();
    this.deps.events.emit({ name: "ConnectorValidated", connectorId: c.id, data: {} });
    return updated;
  }
  enable(connectorId: string): Connector { return this.transition(connectorId, "enabled", "ConnectorEnabled"); }
  disable(connectorId: string): Connector { return this.transition(connectorId, "disabled", "ConnectorDisabled"); }
  retire(connectorId: string): Connector { return this.transition(connectorId, "retired", "ConnectorRetired"); }

  private transition(id: string, to: ConnectorStatus, event: "ConnectorEnabled" | "ConnectorDisabled" | "ConnectorRetired"): Connector {
    const c = this.deps.registry.require(id);
    assertTransition(c.status, to);
    const updated = withUpdated(c, { status: to }, { kind: to });
    this.deps.registry.update(updated);
    if (to === "enabled") this.deps.metrics.connectorEnabled();
    else if (to === "disabled") this.deps.metrics.connectorDisabled();
    else if (to === "retired") this.deps.metrics.connectorRetired();
    this.deps.events.emit({ name: event, connectorId: id, data: { from: c.status, to } });
    return updated;
  }

  snapshot(id: string): ConnectorSnapshot { return makeSnapshot(this.deps.registry.require(id)); }
  list(q?: ConnectorQuery): readonly Connector[] { return this.deps.registry.discover(q); }

  registerExecutor(connectorId: string, executor: ConnectorExecutor): void {
    if (!this.deps.registry.get(connectorId)) throw new IntegrationNotFoundError("connector", connectorId);
    this.deps.hooks.executors.set(connectorId, executor);
  }

  async invoke<T = unknown>(request: ConnectorRequest): Promise<ConnectorResponse<T>> {
    const connector = this.deps.registry.require(request.connectorId);
    if (connector.status !== "enabled" && connector.status !== "validated" && connector.status !== "degraded") {
      throw new IntegrationExecutionError(`connector ${connector.id} is not invocable (status=${connector.status})`);
    }
    this.deps.metrics.normalizeRequest();
    this.deps.events.emit({ name: "RequestNormalized", connectorId: connector.id, correlationId: request.correlationId, data: { capabilityId: request.capabilityId } });
    try {
      const outcome = await runPipeline<T>(connector, request, {
        hooks: this.deps.hooks,
        auth: this.deps.auth,
        rateLimiter: this.deps.rateLimiter,
        concurrency: this.deps.concurrency,
        circuit: this.deps.circuit,
        policies: this.deps.policies,
        telemetry: this.deps.telemetry,
        defaultTimeoutMs: this.deps.config.defaultRequestTimeoutMs,
      });
      this.deps.metrics.invocation(outcome.response.ok, outcome.latencyMs);
      this.deps.metrics.normalizeResponse();
      const nextStats = {
        invocations: connector.statistics.invocations + 1,
        successes: connector.statistics.successes + (outcome.response.ok ? 1 : 0),
        failures: connector.statistics.failures + (outcome.response.ok ? 0 : 1),
        avgLatencyMs: rollingAvg(connector.statistics.avgLatencyMs, connector.statistics.invocations, outcome.latencyMs),
        lastInvokedAt: Date.now(),
      };
      const updated = withUpdated(connector, {
        statistics: Object.freeze(nextStats),
      });
      this.deps.registry.update(updated);
      this.deps.events.emit({
        name: "ConnectorInvoked", connectorId: connector.id,
        correlationId: request.correlationId,
        data: { capabilityId: request.capabilityId, ok: outcome.response.ok, latencyMs: outcome.latencyMs, attempts: outcome.attempts },
      });
      this.deps.events.emit({ name: "ResponseNormalized", connectorId: connector.id, correlationId: request.correlationId, data: { ok: outcome.response.ok } });
      if (!outcome.response.ok) {
        this.deps.events.emit({ name: "ConnectorFailed", connectorId: connector.id, correlationId: request.correlationId, data: { error: outcome.response.error } });
      }
      await this.deps.agent.notifyConnectorEvent({
        kind: "invoked",
        connectorId: connector.id,
        correlationId: request.correlationId,
        at: Date.now(),
        payload: { ok: outcome.response.ok, capabilityId: request.capabilityId },
      });
      return outcome.response;
    } catch (e) {
      this.deps.metrics.invocation(false, 0);
      this.deps.events.emit({
        name: "ConnectorFailed", connectorId: connector.id,
        correlationId: request.correlationId,
        data: { error: (e as Error).message },
      });
      throw e;
    }
  }
}

function rollingAvg(prev: number, count: number, next: number): number {
  if (count <= 0) return next;
  return (prev * count + next) / (count + 1);
}
