/** RICS — connector registry, factory, resolver, manager and runtime.
 *  ALL provider execution goes through IPCF (ADR-008/ADR-011): the adapter
 *  is only ever reached from the connector executor registered on IPCF.
 */
import {
  createIntegrationRuntime, makeCapability, makeContract, makeDefinition, makeManifest,
  makeMetadata, makePolicy, makeRequest, makeRateLimit, makeRetryPolicy,
  type Connector, type ConnectorExecutor, type ConnectorResponse, type IntegrationRuntime,
} from "@/lib/integration";
import { RAILWAY_CAPABILITY_IDS, RAILWAY_CONTRACTS, requireContract, type RailwayCapabilityId } from "./contracts";
import { RailwayResolutionError, RailwayValidationError } from "./errors";
import { RailwayConnectorMetrics } from "./metrics";
import { normalizeRailwayPayload } from "./normalization";
import { noopRailwayTelemetry, railLog, type RailwayTelemetrySink } from "./telemetry";
import type { RailwayProviderAdapter, RailwayRequestInput } from "./providers/types";

export interface RailwayConnectorRecord {
  readonly connectorId: string;
  readonly adapter: RailwayProviderAdapter;
  readonly priority: number;
  readonly capabilities: readonly RailwayCapabilityId[];
}

/** Registry of railway connectors and their capability index. */
export class RailwayConnectorRegistry {
  private readonly records = new Map<string, RailwayConnectorRecord>();
  private readonly byCapability = new Map<string, Set<string>>();

  add(record: RailwayConnectorRecord): void {
    if (this.records.has(record.connectorId)) {
      throw new RailwayValidationError(`railway connector already registered: ${record.connectorId}`);
    }
    this.records.set(record.connectorId, Object.freeze({ ...record }));
    for (const c of record.capabilities) {
      let set = this.byCapability.get(c);
      if (!set) { set = new Set(); this.byCapability.set(c, set); }
      set.add(record.connectorId);
    }
  }
  get(id: string): RailwayConnectorRecord | undefined { return this.records.get(id); }
  list(): readonly RailwayConnectorRecord[] { return [...this.records.values()]; }
  forCapability(capability: RailwayCapabilityId): readonly RailwayConnectorRecord[] {
    return [...(this.byCapability.get(capability) ?? [])]
      .map((id) => this.records.get(id)!)
      .sort((a, b) => b.priority - a.priority || a.connectorId.localeCompare(b.connectorId));
  }
  capabilities(): readonly RailwayCapabilityId[] {
    return RAILWAY_CAPABILITY_IDS.filter((c) => (this.byCapability.get(c)?.size ?? 0) > 0);
  }
  clear(): void { this.records.clear(); this.byCapability.clear(); }
  size(): number { return this.records.size; }
}

/** Builds IPCF connector definitions from a railway provider adapter. */
export class RailwayConnectorFactory {
  static definition(adapter: RailwayProviderAdapter) {
    const caps = adapter.profile.capabilities.map((id) => {
      const c = requireContract(id);
      return makeCapability({
        id: c.id, name: c.name, version: c.version, description: c.description,
        inputs: c.inputs, outputs: [c.output],
        metadata: { volatility: c.volatility, cacheable: c.cacheable },
      });
    });
    const contract = makeContract({
      id: `railway.contract.${adapter.profile.id}`,
      category: "railway",
      capabilities: caps,
      authentication: ["anonymous", "api-key"],
      version: "1.0.0",
      metadata: { providerIndependent: true },
    });
    const manifest = makeManifest({
      id: `railway.${adapter.profile.id}`,
      name: adapter.profile.name,
      category: "railway",
      version: "1.0.0",
      contract,
      capabilities: caps,
      metadata: makeMetadata({
        tags: ["railway", adapter.profile.kind, adapter.profile.functional ? "functional" : "stub"],
        labels: { providerKind: adapter.profile.kind, country: adapter.profile.country },
        owner: "railway-connector-suite",
        description: `Railway connector for ${adapter.profile.name}`,
      }),
    });
    return makeDefinition({
      manifest,
      policy: makePolicy({
        rateLimit: makeRateLimit(1200, 60),
        retry: makeRetryPolicy({ maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 5, jitter: false }),
        concurrency: 16,
      }),
    });
  }

