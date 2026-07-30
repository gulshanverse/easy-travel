/** MTIP — registry, factory, resolver, health, manager and per-mode runtimes.
 *  ALL provider execution goes through IPCF (ADR-008/ADR-016): adapters are only
 *  ever reached from the connector executor registered on IPCF.
 */
import {
  createIntegrationRuntime,
  makeCapability,
  makeContract,
  makeDefinition,
  makeManifest,
  makeMetadata,
  makePolicy,
  makeRequest,
  makeRateLimit,
  makeRetryPolicy,
  type Connector,
  type ConnectorExecutor,
  type ConnectorResponse,
  type IntegrationRuntime,
} from "@/lib/integration";
import {
  MULTIMODAL_CAPABILITY_IDS,
  MULTIMODAL_CONTRACTS,
  capabilitiesForMode,
  requireContract,
  type MultiModalCapabilityId,
  type TravelMode,
} from "./contracts";
import { MultiModalResolutionError, MultiModalValidationError } from "./errors";
import { MultiModalEventBus, eventNameForMode } from "./events";
import { MultiModalMetrics } from "./metrics";
import { normalizeTravelPayload } from "./normalization";
import { noopMultiModalTelemetry, travelLog, type MultiModalTelemetrySink } from "./telemetry";
import type { TravelProviderAdapter, TravelRequestInput } from "./providers/types";

export interface TravelConnectorRecord {
  readonly connectorId: string;
  readonly adapter: TravelProviderAdapter;
  readonly priority: number;
  readonly mode: TravelMode;
  readonly capabilities: readonly MultiModalCapabilityId[];
}

/** Registry of travel connectors and their capability index. */
export class TravelConnectorRegistry {
  private readonly records = new Map<string, TravelConnectorRecord>();
  private readonly byCapability = new Map<string, Set<string>>();

  add(record: TravelConnectorRecord): void {
    if (this.records.has(record.connectorId)) {
      throw new MultiModalValidationError(`connector already registered: ${record.connectorId}`);
    }
    this.records.set(record.connectorId, Object.freeze({ ...record }));
    for (const c of record.capabilities) {
      let set = this.byCapability.get(c);
      if (!set) {
        set = new Set();
        this.byCapability.set(c, set);
      }
      set.add(record.connectorId);
    }
  }
  get(id: string): TravelConnectorRecord | undefined {
    return this.records.get(id);
  }
  list(): readonly TravelConnectorRecord[] {
    return [...this.records.values()];
  }
  listForMode(mode: TravelMode): readonly TravelConnectorRecord[] {
    return this.list().filter((r) => r.mode === mode);
  }
  forCapability(capability: MultiModalCapabilityId): readonly TravelConnectorRecord[] {
    return [...(this.byCapability.get(capability) ?? [])]
      .map((id) => this.records.get(id)!)
      .sort((a, b) => b.priority - a.priority || a.connectorId.localeCompare(b.connectorId));
  }
  capabilities(): readonly MultiModalCapabilityId[] {
    return MULTIMODAL_CAPABILITY_IDS.filter((c) => (this.byCapability.get(c)?.size ?? 0) > 0);
  }
  clear(): void {
    this.records.clear();
    this.byCapability.clear();
  }
  size(): number {
    return this.records.size;
  }
}

/** Builds IPCF connector definitions from a travel provider adapter. */
export class TravelConnectorFactory {
  static category(mode: TravelMode): "flight" | "hotel" | "maps" | "weather" | "custom" {
    return mode === "flight" || mode === "hotel" || mode === "maps" || mode === "weather"
      ? mode
      : "custom";
  }

  static definition(adapter: TravelProviderAdapter) {
    const caps = adapter.profile.capabilities.map((id) => {
      const c = requireContract(id);
      return makeCapability({
        id: c.id,
        name: c.name,
        version: c.version,
        description: c.description,
        inputs: c.inputs,
        outputs: [c.output],
        metadata: { volatility: c.volatility, cacheable: c.cacheable, mode: c.mode },
      });
    });
    const contract = makeContract({
      id: `multimodal.contract.${adapter.profile.id}`,
      category: TravelConnectorFactory.category(adapter.profile.mode),
      capabilities: caps,
      authentication: ["anonymous", "api-key"],
      version: adapter.profile.version,
      metadata: { providerIndependent: true, mode: adapter.profile.mode },
    });
    const manifest = makeManifest({
      id: `multimodal.${adapter.profile.id}`,
      name: adapter.profile.name,
      category: TravelConnectorFactory.category(adapter.profile.mode),
      version: adapter.profile.version,
      contract,
      capabilities: caps,
      metadata: makeMetadata({
        tags: ["multimodal", adapter.profile.mode, adapter.profile.kind],
        labels: { suite: "multimodal", mode: adapter.profile.mode },
        owner: "multimodal-travel-platform",
        description: `Multi-modal ${adapter.profile.mode} connector for ${adapter.profile.name}`,
      }),
    });
    return makeDefinition({
      manifest,
      policy: makePolicy({
        rateLimit: makeRateLimit(1200, 60),
        retry: makeRetryPolicy({ maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 5, jitter: false }),
        concurrency: 256,
      }),
    });
  }

