/**
 * JourneyRuntime — the public facade for the Journey Intelligence Engine.
 *
 * Composes registry, factory, context engine, intent engine, constraint
 * engine, and timeline engine into a single entry point. All external
 * subsystems are consumed via ports.
 */

import type { JourneyConfiguration } from "./config";
import { defineJourneyConfig } from "./config";
import { ConstraintEngine } from "./constraint";
import { JourneyContextEngine } from "./context";
import { JourneyEventBus } from "./events";
import { JourneyFactory } from "./factory";
import { runJourneyHealth } from "./health";
import { IntentEngine } from "./intent";
import type { JourneyManager } from "./manager";
import type {
  JourneyGraphPort,
  JourneyKernelPort,
  JourneyMemoryPort,
  JourneyPromptPort,
  JourneyProviderPort,
} from "./ports";
import {
  noopGraphPort,
  noopKernelPort,
  noopMemoryPort,
  noopPromptPort,
  noopProviderPort,
} from "./ports";
import { JourneyRegistry } from "./registry";
import {
  createInMemoryMetrics,
  createNoopTelemetry,
  type AggregatedHealth,
  type JourneyMetrics,
  type JourneyTelemetry,
} from "./telemetry";
import { TimelineEngine } from "./timeline";
import type { Journey, JourneyExecutionContext } from "./types";

export interface JourneyRuntimeOptions {
  readonly config: JourneyConfiguration;
  readonly memory?: JourneyMemoryPort;
  readonly graph?: JourneyGraphPort;
  readonly prompt?: JourneyPromptPort;
  readonly provider?: JourneyProviderPort;
  readonly kernel?: JourneyKernelPort;
  readonly bus?: JourneyEventBus;
  readonly metrics?: JourneyMetrics;
  readonly telemetry?: JourneyTelemetry;
}

export class JourneyRuntime {
  readonly config: JourneyConfiguration;
  readonly registry: JourneyRegistry;
  readonly factory: JourneyFactory;
  readonly bus: JourneyEventBus;
  readonly metrics: JourneyMetrics;
  readonly telemetry: JourneyTelemetry;
  readonly intents: IntentEngine;
  readonly constraints: ConstraintEngine;
  readonly timelines: TimelineEngine;
  readonly context: JourneyContextEngine;

  private readonly memory: JourneyMemoryPort;
  private readonly graph: JourneyGraphPort;
  private readonly prompt: JourneyPromptPort;
  private readonly provider: JourneyProviderPort;
  private readonly kernel: JourneyKernelPort;

  constructor(opts: JourneyRuntimeOptions) {
    this.config = opts.config;
    this.bus = opts.bus ?? new JourneyEventBus();
    this.metrics = opts.metrics ?? createInMemoryMetrics();
    this.telemetry = opts.telemetry ?? createNoopTelemetry();
    this.memory = opts.memory ?? noopMemoryPort;
    this.graph = opts.graph ?? noopGraphPort;
    this.prompt = opts.prompt ?? noopPromptPort;
    this.provider = opts.provider ?? noopProviderPort;
    this.kernel = opts.kernel ?? noopKernelPort;

    this.registry = new JourneyRegistry(opts.config.policies);
    this.factory = new JourneyFactory({
      config: opts.config,
      bus: this.bus,
      metrics: this.metrics,
      telemetry: this.telemetry,
    });
    this.intents = new IntentEngine();
    this.constraints = new ConstraintEngine();
    this.timelines = new TimelineEngine();
    this.context = new JourneyContextEngine({
      config: opts.config,
      memory: this.memory,
      graph: this.graph,
      prompt: this.prompt,
      provider: this.provider,
      kernel: this.kernel,
      constraints: this.constraints,
      intents: this.intents,
    });
  }

  // ---------- Lifecycle ----------
  create(input: Parameters<JourneyFactory["create"]>[0]): JourneyManager {
    const mgr = this.factory.create(input);
    this.registry.register(mgr);
    this.metrics.counter("journey.created", 1);
    return mgr;
  }

  adopt(journey: Journey): JourneyManager {
    const mgr = this.factory.fromJourney(journey);
    this.registry.register(mgr);
    return mgr;
  }

  get(id: string): JourneyManager | undefined { return this.registry.get(id); }
  require(id: string) { return this.registry.require(id); }

  delete(id: string): boolean {
    const mgr = this.registry.get(id);
    if (!mgr) return false;
    mgr.delete();
    this.metrics.counter("journey.deleted", 1);
    return this.registry.unregister(id);
  }

  // ---------- Orchestration ----------
  async assembleContext(journeyId: string, query?: string): Promise<JourneyExecutionContext> {
    const mgr = this.registry.require(journeyId);
    const started = Date.now();
    const ctx = await this.context.assemble({ journey: mgr.journey, query });
    this.metrics.histogram("journey.context.assemble_ms", Date.now() - started);
    mgr.markContextUpdated(ctx.id);
    return ctx;
  }

  health(): Promise<AggregatedHealth> {
    return runJourneyHealth({
      registry: this.registry,
      memory: this.memory,
      graph: this.graph,
      prompt: this.prompt,
      provider: this.provider,
    });
  }
}

export function createJourneyRuntime(
  opts: JourneyRuntimeOptions | { namespace: string },
): JourneyRuntime {
  const config = "config" in opts
    ? opts.config
    : defineJourneyConfig({ namespace: (opts as { namespace: string }).namespace });
  return new JourneyRuntime({ ...("config" in opts ? opts : {}), config });
}
