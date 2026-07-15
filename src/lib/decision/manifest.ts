/**
 * Capability Manifest — describes the Travel Decision Intelligence Engine.
 * Consumed by TIOS-style capability catalogs and health/observability tools.
 */

export interface DecisionCapabilityManifest {
  readonly name: string;
  readonly version: string;
  readonly capabilities: readonly string[];
  readonly dependencies: readonly string[];
  readonly publicApis: readonly string[];
  readonly extensionPoints: readonly string[];
  readonly futureHooks: readonly string[];
}

export const DECISION_CAPABILITY_MANIFEST: DecisionCapabilityManifest = Object.freeze({
  name: "travel-decision-intelligence-engine",
  version: "1.0.0",
  capabilities: Object.freeze([
    "decision.lifecycle",
    "decision.option-generation",
    "decision.scoring.weighted",
    "decision.constraints.evaluation",
    "decision.ranking.stable",
    "decision.tradeoffs.pairwise",
    "decision.explanation.deterministic",
    "decision.snapshots",
    "decision.events",
    "decision.health",
  ] as const),
  dependencies: Object.freeze([
    "memory-engine (port)",
    "knowledge-graph-runtime (port)",
    "journey-intelligence-engine (port)",
    "prompt-runtime (port)",
    "provider-runtime (port)",
    "runtime-kernel (port)",
  ] as const),
  publicApis: Object.freeze([
    "DecisionRuntime",
    "DecisionManager",
    "DecisionRegistry",
    "DecisionFactory",
    "ScoringEngine",
    "RankingEngine",
    "TradeoffEngine",
    "ExplanationEngine",
    "ConstraintEngine",
    "OptionGenerator",
    "ContextAssembler",
  ] as const),
  extensionPoints: Object.freeze([
    "custom-scoring-dimension",
    "custom-constraint-predicate",
    "custom-tradeoff-pairs",
    "explanation-template",
    "evidence-source",
  ] as const),
  futureHooks: Object.freeze([
    "llm-augmented-explanation",
    "provider-driven-option-generation",
    "reinforcement-from-outcomes",
    "persistence-adapter",
    "cross-decision-comparison",
  ] as const),
});
