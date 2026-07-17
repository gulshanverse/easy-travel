/**
 * Goal Intelligence & Planning Engine — GoalRuntime facade.
 * The ONLY sanctioned entry point outside this package.
 */
import type { AdaptiveTrigger } from "./adaptive";
import { mergeGoalConfig, type GoalConfig } from "./config";
import { GoalEventBus, type GoalEventListener } from "./events";
import { createGoalManager } from "./factory";
import type { MakeGoalInput } from "./factories";
import { collectGoalHealth, type GoalHealthDeps, type GoalHealthReport } from "./health";
import { GoalManager } from "./manager";
import { GoalMetrics, type GoalMetricsSnapshot } from "./metrics";
import type {
  GoalDecisionPort, GoalGraphPort, GoalJourneyPort, GoalKernelPort,
  GoalMemoryPort, GoalPromptPort, GoalProviderPort, GoalTrustPort,
} from "./ports";
import { GoalRegistry } from "./registry-runtime";
import type { ProgressInputs } from "./progress";
import { noopGoalTelemetry, type GoalTelemetrySink } from "./telemetry";
import type {
  Goal, GoalConflict, GoalHistoryEntry, GoalMilestone, GoalPlan, GoalProgress,
  GoalSnapshot, GoalState, GoalUnderstanding, MilestoneStatus,
} from "./types";

export interface GoalRuntimeOptions {
  readonly config?: Partial<GoalConfig>;
  readonly telemetry?: GoalTelemetrySink;
  readonly ports?: {
    readonly memory?: GoalMemoryPort;
    readonly journey?: GoalJourneyPort;
    readonly decision?: GoalDecisionPort;
    readonly trust?: GoalTrustPort;
    readonly graph?: GoalGraphPort;
    readonly prompt?: GoalPromptPort;
    readonly provider?: GoalProviderPort;
    readonly kernel?: GoalKernelPort;
  };
  readonly now?: () => number;
}

export class GoalRuntime {
  readonly events = new GoalEventBus();
  readonly metrics = new GoalMetrics();
  readonly registry = new GoalRegistry();
  readonly manager: GoalManager;
  readonly config: GoalConfig;
  private readonly telemetry: GoalTelemetrySink;
  private readonly portDeps: GoalHealthDeps;

  constructor(options: GoalRuntimeOptions = {}) {
    this.config = mergeGoalConfig(options.config);
    this.telemetry = options.telemetry ?? noopGoalTelemetry;
    this.portDeps = options.ports ?? {};
    this.manager = createGoalManager({
      config: this.config,
      telemetry: this.telemetry,
      events: this.events,
      metrics: this.metrics,
      now: options.now ?? (() => Date.now()),
    });
    this.registry.register("default", this.manager);
  }

  createGoal(input: MakeGoalInput): Goal { return this.manager.createGoal(input); }
  updateGoal(id: string, patch: Partial<Goal>): Goal { return this.manager.updateGoal(id, patch); }
  deleteGoal(id: string): void { this.manager.deleteGoal(id); }
  getGoal(id: string): Goal | undefined { return this.manager.goals.get(id); }
  listGoals(): readonly Goal[] { return this.manager.goals.list(); }
  goalsForOwner(ownerId: string): readonly Goal[] { return this.manager.goals.forOwner(ownerId); }

  transition(id: string, to: GoalState, note?: string): Goal { return this.manager.transition(id, to, note); }
  canTransition(id: string, to: GoalState): boolean { return this.manager.canTransition(id, to); }
  understand(id: string): GoalUnderstanding { return this.manager.understand(id); }

  planGoal(id: string): GoalPlan { return this.manager.planGoal(id); }
  currentPlan(id: string): GoalPlan | undefined { return this.manager.currentPlan(id); }
  replan(id: string, triggers: readonly AdaptiveTrigger[]): GoalPlan { return this.manager.replan(id, triggers); }
  maybeReplan(id: string, triggers: readonly AdaptiveTrigger[], threshold?: number): GoalPlan | undefined {
    return this.manager.maybeReplan(id, triggers, threshold);
  }
  updateMilestone(goalId: string, milestoneId: string, status: MilestoneStatus): GoalPlan {
    return this.manager.updateMilestone(goalId, milestoneId, status);
  }
  orderedMilestones(goalId: string): readonly GoalMilestone[] { return this.manager.orderedMilestones(goalId); }
  nextActionableMilestone(goalId: string): GoalMilestone | undefined { return this.manager.nextActionableMilestone(goalId); }

  progressFor(id: string, extra?: Partial<ProgressInputs>): GoalProgress { return this.manager.progressFor(id, extra); }

  prioritise(): readonly Goal[] { return this.manager.prioritise(); }
  conflicts(): readonly GoalConflict[] { return this.manager.conflicts(); }
  mergeGoals(a: string, b: string): Goal { return this.manager.mergeGoals(a, b); }
  splitGoal(id: string, parts: readonly { title: string; description?: string }[]): readonly Goal[] {
    return this.manager.splitGoal(id, parts);
  }

  historyFor(id: string): readonly GoalHistoryEntry[] { return this.manager.history.for(id); }
  snapshot(): GoalSnapshot { return this.manager.snapshot(); }

  metricsSnapshot(): GoalMetricsSnapshot { return this.metrics.snapshot(); }
  onEvent(listener: GoalEventListener): () => void { return this.events.on(listener); }
  health(): Promise<GoalHealthReport> { return collectGoalHealth(this.manager, this.portDeps); }
}

export function createGoalRuntime(options: GoalRuntimeOptions = {}): GoalRuntime {
  return new GoalRuntime(options);
}
