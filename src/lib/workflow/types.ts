/** WAR — immutable domain model. */

export type WorkflowLifecycleState =
  | "draft" | "registered" | "scheduled" | "running" | "waiting" | "paused"
  | "retrying" | "compensating" | "completed" | "cancelled" | "failed" | "archived";

export type WorkflowStepStatus =
  | "pending" | "running" | "waiting" | "succeeded" | "failed" | "skipped" | "compensated";

export type WorkflowStepKind = "capability" | "connector" | "agent" | "timer" | "signal" | "noop";

export interface WorkflowRetryPolicy {
  readonly maxAttempts: number;
  readonly initialDelayMs: number;
  readonly multiplier: number;
  readonly maxDelayMs: number;
}

export interface WorkflowTimeout { readonly ms: number }

export interface WorkflowCompensation {
  readonly capabilityId: string;
  readonly input?: Readonly<Record<string, unknown>>;
}

export interface WorkflowContext {
  readonly instanceId: string;
  readonly definitionId: string;
  readonly correlationId: string;
  readonly attempt: number;
  readonly now: number;
  readonly variables: WorkflowVariables;
  readonly outputs: Readonly<Record<string, unknown>>;
}

export interface WorkflowStep {
  readonly id: string;
  readonly name: string;
  readonly kind: WorkflowStepKind;
  readonly dependsOn: readonly string[];
  readonly capabilityId?: string;
  readonly connectorId?: string;
  readonly input?: Readonly<Record<string, unknown>>;
  readonly signalName?: string;
  readonly delayMs?: number;
  readonly timeoutMs?: number;
  readonly required?: boolean;
  readonly retry?: Partial<WorkflowRetryPolicy>;
  readonly compensation?: WorkflowCompensation;
  readonly when?: (ctx: WorkflowContext) => boolean;
}

export type WorkflowTriggerKind = "manual" | "event" | "signal" | "schedule";
export interface WorkflowTrigger {
  readonly kind: WorkflowTriggerKind;
  readonly name?: string;
  readonly cron?: string;
  readonly delayMs?: number;
  readonly intervalMs?: number;
}

export interface WorkflowPolicy {
  readonly maxConcurrentInstances: number;
  readonly maxStepConcurrency: number;
  readonly executionBudgetMs: number;
  readonly defaultTimeoutMs: number;
  readonly retry: WorkflowRetryPolicy;
  readonly priority: number;
  readonly rateLimitPerMinute: number;
  readonly cancellable: boolean;
  readonly permissions: readonly string[];
}

export type WorkflowMetadata = Readonly<Record<string, string>>;
export type WorkflowVariables = Readonly<Record<string, unknown>>;

export interface WorkflowDefinition {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description?: string;
  readonly steps: readonly WorkflowStep[];
  readonly triggers: readonly WorkflowTrigger[];
  readonly policy: WorkflowPolicy;
  readonly metadata: WorkflowMetadata;
  readonly createdAt: number;
}

export interface WorkflowState {
  readonly status: WorkflowLifecycleState;
  readonly steps: Readonly<Record<string, WorkflowStepStatus>>;
  readonly outputs: Readonly<Record<string, unknown>>;
}

export interface WorkflowTransition {
  readonly from: WorkflowLifecycleState;
  readonly to: WorkflowLifecycleState;
  readonly at: number;
  readonly reason?: string;
}

export type WorkflowHistoryKind =
  | "created" | "scheduled" | "started" | "step-started" | "step-succeeded"
  | "step-failed" | "step-skipped" | "step-waiting" | "step-retried"
  | "signal" | "timer" | "checkpoint" | "paused" | "resumed"
  | "compensation-started" | "compensation-step" | "compensation-completed"
  | "completed" | "cancelled" | "failed" | "timeout" | "archived";

export interface WorkflowHistoryRecord {
  readonly seq: number;
  readonly at: number;
  readonly kind: WorkflowHistoryKind;
  readonly stepId?: string;
  readonly data?: Readonly<Record<string, unknown>>;
}

export interface WorkflowCheckpoint {
  readonly id: string;
  readonly instanceId: string;
  readonly seq: number;
  readonly at: number;
  readonly state: WorkflowState;
  readonly variables: WorkflowVariables;
}

export interface WorkflowSnapshot {
  readonly instanceId: string;
  readonly definitionId: string;
  readonly at: number;
  readonly state: WorkflowState;
  readonly variables: WorkflowVariables;
  readonly history: readonly WorkflowHistoryRecord[];
}

export interface WorkflowWait {
  readonly stepId: string;
  readonly kind: "timer" | "signal";
  readonly signalName?: string;
  readonly dueAt?: number;
}

export interface WorkflowInstance {
  readonly id: string;
  readonly definitionId: string;
  readonly correlationId: string;
  readonly state: WorkflowState;
  readonly variables: WorkflowVariables;
  readonly transitions: readonly WorkflowTransition[];
  readonly history: readonly WorkflowHistoryRecord[];
  readonly checkpoints: readonly WorkflowCheckpoint[];
  readonly waitingOn?: WorkflowWait;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly startedAt?: number;
  readonly endedAt?: number;
  readonly error?: string;
  readonly attempts: number;
  readonly priority: number;
}

export interface WorkflowStepResult {
  readonly id: string;
  readonly status: WorkflowStepStatus;
  readonly attempts: number;
  readonly output?: unknown;
  readonly error?: string;
  readonly startedAt: number;
  readonly endedAt: number;
}

export interface WorkflowExecution {
  readonly instanceId: string;
  readonly definitionId: string;
  readonly status: WorkflowLifecycleState;
  readonly durationMs: number;
  readonly steps: readonly WorkflowStepResult[];
  readonly outputs: Readonly<Record<string, unknown>>;
  readonly error?: string;
}

export interface WorkflowStatistics {
  readonly definitions: number;
  readonly instances: number;
  readonly byState: Readonly<Record<string, number>>;
  readonly checkpoints: number;
  readonly historyRecords: number;
}

export type WorkflowScheduleKind = "delay" | "interval" | "cron";
export interface WorkflowSchedule {
  readonly id: string;
  readonly definitionId: string;
  readonly kind: WorkflowScheduleKind;
  readonly dueAt: number;
  readonly intervalMs?: number;
  readonly cron?: string;
  readonly payload?: Readonly<Record<string, unknown>>;
}
