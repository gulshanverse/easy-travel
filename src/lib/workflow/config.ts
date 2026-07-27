/** WAR — runtime configuration. */
export interface WorkflowRuntimeConfig {
  readonly maxDefinitions: number;
  readonly maxInstances: number;
  readonly maxHistoryPerInstance: number;
  readonly maxCheckpointsPerInstance: number;
  readonly checkpointEveryStep: boolean;
  readonly deadWorkflowAfterMs: number;
}

export const DEFAULT_WORKFLOW_RUNTIME_CONFIG: WorkflowRuntimeConfig = Object.freeze({
  maxDefinitions: 10_000,
  maxInstances: 100_000,
  maxHistoryPerInstance: 2_000,
  maxCheckpointsPerInstance: 200,
  checkpointEveryStep: true,
  deadWorkflowAfterMs: 24 * 60 * 60 * 1000,
});

export function mergeWorkflowRuntimeConfig(
  partial?: Partial<WorkflowRuntimeConfig>,
): WorkflowRuntimeConfig {
  return Object.freeze({ ...DEFAULT_WORKFLOW_RUNTIME_CONFIG, ...(partial ?? {}) });
}
