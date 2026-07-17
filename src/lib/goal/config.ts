/**
 * Goal Engine — configuration & defaults.
 */
export interface GoalConfig {
  readonly maxGoalsPerOwner: number;
  readonly maxMilestonesPerPlan: number;
  readonly maxStepsPerMilestone: number;
  readonly maxHistoryPerGoal: number;
  readonly maxDependencyDepth: number;
  readonly defaultPlanTimeoutMs: number;
  readonly progress: {
    readonly milestoneWeight: number;
    readonly stepWeight: number;
    readonly budgetWeight: number;
    readonly timelineWeight: number;
  };
  readonly priorityWeights: Readonly<Record<string, number>>;
  readonly complexity: {
    readonly milestonesPer: Readonly<Record<string, number>>;
    readonly stepsPerMilestone: Readonly<Record<string, number>>;
  };
}

export const DEFAULT_GOAL_CONFIG: GoalConfig = Object.freeze({
  maxGoalsPerOwner: 1024,
  maxMilestonesPerPlan: 64,
  maxStepsPerMilestone: 32,
  maxHistoryPerGoal: 256,
  maxDependencyDepth: 16,
  defaultPlanTimeoutMs: 1000 * 60 * 60 * 24 * 30,
  progress: Object.freeze({
    milestoneWeight: 0.5,
    stepWeight: 0.3,
    budgetWeight: 0.1,
    timelineWeight: 0.1,
  }),
  priorityWeights: Object.freeze({ low: 0.25, normal: 0.5, high: 0.75, critical: 1 }),
  complexity: Object.freeze({
    milestonesPer: Object.freeze({ trivial: 1, simple: 2, moderate: 4, complex: 6, epic: 10 }),
    stepsPerMilestone: Object.freeze({ trivial: 1, simple: 2, moderate: 3, complex: 4, epic: 5 }),
  }),
});

export function mergeGoalConfig(partial?: Partial<GoalConfig>): GoalConfig {
  if (!partial) return DEFAULT_GOAL_CONFIG;
  return {
    ...DEFAULT_GOAL_CONFIG,
    ...partial,
    progress: { ...DEFAULT_GOAL_CONFIG.progress, ...(partial.progress ?? {}) },
    priorityWeights: { ...DEFAULT_GOAL_CONFIG.priorityWeights, ...(partial.priorityWeights ?? {}) },
    complexity: {
      milestonesPer: { ...DEFAULT_GOAL_CONFIG.complexity.milestonesPer, ...(partial.complexity?.milestonesPer ?? {}) },
      stepsPerMilestone: { ...DEFAULT_GOAL_CONFIG.complexity.stepsPerMilestone, ...(partial.complexity?.stepsPerMilestone ?? {}) },
    },
  };
}
