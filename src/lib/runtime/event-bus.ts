/**
 * Runtime Core — Typed Event Bus.
 *
 * Guarantees provided:
 *  • Publish / Subscribe / Unsubscribe with typed event maps
 *  • Correlation + causation propagation across handler chains
 *  • Priority-ordered dispatch (higher first)
 *  • Middleware pipeline (before + after)
 *  • Replay buffer (bounded)
 *  • Retry policy with exponential backoff
 *  • Dead-letter queue interface
 *  • Idempotency via event id set
 *  • Per-type ordering (handlers dispatched sequentially per publish call)
 *  • Metrics + telemetry integration
 *
 * Events are typed — the event map (`E`) enumerates every allowed event name
 * and payload shape. String-based publish is impossible at the type level.
 */

import { EventBusError } from "./errors";
import { newEventId } from "./ids";
import type { RuntimeMetrics } from "./metrics";
import { defaultRuntimeMetrics } from "./metrics";
import type { RuntimeTelemetry } from "./telemetry";
import { defaultRuntimeTelemetry } from "./telemetry";

export interface EventEnvelope<Name extends string = string, Payload = unknown> {
  readonly id: string;
  readonly name: Name;
  readonly version: number;
  readonly timestamp: number;
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly priority: number;
  readonly payload: Payload;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export type EventHandler<Name extends string, Payload> = (
  event: EventEnvelope<Name, Payload>,
) => void | Promise<void>;

export interface SubscribeOptions {
  /** Higher priority handlers run first. Default 0. */
  priority?: number;
  /** Runs once and unsubscribes. */
  once?: boolean;
  /** Human-readable subscriber tag surfaced in metrics/logs. */
  tag?: string;
}

export interface EventBusMiddleware<E extends EventMap = EventMap> {
  before?<K extends keyof E & string>(event: EventEnvelope<K, E[K]>): void | Promise<void>;
  after?<K extends keyof E & string>(
    event: EventEnvelope<K, E[K]>,
    error?: unknown,
  ): void | Promise<void>;
}

export interface DeadLetterEntry<E extends EventMap = EventMap> {
  event: EventEnvelope<keyof E & string, E[keyof E & string]>;
  error: unknown;
  attempts: number;
  failedAt: number;
}

export interface DeadLetterQueue<E extends EventMap = EventMap> {
  push(entry: DeadLetterEntry<E>): void;
  drain(): readonly DeadLetterEntry<E>[];
  size(): number;
}

export class InMemoryDeadLetterQueue<E extends EventMap = EventMap>
  implements DeadLetterQueue<E>
{
  private items: DeadLetterEntry<E>[] = [];
  constructor(private readonly maxSize = 1024) {}
  push(entry: DeadLetterEntry<E>): void {
    this.items.push(entry);
    while (this.items.length > this.maxSize) this.items.shift();
  }
  drain(): readonly DeadLetterEntry<E>[] {
    const out = this.items;
    this.items = [];
    return out;
  }
  size(): number { return this.items.length; }
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffMs: number;
  /** Multiplier applied to backoffMs per attempt. */
  multiplier?: number;
  /** Return true to retry this error; default: always retry. */
  shouldRetry?: (err: unknown) => boolean;
}

export const NO_RETRY: RetryPolicy = { maxAttempts: 1, backoffMs: 0 };

export interface EventBusOptions {
  replayBufferSize?: number;
  maxHandlersPerEvent?: number;
  defaultRetry?: RetryPolicy;
  deadLetterQueue?: DeadLetterQueue;
  metrics?: RuntimeMetrics;
  telemetry?: RuntimeTelemetry;
  /** Enforce unique event ids across the bus lifetime for idempotency. */
  enforceIdempotency?: boolean;
}

export type EventMap = Record<string, unknown>;

interface Subscription<Name extends string, Payload> {
  id: string;
  name: Name;
  handler: EventHandler<Name, Payload>;
  priority: number;
  once: boolean;
  tag?: string;
}

/**
 * EventBus<E> — typed publish/subscribe. Provide an EventMap type parameter
 * to enumerate the event catalogue; only known event names compile.
 */
export class EventBus<E extends EventMap = EventMap> {
  private subs = new Map<keyof E & string, Subscription<string, unknown>[]>();
  private wildcard: Subscription<string, unknown>[] = [];
  private middleware: EventBusMiddleware<E>[] = [];
  private replay: EventEnvelope[] = [];
  private seen = new Set<string>();
  private readonly replayLimit: number;
  private readonly handlerLimit: number;
  private readonly retry: RetryPolicy;
  private readonly dlq?: DeadLetterQueue;
  private readonly metrics: RuntimeMetrics;
  private readonly telemetry: RuntimeTelemetry;
  private readonly enforceIdempotency: boolean;

  constructor(opts: EventBusOptions = {}) {
    this.replayLimit = opts.replayBufferSize ?? 256;
    this.handlerLimit = opts.maxHandlersPerEvent ?? 128;
    this.retry = opts.defaultRetry ?? NO_RETRY;
    this.dlq = opts.deadLetterQueue;
    this.metrics = opts.metrics ?? defaultRuntimeMetrics;
    this.telemetry = opts.telemetry ?? defaultRuntimeTelemetry;
    this.enforceIdempotency = opts.enforceIdempotency ?? false;
  }

  use(mw: EventBusMiddleware<E>): void {
    this.middleware.push(mw);
  }