  /** The executor: adapter call + normalization. No transport of any kind. */
  static executor(
    adapter: RailwayProviderAdapter,
    metrics: RailwayConnectorMetrics,
    telemetry: RailwayTelemetrySink,
  ): ConnectorExecutor {
    return async (ctx) => {
      const capability = ctx.request.capabilityId as RailwayCapabilityId;
      const input = (ctx.request.payload ?? {}) as RailwayRequestInput;
      const raw = await adapter.execute(capability, input);
      if (!raw.ok) {
        railLog(telemetry, "warn", "railway.provider.error", "provider returned an error", {
          provider: adapter.profile.id, capability, code: raw.error?.code,
        });
        return { ok: false, error: raw.error ?? { code: "provider_error", message: "unknown provider error" } };
      }
      try {
        const data = normalizeRailwayPayload(capability, raw.data);
        metrics.normalization(true);
        return { ok: true, data, pagination: raw.pagination };
      } catch (e) {
        metrics.normalization(false);
        railLog(telemetry, "error", "railway.normalization.failed", (e as Error).message, {
          provider: adapter.profile.id, capability,
        });
        return {
          ok: false,
          error: { code: "railway_normalization_error", message: (e as Error).message, retryable: false },
        };
      }
    };
  }
}

/** Chooses connectors for a capability, honouring preference and fallback. */
export class RailwayConnectorResolver {
  constructor(private readonly registry: RailwayConnectorRegistry) {}
  resolve(capability: RailwayCapabilityId, preferProviderId?: string): readonly RailwayConnectorRecord[] {
    const all = this.registry.forCapability(capability);
    if (all.length === 0) throw new RailwayResolutionError(capability);
    if (!preferProviderId) return all;
    const preferred = all.filter((r) => r.adapter.profile.id === preferProviderId);
    const rest = all.filter((r) => r.adapter.profile.id !== preferProviderId);
    if (preferred.length === 0) throw new RailwayResolutionError(`${capability} via ${preferProviderId}`);
    return [...preferred, ...rest];
  }
}

export interface RailwayHealthEntry {
  readonly connectorId: string;
  readonly providerId: string;
  readonly functional: boolean;
  readonly healthy: boolean;
  readonly status: string;
  readonly reason?: string;
}
export interface RailwayHealthReport {
  readonly healthy: boolean;
  readonly at: number;
  readonly integrationHealthy: boolean;
  readonly connectors: readonly RailwayHealthEntry[];
  readonly capabilities: readonly RailwayCapabilityId[];
}

/** Health checks across the suite (delegates connector state to IPCF). */
export class RailwayConnectorHealth {
  constructor(
    private readonly registry: RailwayConnectorRegistry,
    private readonly integration: IntegrationRuntime,
  ) {}
  async report(): Promise<RailwayHealthReport> {
    const ipcf = await this.integration.health();
    const ipcfHealthy = ipcf.status !== "unhealthy";
    const connectors: RailwayHealthEntry[] = [];
    for (const r of this.registry.list()) {
      const probe = await r.adapter.probe();
      const c: Connector | undefined = this.integration.registry.get(r.connectorId);
      connectors.push(Object.freeze({
        connectorId: r.connectorId,
        providerId: r.adapter.profile.id,
        functional: r.adapter.profile.functional,
        healthy: probe.healthy,
        status: c?.status ?? "unknown",
        reason: probe.reason,
      }));
    }
    return Object.freeze({
      healthy: ipcfHealthy && connectors.some((c) => c.healthy),
      at: Date.now(),
      integrationHealthy: ipcfHealthy,
      connectors: Object.freeze(connectors),
      capabilities: this.registry.capabilities(),
    });
  }
}

export interface RailwayInvokeOptions {
  readonly providerId?: string;
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly fallback?: boolean;
}

/** Lifecycle + invocation orchestration on top of IPCF. */
export class RailwayConnectorManager {
  constructor(
    private readonly integration: IntegrationRuntime,
    private readonly registry: RailwayConnectorRegistry,
    private readonly resolver: RailwayConnectorResolver,
    private readonly metrics: RailwayConnectorMetrics,
    private readonly telemetry: RailwayTelemetrySink,
  ) {}

  async registerProvider(adapter: RailwayProviderAdapter, priority = 0): Promise<string> {
    const definition = RailwayConnectorFactory.definition(adapter);
    const connector = await this.integration.manager.register(definition);
    this.integration.manager.registerExecutor(
      connector.id,
      RailwayConnectorFactory.executor(adapter, this.metrics, this.telemetry),
    );
    this.integration.manager.validate(connector.id);
    this.metrics.connectorRegistered();
    this.registry.add({
      connectorId: connector.id,
      adapter,
      priority,
      capabilities: adapter.profile.capabilities,
    });
    if (adapter.profile.functional) {
      this.integration.manager.enable(connector.id);
      this.metrics.connectorEnabled();
    } else {
      this.integration.manager.enable(connector.id);
      this.integration.manager.disable(connector.id);
    }
    railLog(this.telemetry, "info", "railway.connector.registered", "connector registered", {
      connectorId: connector.id, provider: adapter.profile.id, functional: adapter.profile.functional,
    });
    return connector.id;
  }

