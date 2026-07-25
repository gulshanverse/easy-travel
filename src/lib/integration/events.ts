/** IPCF — typed event bus. */
import { newCausationId, newCorrelationId, newEventId } from "./ids";

export type IntegrationEventName =
  | "ConnectorRegistered" | "ConnectorValidated"
  | "ConnectorEnabled" | "ConnectorDisabled"
  | "ConnectorRetired"
  | "ConnectorInvoked" | "ConnectorFailed" | "ConnectorRecovered"
  | "ConnectorHealthChanged"
  | "RequestNormalized" | "ResponseNormalized"
  | "WebhookRegistered" | "WebhookReceived" | "WebhookFailed"
  | "PollingScheduled" | "PollingTriggered" | "PollingFailed"
  | "RetryScheduled" | "RetryExhausted"
  | "DeadLetterQueued"
  | "CircuitOpened" | "CircuitHalfOpened" | "CircuitClosed"
  | "RateLimitExceeded";

export interface IntegrationEvent<T = unknown> {
  readonly id: string;
  readonly name: IntegrationEventName;
  readonly version: number;
  readonly timestamp: number;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly connectorId?: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly data: T;
}

export type IntegrationEventListener = (e: IntegrationEvent) => void;

export class IntegrationEventBus {
  private readonly listeners = new Set<IntegrationEventListener>();
  private readonly all: IntegrationEvent[] = [];
  private historyLimit = 2048;

  on(l: IntegrationEventListener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
  emit<T>(input: {
    name: IntegrationEventName; data: T;
    correlationId?: string; causationId?: string;
    connectorId?: string;
    metadata?: Record<string, unknown>;
  }): IntegrationEvent<T> {
    const evt: IntegrationEvent<T> = Object.freeze({
      id: newEventId(),
      name: input.name,
      version: 1,
      timestamp: Date.now(),
      correlationId: input.correlationId ?? newCorrelationId(),
      causationId: input.causationId ?? newCausationId(),
      connectorId: input.connectorId,
      metadata: Object.freeze({ ...(input.metadata ?? {}) }),
      data: input.data,
    });
    this.all.push(evt);
    if (this.all.length > this.historyLimit) this.all.splice(0, this.all.length - this.historyLimit);
    for (const l of this.listeners) { try { l(evt); } catch { /* ignore */ } }
    return evt;
  }
  history(): readonly IntegrationEvent[] { return [...this.all]; }
  filter(name: IntegrationEventName): readonly IntegrationEvent[] {
    return this.all.filter(e => e.name === name);
  }
  setHistoryLimit(n: number) { this.historyLimit = Math.max(1, n); }
  clear() { this.listeners.clear(); this.all.length = 0; }
}