  subscribe<K extends keyof E & string>(
    name: K,
    handler: EventHandler<K, E[K]>,
    opts: SubscribeOptions = {},
  ): () => void {
    const list = this.subs.get(name) ?? [];
    if (list.length >= this.handlerLimit) {
      throw new EventBusError(`Too many handlers for event ${name}`, {
        context: { event: name, limit: this.handlerLimit },
      });
    }
    const sub: Subscription<K, E[K]> = {
      id: newEventId(),
      name,
      handler,
      priority: opts.priority ?? 0,
      once: opts.once ?? false,
      tag: opts.tag,
    };
    list.push(sub as unknown as Subscription<string, unknown>);
    list.sort((a, b) => b.priority - a.priority);
    this.subs.set(name, list);
    this.metrics.gauge("runtime.event_bus.handlers", list.length, { event: name });
    return () => this.unsubscribe(sub.id, name);
  }

  subscribeAll(handler: EventHandler<string, unknown>, opts: SubscribeOptions = {}): () => void {
    const sub: Subscription<string, unknown> = {
      id: newEventId(),
      name: "*",
      handler,
      priority: opts.priority ?? 0,
      once: opts.once ?? false,
      tag: opts.tag,
    };
    this.wildcard.push(sub);
    this.wildcard.sort((a, b) => b.priority - a.priority);
    return () => {
      this.wildcard = this.wildcard.filter((s) => s.id !== sub.id);
    };
  }

  unsubscribe(id: string, name?: keyof E & string): void {
    if (name) {
      const list = this.subs.get(name);
      if (!list) return;
      this.subs.set(name, list.filter((s) => s.id !== id));
      return;
    }
    for (const [k, list] of this.subs) {
      const filtered = list.filter((s) => s.id !== id);
      if (filtered.length !== list.length) this.subs.set(k, filtered);
    }
    this.wildcard = this.wildcard.filter((s) => s.id !== id);
  }

  /** Publish an event. Returns after all handlers have completed (or thrown). */
  async publish<K extends keyof E & string>(
    name: K,
    payload: E[K],
    opts: {
      priority?: number;
      correlationId?: string;
      causationId?: string;
      version?: number;
      id?: string;
      metadata?: Record<string, unknown>;
    } = {},
  ): Promise<EventEnvelope<K, E[K]>> {
    const envelope: EventEnvelope<K, E[K]> = Object.freeze({
      id: opts.id ?? newEventId(),
      name,
      version: opts.version ?? 1,
      timestamp: Date.now(),
      correlationId: opts.correlationId,
      causationId: opts.causationId,
      priority: opts.priority ?? 0,
      payload,
      metadata: opts.metadata ? Object.freeze({ ...opts.metadata }) : undefined,
    });

    if (this.enforceIdempotency) {
      if (this.seen.has(envelope.id)) {
        this.metrics.incr("runtime.event_bus.duplicate", 1, { event: name });
        return envelope;
      }
      this.seen.add(envelope.id);
    }

    this.metrics.incr("runtime.event_bus.published", 1, { event: name });
    this.recordReplay(envelope);

    for (const mw of this.middleware) await mw.before?.(envelope);

    const handlers = [
      ...(this.subs.get(name) ?? []),
      ...this.wildcard,
    ].sort((a, b) => b.priority - a.priority);

    let firstError: unknown;
    for (const sub of handlers) {
      const started = Date.now();
      try {
        await this.dispatchWithRetry(sub, envelope);
        if (sub.once) this.unsubscribe(sub.id, sub.name === "*" ? undefined : (sub.name as keyof E & string));
        this.metrics.observe("runtime.event_bus.handler_ms", Date.now() - started, {
          event: name, tag: sub.tag ?? "anon",
        });
      } catch (err) {
        firstError ??= err;
        this.metrics.incr("runtime.event_bus.handler_error", 1, { event: name });
        this.telemetry.error("event_bus.handler_error", {
          event: name, error: (err as Error).message, tag: sub.tag,
        });
        this.dlq?.push({ event: envelope as unknown as EventEnvelope<keyof E & string, E[keyof E & string]>, error: err, attempts: this.retry.maxAttempts, failedAt: Date.now() });
      }
    }

    for (const mw of this.middleware) await mw.after?.(envelope, firstError);
    return envelope;
  }

  /** Replay stored events (bounded buffer). Optionally filter by name. */
  async replayEvents(name?: keyof E & string): Promise<readonly EventEnvelope[]> {
    const filtered = name ? this.replay.filter((e) => e.name === name) : [...this.replay];
    return filtered;
  }

  /** Handlers registered for a given event name. */
  handlerCount(name: keyof E & string): number {
    return this.subs.get(name)?.length ?? 0;
  }

  totalHandlers(): number {
    let n = this.wildcard.length;
    for (const list of this.subs.values()) n += list.length;
    return n;
  }

  clear(): void {
    this.subs.clear();
    this.wildcard = [];
    this.middleware = [];
    this.replay = [];
    this.seen.clear();
  }

  private async dispatchWithRetry<K extends string>(
    sub: Subscription<K, unknown>,
    envelope: EventEnvelope<K, unknown>,
  ): Promise<void> {
    const policy = this.retry;
    let attempt = 0;
    let delay = policy.backoffMs;
    // Wildcard handlers use `string` typing internally; safe cast.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const h = sub.handler as any;
    // First attempt + retries.
    // Handlers marked non-retryable via policy.shouldRetry(err) === false stop early.
    // Loop runs at least once (maxAttempts ≥ 1).
    while (true) {
      attempt += 1;
      try {
        await h(envelope);
        return;
      } catch (err) {
        if (attempt >= policy.maxAttempts) throw err;
        if (policy.shouldRetry && !policy.shouldRetry(err)) throw err;
        if (delay > 0) await new Promise((r) => setTimeout(r, delay));
        delay = delay * (policy.multiplier ?? 1);
      }
    }
  }

  private recordReplay(envelope: EventEnvelope): void {
    if (this.replayLimit <= 0) return;
    this.replay.push(envelope);
    while (this.replay.length > this.replayLimit) this.replay.shift();
  }
}
