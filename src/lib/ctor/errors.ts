/** CTOR — error hierarchy. */
export class CTORError extends Error {
  constructor(message: string, readonly code: string = "ctor_error") {
    super(message);
    this.name = "CTORError";
  }
}
export class CapabilityError extends CTORError {
  constructor(m: string) { super(m, "capability_error"); this.name = "CapabilityError"; }
}
export class CapabilityNotFoundError extends CapabilityError {
  constructor(id: string) { super(`Capability not found: ${id}`); this.name = "CapabilityNotFoundError"; }
}
export class CapabilityAlreadyRegisteredError extends CapabilityError {
  constructor(id: string) { super(`Capability already registered: ${id}`); this.name = "CapabilityAlreadyRegisteredError"; }
}
export class ToolError extends CTORError {
  constructor(m: string) { super(m, "tool_error"); this.name = "ToolError"; }
}
export class ToolNotFoundError extends ToolError {
  constructor(id: string) { super(`Tool not found: ${id}`); this.name = "ToolNotFoundError"; }
}
export class ToolAlreadyRegisteredError extends ToolError {
  constructor(id: string) { super(`Tool already registered: ${id}`); this.name = "ToolAlreadyRegisteredError"; }
}
export class ToolValidationError extends ToolError {
  constructor(m: string) { super(m); this.name = "ToolValidationError"; }
}
export class WorkflowError extends CTORError {
  constructor(m: string) { super(m, "workflow_error"); this.name = "WorkflowError"; }
}
export class WorkflowValidationError extends WorkflowError {
  constructor(m: string) { super(m); this.name = "WorkflowValidationError"; }
}
export class WorkflowExecutionError extends WorkflowError {
  constructor(m: string, readonly stepId?: string) { super(m); this.name = "WorkflowExecutionError"; }
}
export class DependencyCycleError extends CTORError {
  constructor(readonly cycle: readonly string[]) {
    super(`Dependency cycle detected: ${cycle.join(" -> ")}`, "dependency_cycle");
    this.name = "DependencyCycleError";
  }
}
export class DependencyUnresolvedError extends CTORError {
  constructor(id: string, dep: string) {
    super(`Unresolved dependency for ${id}: ${dep}`, "dependency_unresolved");
    this.name = "DependencyUnresolvedError";
  }
}
export class ExecutionTimeoutError extends CTORError {
  constructor(ms: number) { super(`Execution timed out after ${ms}ms`, "execution_timeout"); this.name = "ExecutionTimeoutError"; }
}
export class ExecutionCancelledError extends CTORError {
  constructor(reason = "cancelled") { super(`Execution cancelled: ${reason}`, "execution_cancelled"); this.name = "ExecutionCancelledError"; }
}
export class LifecycleError extends CTORError {
  constructor(m: string) { super(m, "lifecycle_error"); this.name = "LifecycleError"; }
}
export class ValidationError extends CTORError {
  constructor(m: string) { super(m, "validation_error"); this.name = "ValidationError"; }
}
