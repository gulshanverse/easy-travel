/**
 * Journey Context Engine.
 *
 * Orchestrates every subsystem via **ports** to assemble a unified,
 * immutable JourneyExecutionContext. The engine NEVER imports Memory,
 * Prompt, Graph, Provider, or Runtime internals — only the port shapes.
 */

import { JourneyContextError, JourneyPortError } from "./errors";
import type { JourneyConfiguration } from "./config";
import { newContextId, newCorrelationId } from "./ids";
import { ConstraintEngine } from "./constraint";
import { IntentEngine } from "./intent";
import type {
  Journey,
  JourneyExecutionContext,
  JourneyGraphView,
  JourneyMemoryItem,
  JourneyIntent,
} from "./types";
import type {
  JourneyGraphPort,
  JourneyKernelPort,
  JourneyMemoryPort,
  JourneyPromptPort,
  JourneyProviderPort,
} from "./ports";

export interface JourneyContextEngineOptions {
  readonly config: JourneyConfiguration;
  readonly memory: JourneyMemoryPort;
  readonly graph: JourneyGraphPort;
  readonly prompt: JourneyPromptPort;
  readonly provider: JourneyProviderPort;
  readonly kernel: JourneyKernelPort;
  readonly constraints?: ConstraintEngine;
  readonly intents?: IntentEngine;
}

export interface AssembleInput {
  readonly journey: Journey;
  readonly query?: string;
  readonly correlationId?: string;
}

export class JourneyContextEngine {
  private readonly constraints: ConstraintEngine;
  private readonly intents: IntentEngine;
  constructor(private readonly opts: JourneyContextEngineOptions) {
    this.constraints = opts.constraints ?? new ConstraintEngine();
    this.intents = opts.intents ?? new IntentEngine();
  }

  async assemble(input: AssembleInput): Promise<JourneyExecutionContext> {
    const started = Date.now();
    const correlationId = input.correlationId ?? newCorrelationId();
    const budget = this.opts.config.context;

    const memoryPromise = this.safeCall("memory", () =>
      withTimeout(
        this.opts.memory.retrieve({
          userId: input.journey.ownerId,
          namespace: this.opts.config.namespace,
          query: input.query,
          limit: budget.maxMemoryItems,
        }),
        budget.assemblyTimeoutMs,
      ),
    );
    const seedPromise = this.safeCall("graph", () =>
      withTimeout(this.opts.graph.seedForJourney(input.journey.id), budget.assemblyTimeoutMs),
    );

    const [memoryRaw, seeds] = await Promise.all([memoryPromise, seedPromise]);

    let truncated = false;
    let memory: readonly JourneyMemoryItem[] = memoryRaw ?? [];
    if (memory.length > budget.maxMemoryItems) {
      memory = memory.slice(0, budget.maxMemoryItems);
      truncated = true;
    }

    const graphView = await this.expandGraph(seeds ?? [], budget.maxGraphExpansions);
    if (graphView.expandedCount >= budget.maxGraphExpansions) truncated = true;

    const active = this.constraints.active(input.journey.constraints);
    const intent: JourneyIntent | null = this.intents.latest(input.journey);

    const ctx: JourneyExecutionContext = Object.freeze({
      id: newContextId(),
      journeyId: input.journey.id,
      ownerId: input.journey.ownerId,
      namespace: this.opts.config.namespace,
      correlationId,
      builtAt: new Date().toISOString(),
      journey: input.journey,
      memory,
      graph: graphView,
      intent,
      activeConstraints: Object.freeze([...active]),
      stats: Object.freeze({
        memoryItems: memory.length,
        graphExpansions: graphView.expandedCount,
        assemblyMs: Date.now() - started,
        truncated,
      }),
    });
    return ctx;
  }

  private async expandGraph(seeds: readonly string[], budget: number): Promise<JourneyGraphView> {
    if (seeds.length === 0)
      return Object.freeze({ rootNodeIds: [], neighborsById: Object.freeze({}), expandedCount: 0 });
    const neighborsById: Record<string, readonly string[]> = {};
    let expanded = 0;
    for (const seed of seeds) {
      if (expanded >= budget) break;
      const remaining = budget - expanded;
      const n = await this.safeCall("graph", () => this.opts.graph.neighbors(seed, remaining));
      const list = Object.freeze([...(n ?? [])]);
      neighborsById[seed] = list;
      expanded += list.length;
    }
    return Object.freeze({
      rootNodeIds: Object.freeze([...seeds]),
      neighborsById: Object.freeze(neighborsById),
      expandedCount: expanded,
    });
  }

  private async safeCall<T>(port: string, fn: () => Promise<T>): Promise<T> {
    try { return await fn(); }
    catch (err) {
      throw new JourneyPortError(port, err instanceof Error ? err.message : String(err), err);
    }
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new JourneyContextError(`port timeout after ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}