  static executor(
    adapter: TravelProviderAdapter,
    metrics: MultiModalMetrics,
    telemetry: MultiModalTelemetrySink,
  ): ConnectorExecutor {
    return async (ctx) => {
      const capability = ctx.request.capabilityId as MultiModalCapabilityId;
      const raw = await adapter.execute(
        capability,
        (ctx.request.payload ?? {}) as TravelRequestInput,
      );

      if (!raw.ok) {
        return {
          ok: false,
          error: raw.error ?? {
            code: "provider_error",
            message: "provider failed",
            retryable: false,
          },
        };
      }
      try {
        const data = normalizeTravelPayload(capability, raw.data);
        metrics.normalization(true);
        return { ok: true, data, pagination: raw.pagination };
      } catch (e) {
        metrics.normalization(false);
        travelLog(telemetry, "error", "multimodal.normalization.failed", (e as Error).message, {
          provider: adapter.profile.id,
          capability,
        });
        return {
          ok: false,
          error: {
            code: "multimodal_normalization_error",
            message: (e as Error).message,
            retryable: false,
          },
        };
      }
    };
  }
}

/** Chooses connectors for a capability, honouring preference and fallback. */
export class TravelConnectorResolver {
  constructor(private readonly registry: TravelConnectorRegistry) {}
  resolve(
    capability: MultiModalCapabilityId,
    preferProviderId?: string,
  ): readonly TravelConnectorRecord[] {
    const all = this.registry.forCapability(capability);
    if (all.length === 0) throw new MultiModalResolutionError(capability);
    if (!preferProviderId) return all;
    const preferred = all.filter((r) => r.adapter.profile.id === preferProviderId);
    const rest = all.filter((r) => r.adapter.profile.id !== preferProviderId);
    if (preferred.length === 0)
      throw new MultiModalResolutionError(`${capability} via ${preferProviderId}`);
    return [...preferred, ...rest];
  }
}

export interface TravelHealthEntry {
  readonly connectorId: string;
  readonly providerId: string;
  readonly mode: TravelMode;
  readonly functional: boolean;
  readonly healthy: boolean;
  readonly status: string;
  readonly reason?: string;
}
export interface TravelHealthReport {
  readonly healthy: boolean;
  readonly at: number;
  readonly integrationHealthy: boolean;
  readonly connectors: readonly TravelHealthEntry[];
  readonly capabilities: readonly MultiModalCapabilityId[];
}

/** Health checks across the platform (connector state delegated to IPCF). */
export class TravelConnectorHealth {
  constructor(
    private readonly registry: TravelConnectorRegistry,
    private readonly integration: IntegrationRuntime,
  ) {}
  async report(): Promise<TravelHealthReport> {
    const ipcf = await this.integration.health();
    const connectors: TravelHealthEntry[] = [];
    for (const r of this.registry.list()) {
      const probe = await r.adapter.probe();
      const c: Connector | undefined = this.integration.registry.get(r.connectorId);
      connectors.push(
        Object.freeze({
          connectorId: r.connectorId,
          providerId: r.adapter.profile.id,
          mode: r.mode,
          functional: r.adapter.profile.functional,
          healthy: probe.healthy,
          status: c?.status ?? "unknown",
          reason: probe.reason,
        }),
      );
    }
    return Object.freeze({
      healthy: ipcf.status !== "unhealthy" && connectors.some((c) => c.healthy),
      at: Date.now(),
      integrationHealthy: ipcf.status !== "unhealthy",
      connectors: Object.freeze(connectors),
      capabilities: this.registry.capabilities(),
    });
  }
}

export interface TravelInvokeOptions {
  readonly providerId?: string;
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly fallback?: boolean;
}

/** Lifecycle + invocation orchestration on top of IPCF. */
export class TravelConnectorManager {
  constructor(
    private readonly integration: IntegrationRuntime,
    private readonly registry: TravelConnectorRegistry,
    private readonly resolver: TravelConnectorResolver,
    private readonly metrics: MultiModalMetrics,
    private readonly telemetry: MultiModalTelemetrySink,
    private readonly events: MultiModalEventBus,
  ) {}

