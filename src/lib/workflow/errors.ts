/** WAR — error hierarchy. */
export class WorkflowError extends Error {
  constructor(message: string, readonly code: string = "workflow_error") {
    super(message);
    this.name = "WorkflowError";
  }
}
export class WorkflowValidationError extends WorkflowError {
  constructor(m: string) { super(m, "workflow_validation_error"); this.name = "WorkflowValidationError"; }
}
export class WorkflowNotFoundError extends WorkflowError {
  constructor(id: string) { super(`Workflow definition not found: ${id}`, "workflow_not_found"); this.name = "WorkflowNotFoundError"; }
}
export class WorkflowInstanceNotFoundError extends WorkflowError {
  constructor(id: string) { super(`Workflow instance not found: ${id}`, "workflow_instance_not_found"); this.name = "WorkflowInstanceNotFoundError"; }
}
export class WorkflowAlreadyRegisteredError extends WorkflowError {
  constructor(id: string) { super(`Workflow already registered: ${id}`, "workflow_already_registered"); this.name = "WorkflowAlreadyRegisteredError"; }
}
export class WorkflowTransitionError extends WorkflowError {
  constructor(from: string, to: string) { super(`Illegal workflow transition: ${from} -> ${to}`, "workflow_transition_error"); this.name = "WorkflowTransitionError"; }
}
export class WorkflowCycleError extends WorkflowError {
  constructor(ids: readonly string[]) { super(`Workflow contains a cycle: ${ids.join(" -> ")}`, "workflow_cycle_error"); this.name = "WorkflowCycleError"; }
}
export class WorkflowTimeoutError extends WorkflowError {
  constructor(ms: number) { super(`Workflow step timed out after ${ms}ms`, "workflow_timeout"); this.name = "WorkflowTimeoutError"; }
}
export class WorkflowCancelledError extends WorkflowError {
  constructor(m = "Workflow cancelled") { super(m, "workflow_cancelled"); this.name = "WorkflowCancelledError"; }
}
export class WorkflowPolicyError extends WorkflowError {
  constructor(m: string) { super(m, "workflow_policy_error"); this.name = "WorkflowPolicyError"; }
}
export class WorkflowCompensationError extends WorkflowError {
  constructor(m: string) { super(m, "workflow_compensation_error"); this.name = "WorkflowCompensationError"; }
}
export class WorkflowSchedulerError extends WorkflowError {
  constructor(m: string) { super(m, "workflow_scheduler_error"); this.name = "WorkflowSchedulerError"; }
}
export class DeadWorkflowError extends WorkflowError {
  constructor(id: string) { super(`Dead workflow detected: ${id}`, "dead_workflow"); this.name = "DeadWorkflowError"; }
}
