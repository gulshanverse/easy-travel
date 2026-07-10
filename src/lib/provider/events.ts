/**
 * Provider Runtime — Typed events.
 * Every event carries correlation/causation IDs, timestamp, and version.
 */
import { newEventId } from "./ids";
import type { ProviderHealthState, TokenUsage } from "./types";

export type ProviderEventName =
  | "ProviderRegistered"
  | "ProviderUnregistered"
  | "ProviderSelected"
  | "ProviderUnavailable"
  | "ProviderRecovered"
  | "ModelSelected"
  | "ExecutionStarted"
  | "ExecutionStreaming"
  | "ExecutionCompleted"
  | "ExecutionFailed"
  | "ExecutionCancelled"
  | "RetryStarted"
  | "RetryCompleted"
  | "FallbackStarted"
  | "FallbackCompleted"
  | "BudgetExceeded"
  | "CostCalculated"
  | "HealthChanged"
  | "CircuitOpened"
  | "CircuitClosed"
  | "CircuitHalfOpen";

export interface ProviderEvent<TData = Record<string, unknown>> {
  eventId: string;
  name: ProviderEventName;
  version: 1;
  timestamp: number;
  correlationId: string;
  causationId?: string;
  data: TData;
  metadata?: Readonly<Record<string, unknown>>;
}

export interface ProviderEventPublisher {
  publish<TData>(evt: Omit<ProviderEvent<TData>, "eventId" | "timestamp" | "version">): Promise<void>;
  subscribe<TData>(name: ProviderEventName | "*", handler: (evt: ProviderEvent<TData>) => void | Promise<void>): () => void;
}

type Handler = (evt: ProviderEvent) => void | Promise<void>;

export class InMemoryProviderEventPublisher implements ProviderEventPublisher {
  private handlers = new Map<string, Set<Handler>>();
  private history: ProviderEvent[] = [];
  private readonly historyCap: number;

  constructor(historyCap = 500) { this.historyCap = historyCap; }

  async publish<TData>(evt: Omit<ProviderEvent<TData>, "eventId" | "timestamp" | "version">): Promise<void> {
    const full: ProviderEvent = {
      eventId: newEventId(),
      timestamp: Date.now(),
      version: 1,
      ...evt,
    } as ProviderEvent;
    this.history.push(full);
    if (this.history.length > this.historyCap) this.history.shift();
    const named = this.handlers.get(full.name);
    const wildcard = this.handlers.get("*");
    const all: Handler[] = [];
    if (named) all.push(...named);
    if (wildcard) all.push(...wildcard);
    for (const h of all) {
      try { await h(full); } catch { /* isolate handler failures */ }
    }
  }

  subscribe<TData>(name: ProviderEventName | "*", handler: (evt: ProviderEvent<TData>) => void | Promise<void>): () => void {
    const key = name;
    let set = this.handlers.get(key);
    if (!set) { set = new Set(); this.handlers.set(key, set); }
    set.add(handler as Handler);
    return () => { set!.delete(handler as Handler); };
  }

  snapshot(): readonly ProviderEvent[] { return [...this.history]; }
  clear(): void { this.history = []; }
}

export const defaultProviderEventPublisher: ProviderEventPublisher = new InMemoryProviderEventPublisher();

/** Convenience payload shapes for common events. */
export interface ExecutionCompletedData {
  executionId: string;
  providerId: string;
  modelId: string;
  usage: TokenUsage;
  latencyMs: number;
  attempts: number;
  fallbacks: number;
  streamed: boolean;
}
export interface HealthChangedData {
  providerId: string;
  previous: ProviderHealthState;
  next: ProviderHealthState;
  reason?: string;
}
