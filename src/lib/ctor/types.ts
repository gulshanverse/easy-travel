/** CTOR — domain types (immutable). */

export type CapabilityStatus = "registered" | "validated" | "active" | "degraded" | "disabled" | "removed";
export type ToolStatus = "registered" | "validated" | "active" | "disabled" | "removed";
export type WorkflowStatus =
  | "created" | "validated" | "scheduled" | "running" | "checkpoint"
  | "completed" | "failed" | "cancelled" | "archived";
export type StepStatus = "pending" | "ready" | "running" | "succeeded" | "failed" | "skipped" | "cancelled";
export type StepKind = "task" | "parallel" | "conditional" | "join" | "split" | "checkpoint" | "failure";

export interface CapabilityOwner {
  readonly engine: string;
  readonly team?: string;
}
export interface CapabilityDependency {
  readonly capabilityId: string;
  readonly versionRange?: string;
  readonly optional?: boolean;
}
export interface CapabilityPermission {
  readonly scope: string;
  readonly description?: string;
}
export interface CapabilityMetadata {
  readonly tags: readonly string[];
  readonly labels: Readonly<Record<string, string>>;
  readonly description?: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}
export interface CapabilityContract {
  readonly id: string;
  readonly version: string;
  readonly consumes: readonly string[];
  readonly produces: readonly string[];
  readonly ports: readonly string[];
}
export interface CapabilityManifestEntry {
  readonly id: string;
  readonly name: string;
  readonly features: readonly string[];
}
export interface CapabilityPolicy {
  readonly timeoutMs?: number;
  readonly retries?: number;
  readonly concurrency?: number;
  readonly priority?: number;
}
export interface CapabilityHealthState {
  readonly healthy: boolean;
  readonly checkedAt: number;
  readonly reason?: string;
}
export interface CapabilityStatistics {
  invocations: number;
  successes: number;
  failures: number;
  totalDurationMs: number;
}
export interface Capability {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly owner: CapabilityOwner;
  readonly dependencies: readonly CapabilityDependency[];
  readonly permissions: readonly CapabilityPermission[];
  readonly contract: CapabilityContract;
  readonly policy: CapabilityPolicy;
  readonly metadata: CapabilityMetadata;
  readonly status: CapabilityStatus;
}
export interface CapabilitySnapshot {
  readonly capability: Capability;
  readonly takenAt: number;
}
export interface CapabilityHistoryEntry {
  readonly at: number;
  readonly status: CapabilityStatus;
  readonly note?: string;
}

// ---------------- Tools ----------------
export interface ToolParameter {
  readonly name: string;
  readonly type: "string" | "number" | "boolean" | "object" | "array";
  readonly required: boolean;
  readonly description?: string;
}
export interface ToolSchema {
  readonly input: readonly ToolParameter[];
  readonly output: { readonly type: string; readonly description?: string };
}
export interface ToolContract {
  readonly capabilityId?: string;
  readonly idempotent: boolean;
  readonly sideEffects: boolean;
}
export interface ToolMetadata {
  readonly tags: readonly string[];
  readonly labels: Readonly<Record<string, string>>;
  readonly description?: string;
  readonly createdAt: number;
}
export interface ToolPermission { readonly scope: string; }
export interface ToolDefinition {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly schema: ToolSchema;
  readonly contract: ToolContract;
  readonly permissions: readonly ToolPermission[];
  readonly metadata: ToolMetadata;
  readonly status: ToolStatus;
  readonly policy?: CapabilityPolicy;
}
export type Tool = ToolDefinition;
export interface ToolInput { readonly [k: string]: unknown }
export interface ToolOutput { readonly [k: string]: unknown }
export interface ToolExecutionRecord {
  readonly toolId: string;
  readonly invocationId: string;
  readonly startedAt: number;
  readonly endedAt: number;
  readonly ok: boolean;
  readonly error?: string;
}
export interface ToolStatistics {
  invocations: number;
  successes: number;
  failures: number;
  totalDurationMs: number;
}
export interface ToolSnapshot { readonly tool: Tool; readonly takenAt: number }
export interface ToolHistoryEntry { readonly at: number; readonly status: ToolStatus; readonly note?: string }
export interface ToolHealthState { readonly healthy: boolean; readonly checkedAt: number; readonly reason?: string }

// ---------------- Execution ----------------
export interface ExecutionVariables { readonly [k: string]: unknown }
export interface ExecutionMetadata {
  readonly correlationId: string;
  readonly causationId?: string;
  readonly startedAt: number;
  readonly labels: Readonly<Record<string, string>>;
}
export interface ExecutionCorrelation {
  readonly correlationId: string;
  readonly causationId?: string;
  readonly parentSpanId?: string;
  readonly spanId: string;
  readonly traceId: string;
}
export interface ExecutionScope { readonly name: string; readonly depth: number }
export interface ExecutionContext {
  readonly executionId: string;
  readonly workflowId?: string;
  readonly scope: ExecutionScope;
  readonly variables: ExecutionVariables;
  readonly metadata: ExecutionMetadata;
  readonly correlation: ExecutionCorrelation;
  readonly signal: AbortSignal;
  readonly deadline?: number;
}
export interface ExecutionSnapshot {
  readonly executionId: string;
  readonly takenAt: number;
  readonly variables: ExecutionVariables;
  readonly stepStatuses: Readonly<Record<string, StepStatus>>;
}

// ---------------- Workflow ----------------
export interface RetryPolicy {
  readonly maxAttempts: number;
  readonly backoffMs: number;
  readonly factor: number;
}
export interface StepPolicy {
  readonly timeoutMs?: number;
  readonly retry?: RetryPolicy;
  readonly required?: boolean;
  readonly priority?: number;
}
export type StepExecutor = (
  ctx: ExecutionContext,
  inputs: Readonly<Record<string, unknown>>,
) => Promise<unknown> | unknown;

export interface WorkflowStep {
  readonly id: string;
  readonly kind: StepKind;
  readonly capabilityId?: string;
  readonly toolId?: string;
  readonly dependsOn: readonly string[];
  readonly when?: (ctx: ExecutionContext, outputs: Readonly<Record<string, unknown>>) => boolean;
  readonly execute?: StepExecutor;
  readonly policy?: StepPolicy;
  readonly checkpoint?: boolean;
  readonly rollbackable?: boolean;
}
export interface WorkflowDefinition {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly steps: readonly WorkflowStep[];
  readonly metadata?: Readonly<Record<string, string>>;
}
export interface StepResult {
  readonly id: string;
  readonly status: StepStatus;
  readonly output?: unknown;
  readonly error?: string;
  readonly attempts: number;
  readonly startedAt: number;
  readonly endedAt: number;
}
export interface WorkflowRunResult {
  readonly workflowId: string;
  readonly executionId: string;
  readonly status: WorkflowStatus;
  readonly outputs: Readonly<Record<string, unknown>>;
  readonly steps: readonly StepResult[];
  readonly durationMs: number;
  readonly failedStep?: string;
  readonly error?: string;
}
export interface WorkflowHistoryEntry {
  readonly at: number;
  readonly status: WorkflowStatus;
  readonly note?: string;
}
