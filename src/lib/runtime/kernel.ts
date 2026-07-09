/**
 * Runtime Core — Kernel.
 *
 * Composes the container, service registry, event bus, capability runtime,
 * context builder, config, health, and telemetry into a single object that
 * consumers can construct once at startup. This is the ONLY sanctioned way
 * to wire runtime services together.
 */

import { CapabilityRuntime, type CapabilityRuntimeEvents } from "./capability-runtime";
import type { RuntimeConfiguration, RuntimeConfigurationOverride } from "./config";
import { loadRuntimeConfiguration } from "./config";
import { Container, createToken, type Token } from "./container";
import type { ExecutionContext, ExecutionContextInit } from "./context";
import { ContextBuilder, type ContextBuildRequest, type ContextBuilderPorts } from "./context-builder";
import { EventBus, InMemoryDeadLetterQueue } from "./event-bus";
import { RuntimeHealthChecks } from "./health";
import { InMemoryMetrics, type RuntimeMetrics } from "./metrics";
import { ServiceRegistry } from "./service-registry";
import { NoopTelemetry, type RuntimeTelemetry } from "./telemetry";

export const TOKENS = {
  Config: createToken<RuntimeConfiguration>("RuntimeConfiguration"),
  EventBus: createToken<EventBus>("EventBus"),
  Metrics: createToken<RuntimeMetrics>("RuntimeMetrics"),
  Telemetry: createToken<RuntimeTelemetry>("RuntimeTelemetry"),
  ServiceRegistry: createToken<ServiceRegistry>("ServiceRegistry"),
  CapabilityRuntime: createToken<CapabilityRuntime>("CapabilityRuntime"),
  ContextBuilder: createToken<ContextBuilder>("ContextBuilder"),
} as const;

export interface RuntimeKernelOptions {
  config?: RuntimeConfigurationOverride;
  telemetry?: RuntimeTelemetry;
  metrics?: RuntimeMetrics;
  ports?: ContextBuilderPorts;
}

export class RuntimeKernel {
  readonly config: RuntimeConfiguration;
  readonly container: Container;
  readonly telemetry: RuntimeTelemetry;
  readonly metrics: RuntimeMetrics;
  readonly eventBus: EventBus;
  readonly registry: ServiceRegistry;
  readonly capabilities: CapabilityRuntime;
  readonly contextBuilder: ContextBuilder;
  readonly health: RuntimeHealthChecks;
  readonly deadLetterQueue: InMemoryDeadLetterQueue;

  constructor(opts: RuntimeKernelOptions = {}) {
    this.config = loadRuntimeConfiguration(opts.config);
    this.telemetry = opts.telemetry ?? new NoopTelemetry();
    this.metrics = opts.metrics ?? new InMemoryMetrics();
    this.deadLetterQueue = new InMemoryDeadLetterQueue();
    this.eventBus = new EventBus({
      replayBufferSize: this.config.policies.maxReplayBufferSize,
      maxHandlersPerEvent: this.config.policies.maxHandlersPerEvent,
      defaultRetry: {
        maxAttempts: this.config.policies.maxEventRetries || 1,
        backoffMs: this.config.policies.eventRetryBackoffMs,
      },
      deadLetterQueue: this.deadLetterQueue,
      metrics: this.metrics,
      telemetry: this.telemetry,
    });
    this.registry = new ServiceRegistry();
    this.capabilities = new CapabilityRuntime({
      eventBus: this.eventBus,
      metrics: this.metrics,
      telemetry: this.telemetry,
      config: this.config,
    });
    this.contextBuilder = new ContextBuilder(opts.ports);
    this.health = new RuntimeHealthChecks(
      this.registry,
      this.capabilities,
      this.eventBus,
      this.metrics,
    );

    this.container = new Container();
    this.container.registerInstance(TOKENS.Config, this.config);
    this.container.registerInstance(TOKENS.Telemetry, this.telemetry);
    this.container.registerInstance(TOKENS.Metrics, this.metrics);
    this.container.registerInstance(TOKENS.EventBus, this.eventBus);
    this.container.registerInstance(TOKENS.ServiceRegistry, this.registry);
    this.container.registerInstance(TOKENS.CapabilityRuntime, this.capabilities);
    this.container.registerInstance(TOKENS.ContextBuilder, this.contextBuilder);

    // Publish self-registration for discovery.
    this.registry.register("runtime.event_bus", this.eventBus, {
      version: "1.0.0", kind: "infrastructure",
    });
    this.registry.register("runtime.context_builder", this.contextBuilder, {
      version: "1.0.0", kind: "infrastructure",
    });
    this.registry.register("runtime.capability_runtime", this.capabilities, {
      version: "1.0.0", kind: "infrastructure",
    });
  }

  buildContext(request?: ContextBuildRequest): Promise<ExecutionContext> {
    return this.contextBuilder.build(request);
  }

  buildContextInit(init?: ExecutionContextInit): Promise<ExecutionContext> {
    return this.contextBuilder.build(init);
  }

  resolve<T>(token: Token<T>): T { return this.container.resolveSync(token); }
}