  async registerProvider(adapter: TravelProviderAdapter, priority = 0): Promise<string> {
    const definition = TravelConnectorFactory.definition(adapter);
    const connector = await this.integration.manager.register(definition);
    this.integration.manager.registerExecutor(
      connector.id,
      TravelConnectorFactory.executor(adapter, this.metrics, this.telemetry),
    );
    this.integration.manager.validate(connector.id);
    this.metrics.connectorRegistered();
    this.registry.add({
      connectorId: connector.id,
      adapter,
      priority,
      mode: adapter.profile.mode,
      capabilities: adapter.profile.capabilities,
    });
    this.integration.manager.enable(connector.id);
    if (adapter.profile.functional) this.metrics.connectorEnabled();
    else this.integration.manager.disable(connector.id);
    travelLog(this.telemetry, "info", "multimodal.connector.registered", "connector registered", {
      connectorId: connector.id,
      provider: adapter.profile.id,
      mode: adapter.profile.mode,
    });
    return connector.id;
  }

  async invoke<T = unknown>(
    capability: MultiModalCapabilityId,
    payload: TravelRequestInput = {},
    options: TravelInvokeOptions = {},
  ): Promise<ConnectorResponse<T>> {
    const contract = requireContract(capability);
    for (const field of contract.required) {
      const v = payload[field];
      if (v === undefined || v === null || v === "") {
        throw new MultiModalValidationError(`${capability}: '${field}' is required`);
      }
    }
    let candidates: readonly TravelConnectorRecord[];
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
      this.metrics.request(capability, record.adapter.profile.id, contract.mode);
      const started = Date.now();
      const request = makeRequest({
        connectorId: record.connectorId,
        capabilityId: capability,
        payload,
        correlationId: options.correlationId,
        causationId: options.causationId,
        metadata: { suite: "multimodal", mode: contract.mode, provider: record.adapter.profile.id },
      });
      let response: ConnectorResponse<T>;
      try {
        response = await this.integration.manager.invoke<T>(request);
      } catch (e) {
        this.metrics.response(
          capability,
          record.adapter.profile.id,
          contract.mode,
          false,
          Date.now() - started,
        );
        travelLog(this.telemetry, "error", "multimodal.invoke.threw", (e as Error).message, {
          capability,
          provider: record.adapter.profile.id,
        });
        continue;
      }
      this.metrics.response(
        capability,
        record.adapter.profile.id,
        contract.mode,
        response.ok,
        Date.now() - started,
      );
      travelLog(
        this.telemetry,
        response.ok ? "info" : "warn",
        "multimodal.invoke",
        "capability invoked",
        {
          capability,
          mode: contract.mode,
          provider: record.adapter.profile.id,
          ok: response.ok,
        },
      );
      if (response.ok) {
        this.events.publish({
          name: eventNameForMode(contract.mode),
          mode: contract.mode,
          correlationId: options.correlationId,
          causationId: options.causationId,
          data: { capability, provider: record.adapter.profile.id },
        });
        this.metrics.eventPublished();
        return response;
      }
      last = response;
    }
    if (last) return last;
    throw new MultiModalResolutionError(capability);
  }
}

/** Base class for every per-mode runtime (Flight, Hotel, Maps, ...). */
export class TravelModeRuntime {
  constructor(
    readonly mode: TravelMode,
    protected readonly manager: TravelConnectorManager,
    protected readonly registry: TravelConnectorRegistry,
    protected readonly resolver: TravelConnectorResolver,
    protected readonly health: TravelConnectorHealth,
    protected readonly metrics: MultiModalMetrics,
  ) {}

  capabilities(): readonly MultiModalCapabilityId[] {
    return capabilitiesForMode(this.mode);
  }
  availableCapabilities(): readonly MultiModalCapabilityId[] {
    return this.registry.capabilities().filter((c) => MULTIMODAL_CONTRACTS[c].mode === this.mode);
  }
  providers(): readonly string[] {
    return this.registry.listForMode(this.mode).map((r) => r.adapter.profile.id);
  }
  registerProvider(adapter: TravelProviderAdapter, priority = 0): Promise<string> {
    if (adapter.profile.mode !== this.mode) {
      throw new MultiModalValidationError(
        `provider ${adapter.profile.id} is not a ${this.mode} provider`,
      );
    }
    return this.manager.registerProvider(adapter, priority);
  }
  resolve(capability: MultiModalCapabilityId, providerId?: string) {
    return this.resolver.resolve(capability, providerId);
  }
  invoke<T = unknown>(
    capability: MultiModalCapabilityId,
    payload?: TravelRequestInput,
    options?: TravelInvokeOptions,
  ): Promise<ConnectorResponse<T>> {
    if (MULTIMODAL_CONTRACTS[capability]?.mode !== this.mode) {
      throw new MultiModalValidationError(`${capability} is not a ${this.mode} capability`);
    }
    return this.manager.invoke<T>(capability, payload, options);
  }
  metricsSnapshot() {
    return this.metrics.snapshot();
  }
  healthReport(): Promise<TravelHealthReport> {
    return this.health.report();
  }
}

