/**
 * DecisionRuntime — public facade for the Travel Decision Intelligence Engine.
 *
 * Composes registry, factory, context assembler, generator, scoring, ranking,
 * tradeoff, explanation and constraint engines. All external subsystems are
 * consumed via ports. Never imports Memory / Graph / Journey / Prompt /
 * Provider internals.
 */

import type { DecisionConfiguration } from "./config";
import { defineDecisionConfig } from "./config";
import { ConstraintEngine } from "./constraints";
import { ContextAssembler, type AssembleContextInput } from "./context-assembler";
import { DecisionEventBus } from "./events";
import { ExplanationEngine } from "./explanation";
import { DecisionFactory, type CreateDecisionInput } from "./factory";
import { OptionGenerator, type GenerationInput } from "./generator";
import { runDecisionHealth } from "./health";
import type { DecisionManager } from "./manager";
import type {
  DecisionGraphPort, DecisionJourneyPort, DecisionKernelPort, DecisionMemoryPort,
  DecisionPromptPort, DecisionProviderPort,
} from "./ports";
import {
  noopGraphPort, noopJourneyPort, noopKernelPort, noopMemoryPort,
  noopPromptPort, noopProviderPort,
} from "./ports";
import { RankingEngine } from "./ranking";
import { DecisionRegistry } from "./registry";
import { ScoringEngine } from "./scoring";
import {
  createInMemoryMetrics, createNoopTelemetry,
  type AggregatedHealth, type DecisionMetrics, type DecisionTelemetry,
} from "./telemetry";
import { TradeoffEngine } from "./tradeoff";
import type { Decision } from "./types";

export interface DecisionRuntimeOptions {
  readonly config: DecisionConfiguration;
  readonly memory?: DecisionMemoryPort;
  readonly graph?: DecisionGraphPort;
  readonly journey?: DecisionJourneyPort;
  readonly prompt?: DecisionPromptPort;
  readonly provider?: DecisionProviderPort;
  readonly kernel?: DecisionKernelPort;
  readonly bus?: DecisionEventBus;
  readonly metrics?: DecisionMetrics;
  readonly telemetry?: DecisionTelemetry;
}

export interface EvaluateInput {
  readonly decisionId: string;
  readonly generation: Omit<GenerationInput, "signals"> & { signals?: GenerationInput["signals"] };
  readonly topN?: number;
  readonly excludeHardViolations?: boolean;
}

export interface EvaluateResult {
  readonly decision: Decision;
  readonly assemblyMs: number;
}

export class DecisionRuntime {
  readonly config: DecisionConfiguration;
  readonly registry: DecisionRegistry;
  readonly factory: DecisionFactory;
  readonly bus: DecisionEventBus;
  readonly metrics: DecisionMetrics;
  readonly telemetry: DecisionTelemetry;
  readonly generator: OptionGenerator;
  readonly scoring: ScoringEngine;
  readonly constraints: ConstraintEngine;
  readonly ranking: RankingEngine;
  readonly tradeoffs: TradeoffEngine;
  readonly explanation: ExplanationEngine;
  readonly contextAssembler: ContextAssembler;

  private readonly memory: DecisionMemoryPort;
  private readonly graph: DecisionGraphPort;
  private readonly journey: DecisionJourneyPort;
  private readonly prompt: DecisionPromptPort;
  private readonly provider: DecisionProviderPort;
  // Reserved for future kernel-driven correlation IDs.
  private readonly _kernel: DecisionKernelPort;

  constructor(opts: DecisionRuntimeOptions) {
    this.config = opts.config;
    this.bus = opts.bus ?? new DecisionEventBus();
    this.metrics = opts.metrics ?? createInMemoryMetrics();
    this.telemetry = opts.telemetry ?? createNoopTelemetry();
    this.memory = opts.memory ?? noopMemoryPort;
    this.graph = opts.graph ?? noopGraphPort;
    this.journey = opts.journey ?? noopJourneyPort;
    this.prompt = opts.prompt ?? noopPromptPort;
    this.provider = opts.provider ?? noopProviderPort;
    this._kernel = opts.kernel ?? noopKernelPort;

    this.registry = new DecisionRegistry(opts.config.policies);
    this.factory = new DecisionFactory({
      config: opts.config, bus: this.bus, metrics: this.metrics, telemetry: this.telemetry,
    });
    this.generator = new OptionGenerator();
    this.scoring = new ScoringEngine();
    this.constraints = new ConstraintEngine();
    this.ranking = new RankingEngine();
    this.tradeoffs = new TradeoffEngine();
    this.explanation = new ExplanationEngine();
    this.contextAssembler = new ContextAssembler(this.config, this.memory, this.graph, this.journey);
  }

