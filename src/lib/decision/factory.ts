/**
 * DecisionFactory — constructs new DecisionManagers from partial input.
 */

import type { DecisionConfiguration } from "./config";
import type { DecisionEventBus } from "./events";
import { createContext } from "./factories";
import { newCorrelationId, newDecisionId } from "./ids";
import { DecisionManager } from "./manager";
import type { DecisionMetrics, DecisionTelemetry } from "./telemetry";
import type {
  Decision, DecisionConstraint, DecisionMetadata, ScoreWeights,
} from "./types";

export interface DecisionFactoryOptions {
  readonly config: DecisionConfiguration;
  readonly bus: DecisionEventBus;
  readonly metrics: DecisionMetrics;
  readonly telemetry: DecisionTelemetry;
}

export interface CreateDecisionInput {
  readonly ownerId: string;
  readonly title: string;
  readonly summary?: string;
  readonly journeyId?: string;
  readonly weights?: ScoreWeights;
  readonly constraints?: readonly DecisionConstraint[];
  readonly preferences?: Record<string, number>;
  readonly memoryRefs?: readonly string[];
  readonly graphSeedNodeIds?: readonly string[];
  readonly metadata?: Partial<DecisionMetadata>;
  readonly correlationId?: string;
}

export class DecisionFactory {
  constructor(private readonly opts: DecisionFactoryOptions) {}

  create(input: CreateDecisionInput): DecisionManager {
    const now = new Date().toISOString();
    const ctx = createContext({
      ownerId: input.ownerId,
      namespace: this.opts.config.namespace,
      correlationId: input.correlationId ?? newCorrelationId(),
      weights: input.weights ?? this.opts.config.weights,
      journeyId: input.journeyId,
      constraints: input.constraints,
      preferences: input.preferences,
      memoryRefs: input.memoryRefs,
      graphSeedNodeIds: input.graphSeedNodeIds,
    });
    const decision: Decision = Object.freeze({
      id: newDecisionId(),
      ownerId: input.ownerId,
      namespace: this.opts.config.namespace,
      title: input.title,
      summary: input.summary,
      state: "created",
      version: 1,
      createdAt: now,
      updatedAt: now,
      journeyId: input.journeyId,
      context: ctx,
      options: Object.freeze([]),
      scores: Object.freeze([]),
      ranked: Object.freeze([]),
      tradeoffs: Object.freeze([]),
      metadata: Object.freeze({
        tags: Object.freeze([...(input.metadata?.tags ?? [])]),
        attributes: Object.freeze({ ...(input.metadata?.attributes ?? {}) }),
      }),
    });
    return new DecisionManager(decision, { config: this.opts.config, bus: this.opts.bus });
  }

  fromDecision(decision: Decision): DecisionManager {
    return new DecisionManager(decision, { config: this.opts.config, bus: this.opts.bus });
  }
}
