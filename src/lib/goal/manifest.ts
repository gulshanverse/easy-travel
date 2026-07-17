/**
 * Goal Engine — machine-readable Engine Contract & Capability Manifest.
 */
export interface EngineContract {
  readonly engine: string;
  readonly version: string;
  readonly ownership: readonly string[];
  readonly responsibilities: readonly string[];
  readonly dependencies: readonly string[];
  readonly consumedEvents: readonly string[];
  readonly publishedEvents: readonly string[];
  readonly publicApis: readonly string[];
  readonly extensionPoints: readonly string[];
  readonly futureHooks: readonly string[];
  readonly integrationContracts: Readonly<Record<string, string>>;
}

export const GOAL_ENGINE_CONTRACT: EngineContract = Object.freeze({
  engine: "goal",
  version: "1.0.0",
  ownership: Object.freeze([
    "goal.understanding", "goal.planning", "goal.lifecycle",
    "goal.milestones", "goal.progress", "goal.adaptive", "goal.reasoning",
  ]),
  responsibilities: Object.freeze([
    "Classify, plan, orchestrate, track and adapt goals deterministically.",
  ]),
  dependencies: Object.freeze([
    "runtime.kernel", "memory.port", "journey.port", "decision.port",
    "trust.port", "graph.port", "prompt.port", "provider.port",
  ]),
  consumedEvents: Object.freeze([
    "TrustCalculated", "DecisionMade", "JourneyProgressed", "MemoryStored",
  ]),
  publishedEvents: Object.freeze([
    "GoalCreated", "GoalUpdated", "GoalDeleted", "GoalStarted", "GoalPaused",
    "GoalBlocked", "GoalResumed", "GoalCompleted", "GoalCancelled", "GoalArchived",
    "GoalTransitioned", "MilestoneCreated", "MilestoneCompleted", "MilestoneBlocked",
    "StepCompleted", "PlanCreated", "PlanRevised", "GoalReplanned",
    "ProgressUpdated", "GoalConflictDetected", "GoalMerged", "GoalSplit",
  ]),
  publicApis: Object.freeze([
    "GoalRuntime.createGoal", "GoalRuntime.updateGoal", "GoalRuntime.deleteGoal",
    "GoalRuntime.transition", "GoalRuntime.planGoal", "GoalRuntime.replan",
    "GoalRuntime.updateMilestone", "GoalRuntime.progressFor",
    "GoalRuntime.understand", "GoalRuntime.prioritise", "GoalRuntime.conflicts",
    "GoalRuntime.mergeGoals", "GoalRuntime.splitGoal", "GoalRuntime.snapshot",
  ]),
  extensionPoints: Object.freeze([
    "goal.policy.custom", "goal.telemetry.sink", "goal.event.listener",
    "goal.planning.template", "goal.progress.model",
  ]),
  futureHooks: Object.freeze([
    "goal.persistence.adapter", "goal.recommendation.hook",
    "goal.llm.assist", "goal.federated.sync",
  ]),
  integrationContracts: Object.freeze({
    memory: "GoalMemoryPort",
    journey: "GoalJourneyPort",
    decision: "GoalDecisionPort",
    trust: "GoalTrustPort",
    graph: "GoalGraphPort",
    prompt: "GoalPromptPort",
    provider: "GoalProviderPort",
    kernel: "GoalKernelPort",
  }),
});

export interface GoalCapabilityManifest {
  readonly id: "goal";
  readonly version: string;
  readonly capabilities: readonly string[];
  readonly planningFeatures: readonly string[];
  readonly lifecycleFeatures: readonly string[];
  readonly metrics: readonly string[];
  readonly dependencies: readonly string[];
  readonly extensionPoints: readonly string[];
  readonly futureHooks: readonly string[];
}

export const GOAL_CAPABILITY_MANIFEST: GoalCapabilityManifest = Object.freeze({
  id: "goal",
  version: "1.0.0",
  capabilities: Object.freeze([
    "goal.crud", "goal.understanding", "goal.classification",
    "goal.planning", "goal.milestones", "goal.progress",
    "goal.adaptive.replanning", "goal.conflict.detection",
    "goal.merge", "goal.split", "goal.dependency.graph",
    "goal.priority.resolution", "goal.snapshot", "goal.history",
  ]),
  planningFeatures: Object.freeze([
    "deterministic.decomposition", "milestone.dependency.ordering",
    "step.gates", "timeline.windows", "budget.targets", "revision.rationale",
  ]),
  lifecycleFeatures: Object.freeze([
    "state.machine", "rollback", "history", "transitions.validated",
  ]),
  metrics: Object.freeze([
    "goal.created", "goal.updated", "goal.deleted",
    "goal.plan.created", "goal.plan.revised",
    "goal.milestone.done", "goal.milestone.blocked",
    "goal.progress.percent", "goal.state.*",
  ]),
  dependencies: Object.freeze([
    "runtime.kernel", "memory.port", "journey.port", "decision.port",
    "trust.port", "graph.port", "prompt.port", "provider.port",
  ]),
  extensionPoints: Object.freeze([
    "goal.policy.custom", "goal.telemetry.sink", "goal.event.listener",
    "goal.planning.template", "goal.progress.model",
  ]),
  futureHooks: Object.freeze([
    "goal.persistence.adapter", "goal.recommendation.hook",
    "goal.llm.assist", "goal.federated.sync",
  ]),
});