export class FlightRuntime extends TravelModeRuntime {}
export class HotelRuntime extends TravelModeRuntime {}
export class MapsRuntime extends TravelModeRuntime {}
export class WeatherRuntime extends TravelModeRuntime {}
export class TransitRuntime extends TravelModeRuntime {}
export class CurrencyRuntime extends TravelModeRuntime {}
export class TimezoneRuntime extends TravelModeRuntime {}

export interface MultiModalRuntimeOptions {
  readonly integration?: IntegrationRuntime;
  readonly telemetry?: MultiModalTelemetrySink;
  readonly events?: MultiModalEventBus;
}

/** Public facade for the Multi-Modal Travel Intelligence Platform. */
export class MultiModalTravelRuntime {
  readonly integration: IntegrationRuntime;
  readonly registry = new TravelConnectorRegistry();
  readonly metrics = new MultiModalMetrics();
  readonly telemetry: MultiModalTelemetrySink;
  readonly events: MultiModalEventBus;
  readonly resolver: TravelConnectorResolver;
  readonly manager: TravelConnectorManager;
  readonly health: TravelConnectorHealth;

  readonly flights: FlightRuntime;
  readonly hotels: HotelRuntime;
  readonly maps: MapsRuntime;
  readonly weather: WeatherRuntime;
  readonly transit: TransitRuntime;
  readonly currency: CurrencyRuntime;
  readonly timezone: TimezoneRuntime;

  constructor(options: MultiModalRuntimeOptions = {}) {
    this.integration = options.integration ?? createIntegrationRuntime();
    this.telemetry = options.telemetry ?? noopMultiModalTelemetry;
    this.events = options.events ?? new MultiModalEventBus();
    this.resolver = new TravelConnectorResolver(this.registry);
    this.manager = new TravelConnectorManager(
      this.integration,
      this.registry,
      this.resolver,
      this.metrics,
      this.telemetry,
      this.events,
    );
    this.health = new TravelConnectorHealth(this.registry, this.integration);
    const args = [this.manager, this.registry, this.resolver, this.health, this.metrics] as const;
    this.flights = new FlightRuntime("flight", ...args);
    this.hotels = new HotelRuntime("hotel", ...args);
    this.maps = new MapsRuntime("maps", ...args);
    this.weather = new WeatherRuntime("weather", ...args);
    this.transit = new TransitRuntime("transit", ...args);
    this.currency = new CurrencyRuntime("currency", ...args);
    this.timezone = new TimezoneRuntime("timezone", ...args);
  }

  runtimeForMode(mode: TravelMode): TravelModeRuntime {
    switch (mode) {
      case "flight":
        return this.flights;
      case "hotel":
        return this.hotels;
      case "maps":
        return this.maps;
      case "weather":
        return this.weather;
      case "transit":
        return this.transit;
      case "currency":
        return this.currency;
      case "timezone":
        return this.timezone;
    }
  }

  registerProvider(adapter: TravelProviderAdapter, priority = 0): Promise<string> {
    return this.manager.registerProvider(adapter, priority);
  }

  invoke<T = unknown>(
    capability: MultiModalCapabilityId,
    payload?: TravelRequestInput,
    options?: TravelInvokeOptions,
  ): Promise<ConnectorResponse<T>> {
    return this.manager.invoke<T>(capability, payload, options);
  }

  /** Capability discovery surface (CTOR-facing). */
  discoverCapabilities() {
    return this.registry.capabilities().map((id) => ({
      ...MULTIMODAL_CONTRACTS[id],
      providers: this.registry.forCapability(id).map((r) => r.adapter.profile.id),
    }));
  }

  metricsSnapshot() {
    return this.metrics.snapshot();
  }
  healthReport(): Promise<TravelHealthReport> {
    return this.health.report();
  }
  shutdown(): void {
    this.registry.clear();
    this.metrics.reset();
    this.events.clear();
    this.integration.shutdown();
  }
}

export function createMultiModalTravelRuntime(
  options: MultiModalRuntimeOptions = {},
): MultiModalTravelRuntime {
  return new MultiModalTravelRuntime(options);
}
