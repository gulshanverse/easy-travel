/**
 * Typed event system for the Prompt Runtime.
 * All events carry correlation/causation IDs and a monotonic sequence.
 */
import type {
  CorrelationId,
  CausationId,
  ExecutionUsage,
  PromptId,
  PromptStage,
  PromptVersion,
  TraceId,
} from "./types";

export type PromptEventType =
  | "PromptRequested"
  | "PromptContextBuilt"
  | "PromptCompiled"
  | "PromptValidated"
  | "PromptBudgetChecked"
  | "PromptExecuted"
  | "PromptStreamStarted"
  | "PromptChunkReceived"
  | "PromptStreamCompleted"
  | "PromptCompleted"
  | "PromptFailed"
  | "PromptCancelled"
  | "PromptCached"
  | "PromptCacheHit"
  | "PromptCacheMiss"
  | "PromptStageEntered"
  | "PromptStageExited";

export interface PromptEventEnvelope<TPayload = unknown> {
  type: PromptEventType;
  eventId: string;
  correlationId: CorrelationId;
  causationId?: CausationId;
  traceId?: TraceId;
  promptId?: PromptId;
  version?: PromptVersion;
  stage?: PromptStage;
  sequence: number;
  timestamp: number;
  payload: TPayload;
  metadata?: Record<string, unknown>;
}

export type PromptEventListener = (event: PromptEventEnvelope) => void;

export interface PromptEventPublisher {
  publish<T>(
    type: PromptEventType,
    payload: T,
    ctx: {
      correlationId: CorrelationId;
      causationId?: CausationId;
      traceId?: TraceId;
      promptId?: PromptId;
      version?: PromptVersion;
      stage?: PromptStage;
      metadata?: Record<string, unknown>;
    },
  ): PromptEventEnvelope<T>;
  subscribe(listener: PromptEventListener): () => void;
  subscribeTo(type: PromptEventType, listener: PromptEventListener): () => void;
}

export class InMemoryPromptEventPublisher implements PromptEventPublisher {
  private seq = 0;
  private readonly listeners = new Set<PromptEventListener>();
  private readonly byType = new Map<PromptEventType, Set<PromptEventListener>>();

  publish<T>(
    type: PromptEventType,
    payload: T,
    ctx: Parameters<PromptEventPublisher["publish"]>[2],
  ): PromptEventEnvelope<T> {
    const envelope: PromptEventEnvelope<T> = {
      type,
      eventId: `evt_${++this.seq}_${Date.now().toString(36)}`,
      correlationId: ctx.correlationId,
      causationId: ctx.causationId,
      traceId: ctx.traceId,
      promptId: ctx.promptId,
      version: ctx.version,
      stage: ctx.stage,
      sequence: this.seq,
      timestamp: Date.now(),
      payload,
      metadata: ctx.metadata,
    };
    for (const l of this.listeners) safeInvoke(l, envelope);
    const set = this.byType.get(type);
    if (set) for (const l of set) safeInvoke(l, envelope);
    return envelope;
  }

  subscribe(listener: PromptEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribeTo(type: PromptEventType, listener: PromptEventListener): () => void {
    let set = this.byType.get(type);
    if (!set) {
      set = new Set();
      this.byType.set(type, set);
    }
    set.add(listener);
    return () => set!.delete(listener);
  }
}

function safeInvoke(listener: PromptEventListener, event: PromptEventEnvelope): void {
  try {
    listener(event);
  } catch {
    /* listener errors must never break the pipeline */
  }
}

export const defaultPromptEventPublisher: PromptEventPublisher =
  new InMemoryPromptEventPublisher();

// ─── Concrete payload shapes (for typed consumers) ───────────────────────────
export interface PromptExecutedPayload {
  usage: ExecutionUsage;
  durationMs: number;
  cached: boolean;
}
export interface PromptFailedPayload {
  code: string;
  message: string;
  stage?: PromptStage;
  recoverable: boolean;
}
export interface PromptChunkPayload {
  index: number;
  delta: string;
  finished?: boolean;
}