  async invoke<T = unknown>(
    capability: RailwayCapabilityId,
    payload: RailwayRequestInput = {},
    options: RailwayInvokeOptions = {},
  ): Promise<ConnectorResponse<T>> {
    const contract = requireContract(capability);
    for (const field of contract.required) {
      if (payload[field] === undefined || payload[field] === null || payload[field] === "") {
        throw new RailwayValidationError(`${capability}: '${field}' is required`);
      }
    }
    let candidates: readonly RailwayConnectorRecord[];
    try {
      candidates = this.resolver.resolve(capability, options.providerId);
    } catch (e) {
      this.metrics.resolutionFailure();
      throw e;
    }
    const ordered = options.fallback === false ? candidates.slice(0, 1) : candidates;
    let last: ConnectorResponse<T> | undefined;
    for (let i = 0; i < ordered.length; i += 1) {
      const record = ordered[i];
      if (i > 0) this.metrics.fallback();
      this.metrics.request(capability, record.adapter.profile.id);
      const started = Date.now();
      const request = makeRequest({
        connectorId: record.connectorId,
        capabilityId: capability,
        payload,
        correlationId: options.correlationId,
        causationId: options.causationId,
        metadata: { suite: "railway", provider: record.adapter.profile.id },
      });
      let response: ConnectorResponse<T>;
      try {
        response = await this.integration.manager.invoke<T>(request);
      } catch (e) {
        this.metrics.response(capability, record.adapter.profile.id, false, Date.now() - started);
        railLog(this.telemetry, "error", "railway.invoke.threw", (e as Error).message, {
          capability, provider: record.adapter.profile.id,
        });
        continue;
      }
      this.metrics.response(capability, record.adapter.profile.id, response.ok, Date.now() - started);
      railLog(this.telemetry, response.ok ? "info" : "warn", "railway.invoke", "capability invoked", {
        capability, provider: record.adapter.profile.id, ok: response.ok,
        latencyMs: response.diagnostics.latencyMs,
      });
      if (response.ok) return response;
      last = response;
    }
    if (last) return last;
    throw new RailwayResolutionError(capability);
  }
}

export interface RailwayRuntimeOptions {
  readonly integration?: IntegrationRuntime;
  readonly telemetry?: RailwayTelemetrySink;
}

/** Public facade for the Railway Intelligence Connector Suite. */
export class RailwayConnectorRuntime {
  readonly integration: IntegrationRuntime;
  readonly registry = new RailwayConnectorRegistry();
  readonly metrics = new RailwayConnectorMetrics();
  readonly telemetry: RailwayTelemetrySink;
  readonly resolver: RailwayConnectorResolver;
  readonly manager: RailwayConnectorManager;
  readonly health: RailwayConnectorHealth;

  constructor(options: RailwayRuntimeOptions = {}) {
    this.integration = options.integration ?? createIntegrationRuntime();
    this.telemetry = options.telemetry ?? noopRailwayTelemetry;
    this.resolver = new RailwayConnectorResolver(this.registry);
    this.manager = new RailwayConnectorManager(
      this.integration, this.registry, this.resolver, this.metrics, this.telemetry,
    );
    this.health = new RailwayConnectorHealth(this.registry, this.integration);
  }

  registerProvider(adapter: RailwayProviderAdapter, priority = 0): Promise<string> {
    return this.manager.registerProvider(adapter, priority);
  }

  invoke<T = unknown>(
    capability: RailwayCapabilityId,
    payload?: RailwayRequestInput,
    options?: RailwayInvokeOptions,
  ): Promise<ConnectorResponse<T>> {
    return this.manager.invoke<T>(capability, payload, options);
  }

  /** Capability discovery surface (CTOR-facing). */
  discoverCapabilities() {
    return this.registry.capabilities().map((id) => ({
      ...RAILWAY_CONTRACTS[id],
      providers: this.registry.forCapability(id).map((r) => r.adapter.profile.id),
    }));
  }

  metricsSnapshot() { return this.metrics.snapshot(); }
  healthReport() { return this.health.report(); }
  shutdown(): void { this.registry.clear(); this.metrics.reset(); this.integration.shutdown(); }
}

export function createRailwayConnectorRuntime(options: RailwayRuntimeOptions = {}): RailwayConnectorRuntime {
  return new RailwayConnectorRuntime(options);
}