  // ---------- lifecycle ----------
  create(input: CreateDecisionInput): DecisionManager {
    const mgr = this.factory.create(input);
    this.registry.register(mgr);
    this.metrics.counter("decision.created", 1);
    return mgr;
  }

  adopt(decision: Decision): DecisionManager {
    const mgr = this.factory.fromDecision(decision);
    this.registry.register(mgr);
    return mgr;
  }

  get(id: string) { return this.registry.get(id); }
  require(id: string) { return this.registry.require(id); }

  delete(id: string): boolean {
    const mgr = this.registry.get(id);
    if (!mgr) return false;
    mgr.delete();
    this.metrics.counter("decision.deleted", 1);
    return this.registry.unregister(id);
  }

  // ---------- context ----------
  async assembleContext(input: AssembleContextInput) {
    const started = Date.now();
    const assembled = await this.contextAssembler.assemble(input);
    this.metrics.histogram("decision.context.assemble_ms", Date.now() - started);
    return assembled;
  }

  // ---------- evaluation pipeline ----------
  async evaluate(input: EvaluateInput): Promise<EvaluateResult> {
    const started = Date.now();
    const mgr = this.registry.require(input.decisionId);
    const span = this.telemetry.startSpan("decision.evaluate", { decisionId: mgr.id });
    try {
      // Collect context
      mgr.transition("collecting_context");
      this.bus.publish; // no-op reference to keep tree-shaking honest
      // Generate options
      mgr.transition("generating_options");
      const options = this.generator.generate({
        seeds: input.generation.seeds,
        signals: input.generation.signals,
        maxOptions: this.config.budget.maxOptionsPerGeneration,
      });
      mgr.attachOptions(options);

      // Evaluate (score)
      mgr.transition("evaluating");
      const scores = this.scoring.scoreMany(options, {
        weights: mgr.decision.context.weights,
        preferences: mgr.decision.context.preferences,
      });
      mgr.attachScores(scores);

      // Constraints
      mgr.transition("constraining");
      this.constraints.detectConflicts(mgr.decision.context.constraints);
      const evaluations = this.constraints.evaluateMany(options, mgr.decision.context.constraints);

      // Ranking
      mgr.transition("ranking");
      const ranked = this.ranking.rank({
        options, scores, evaluations,
        topN: input.topN,
        minConfidence: this.config.policies.minScoreConfidence,
        excludeHardViolations: input.excludeHardViolations ?? true,
      });
      mgr.attachRanking(ranked);

      // Tradeoffs
      const tradeoffs = this.tradeoffs.compute(options, scores);
      mgr.attachTradeoffs(tradeoffs);

      // Explanation
      mgr.transition("explaining");
      const explanation = this.explanation.explain({
        decision: mgr.decision, evaluations,
      });
      mgr.attachExplanation(explanation);

      // Validation
      mgr.transition("validating");
      // (validation already applied via manager updates)

      const elapsed = Date.now() - started;
      this.metrics.histogram("decision.evaluate_ms", elapsed);
      this.metrics.counter("decision.evaluated", 1);
      span.end({ ms: elapsed });
      return { decision: mgr.decision, assemblyMs: elapsed };
    } catch (e) {
      this.metrics.counter("decision.evaluate.failed", 1);
      try { mgr.fail((e as Error).message ?? "unknown"); } catch { /* already failed */ }
      span.end({ error: (e as Error).message });
      throw e;
    }
  }

  health(): Promise<AggregatedHealth> {
    return runDecisionHealth({
      registry: this.registry,
      memory: this.memory,
      graph: this.graph,
      journey: this.journey,
      prompt: this.prompt,
      provider: this.provider,
    });
  }
}

export function createDecisionRuntime(
  opts: DecisionRuntimeOptions | { namespace: string },
): DecisionRuntime {
  const config = "config" in opts
    ? opts.config
    : defineDecisionConfig({ namespace: (opts as { namespace: string }).namespace });
  return new DecisionRuntime({ ...("config" in opts ? opts : {}), config });
}
