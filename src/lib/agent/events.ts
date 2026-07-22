/** ARP — typed event bus. */
import { newCausationId, newCorrelationId, newEventId } from "./ids";

export type AgentEventName =
  | "AgentRegistered" | "AgentUpdated" | "AgentRemoved"
  | "AgentStarted" | "AgentReady" | "AgentArchived" | "AgentFailed"
  | "IntentClassified"
  | "PlanCreated"
  | "CapabilitySelected"
  | "WorkflowRequested" | "WorkflowCompleted" | "WorkflowFailed"
  | "ResponseAssembled"
  | "SessionCreated" | "SessionEnded" | "SessionExpired"
  | "ConversationCreated" | "ConversationUpdated" | "ConversationCompleted"
  | "AgentDelegated"
  | "GovernanceViolation";

export interface AgentEvent<T = unknown> {
  readonly id: string;
  readonly name: AgentEventName;
  readonly version: number;
  readonly timestamp: number;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly agentId?: string;
  readonly sessionId?: string;
  readonly conversationId?: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly data: T;
}

export type AgentEventListener = (e: AgentEvent) => void;

export class AgentEventBus {
  private readonly listeners = new Set<AgentEventListener>();
  private readonly all: AgentEvent[] = [];
  private historyLimit = 1024;

  on(l: AgentEventListener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
  emit<T>(input: {
    name: AgentEventName; data: T;
    correlationId?: string; causationId?: string;
    agentId?: string; sessionId?: string; conversationId?: string;
    metadata?: Record<string, unknown>;
  }): AgentEvent<T> {
    const evt: AgentEvent<T> = Object.freeze({
      id: newEventId(),
      name: input.name,
      version: 1,
      timestamp: Date.now(),
      correlationId: input.correlationId ?? newCorrelationId(),
      causationId: input.causationId ?? newCausationId(),
      agentId: input.agentId,
      sessionId: input.sessionId,
      conversationId: input.conversationId,
      metadata: Object.freeze({ ...(input.metadata ?? {}) }),
      data: input.data,
    });
    this.all.push(evt);
    if (this.all.length > this.historyLimit) this.all.splice(0, this.all.length - this.historyLimit);
    for (const l of this.listeners) { try { l(evt); } catch { /* ignore */ } }
    return evt;
  }
  history(): readonly AgentEvent[] { return [...this.all]; }
  clear(): void { this.listeners.clear(); this.all.length = 0; }
}
