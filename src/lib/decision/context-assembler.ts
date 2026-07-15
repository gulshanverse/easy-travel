/**
 * Decision Context Assembler.
 * Gathers memory, graph and journey signals via ports (no direct imports of
 * other subsystem internals) and produces a `DecisionContext`.
 */

import type { DecisionConfiguration } from "./config";
import { DecisionPortError } from "./errors";
import { createContext } from "./factories";
import { newCorrelationId } from "./ids";
import type {
  DecisionGraphPort, DecisionJourneyPort, DecisionMemoryPort,
} from "./ports";
import type { DecisionConstraint, DecisionContext, ScoreWeights } from "./types";

export interface AssembleContextInput {
  readonly ownerId: string;
  readonly journeyId?: string;
  readonly query?: string;
  readonly weights?: ScoreWeights;
  readonly seedConstraints?: readonly DecisionConstraint[];
  readonly seedPreferences?: Record<string, number>;
  readonly correlationId?: string;
}

export interface AssembledContext {
  readonly context: DecisionContext;
  readonly journeySignals: Awaited<ReturnType<DecisionJourneyPort["fetchJourneySignals"]>>;
  readonly memoryRefs: readonly string[];
  readonly graphSeeds: readonly string[];
}

export class ContextAssembler {
  constructor(
    private readonly config: DecisionConfiguration,
    private readonly memory: DecisionMemoryPort,
    private readonly graph: DecisionGraphPort,
    private readonly journey: DecisionJourneyPort,
  ) {}

  async assemble(input: AssembleContextInput): Promise<AssembledContext> {
    const journeySignals = input.journeyId
      ? await this.safe("journey.fetchJourneySignals", () => this.journey.fetchJourneySignals(input.journeyId!))
      : null;

    const memoryItems = await this.safe("memory.retrieve", () =>
      this.memory.retrieve({
        ownerId: input.ownerId,
        namespace: this.config.namespace,
        query: input.query,
        limit: this.config.budget.maxOptionsPerGeneration,
      }));
    const memoryRefs = Object.freeze(memoryItems.map((m) => m.id));

    const graphSeeds = input.journeyId
      ? await this.safe("graph.seedForDecision", () =>
          this.graph.seedForDecision("pending", input.journeyId))
      : Object.freeze([] as readonly string[]);

    // Merge preferences from journey signals with seed preferences.
    const preferences: Record<string, number> = { ...(input.seedPreferences ?? {}) };
    if (journeySignals?.preferenceKeys) {
      for (const k of journeySignals.preferenceKeys) {
        if (preferences[k] === undefined) preferences[k] = 0.5;
      }
    }

    const context = createContext({
      ownerId: input.ownerId,
      namespace: this.config.namespace,
      correlationId: input.correlationId ?? newCorrelationId(),
      weights: input.weights ?? this.config.weights,
      journeyId: input.journeyId,
      constraints: input.seedConstraints,
      preferences,
      memoryRefs,
      graphSeedNodeIds: graphSeeds,
      metadata: journeySignals ? { journeySignals } : undefined,
    });

    return { context, journeySignals, memoryRefs, graphSeeds };
  }

  private async safe<T>(port: string, fn: () => Promise<T>): Promise<T> {
    try { return await fn(); } catch (e) {
      throw new DecisionPortError(port, (e as Error).message ?? "port failed", e);
    }
  }
}
