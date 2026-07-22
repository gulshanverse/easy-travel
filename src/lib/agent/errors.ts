/** ARP — error hierarchy. */
export class AgentError extends Error {
  constructor(message: string, readonly code: string = "agent_error") {
    super(message);
    this.name = "AgentError";
  }
}
export class AgentNotFoundError extends AgentError {
  constructor(id: string) { super(`Agent not found: ${id}`, "agent_not_found"); this.name = "AgentNotFoundError"; }
}
export class AgentAlreadyRegisteredError extends AgentError {
  constructor(id: string) { super(`Agent already registered: ${id}`, "agent_already_registered"); this.name = "AgentAlreadyRegisteredError"; }
}
export class AgentValidationError extends AgentError {
  constructor(m: string) { super(m, "agent_validation_error"); this.name = "AgentValidationError"; }
}
export class AgentLifecycleError extends AgentError {
  constructor(m: string) { super(m, "agent_lifecycle_error"); this.name = "AgentLifecycleError"; }
}
export class SessionNotFoundError extends AgentError {
  constructor(id: string) { super(`Session not found: ${id}`, "session_not_found"); this.name = "SessionNotFoundError"; }
}
export class ConversationNotFoundError extends AgentError {
  constructor(id: string) { super(`Conversation not found: ${id}`, "conversation_not_found"); this.name = "ConversationNotFoundError"; }
}
export class IntentClassificationError extends AgentError {
  constructor(m: string) { super(m, "intent_classification_error"); this.name = "IntentClassificationError"; }
}
export class PlanningError extends AgentError {
  constructor(m: string) { super(m, "planning_error"); this.name = "PlanningError"; }
}
export class CapabilitySelectionError extends AgentError {
  constructor(m: string) { super(m, "capability_selection_error"); this.name = "CapabilitySelectionError"; }
}
export class GovernanceError extends AgentError {
  constructor(m: string) { super(m, "governance_error"); this.name = "GovernanceError"; }
}
export class ResponseAssemblyError extends AgentError {
  constructor(m: string) { super(m, "response_assembly_error"); this.name = "ResponseAssemblyError"; }
}
