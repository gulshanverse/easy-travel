/**
 * Optional persistence implementations (Phase P-1.1 enhancement):
 * an append-only Event Store, an append-only Audit Store and a
 * Transactional Outbox. These are persistence concerns only — no runtime
 * engine is modified and no engine imports them directly.
 */

import { COLLECTIONS } from "./collections";
import { spec } from "./repository/specification";
import type { Repository } from "./repository/types";
import { PersistenceError } from "./errors";

type Doc = Record<string, unknown>;

/* ------------------------------------------------------------------ */
/* Event store                                                         */
/* ------------------------------------------------------------------ */

export interface StoredEvent {
  readonly id: string;
  readonly stream: string;
  readonly sequence: number;
  readonly eventType: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly ownerId: string | null;
  readonly createdAt: string;
}

export interface AppendEventInput {
  readonly stream: string;
  readonly eventType: string;
  readonly payload?: Readonly<Record<string, unknown>>;
  readonly ownerId?: string | null;
  /** Optimistic concurrency: expected current sequence for the stream. */
  readonly expectedSequence?: number;
}

/** Append-only, deterministically sequenced event log. */
export class EventStore {
  constructor(private readonly repo: Repository<Doc>) {}

  async append(input: AppendEventInput, now = new Date()): Promise<StoredEvent> {
    const current = await this.lastSequence(input.stream);
    if (input.expectedSequence !== undefined && input.expectedSequence !== current)
      throw new PersistenceError(
        `event stream ${input.stream} is at sequence ${current}, expected ${input.expectedSequence}`,
        { stream: input.stream, current },
      );
    const sequence = current + 1;
    const event: StoredEvent = Object.freeze({
      id: `${input.stream}#${sequence}`,
      stream: input.stream,
      sequence,
      eventType: input.eventType,
      payload: Object.freeze({ ...(input.payload ?? {}) }),
      ownerId: input.ownerId ?? null,
      createdAt: now.toISOString(),
    });
    await this.repo.insert(event.id, event as unknown as Doc, event.ownerId);
    return event;
  }

  async lastSequence(stream: string): Promise<number> {
    const rows = await this.read(stream);
    return rows.reduce((max, e) => Math.max(max, e.sequence), 0);
  }

  async read(stream: string, fromSequence = 0): Promise<readonly StoredEvent[]> {
    const rows = await this.repo.find({ specification: spec.eq("stream", stream) });
    return rows
      .map((r) => r.data as unknown as StoredEvent)
      .filter((e) => e.sequence > fromSequence)
      .sort((a, b) => a.sequence - b.sequence);
  }

  async replay<S>(
    stream: string,
    initial: S,
    reducer: (state: S, event: StoredEvent) => S,
  ): Promise<S> {
    return (await this.read(stream)).reduce(reducer, initial);
  }
}

/* ------------------------------------------------------------------ */
/* Audit store                                                         */
/* ------------------------------------------------------------------ */

export type AuditAction = "create" | "update" | "delete" | "restore" | "read";

export interface AuditEntry {
  readonly id: string;
  readonly actorId: string | null;
  readonly ownerId: string | null;
  readonly action: AuditAction;
  readonly collection: string;
  readonly recordId: string;
  readonly before: Readonly<Record<string, unknown>> | null;
  readonly after: Readonly<Record<string, unknown>> | null;
  readonly createdAt: string;
}

/** Append-only audit trail; entries are never updated or deleted. */
export class AuditStore {
  private counter = 0;
  constructor(private readonly repo: Repository<Doc>) {}

  async record(entry: Omit<AuditEntry, "id" | "createdAt">, now = new Date()): Promise<AuditEntry> {
    this.counter += 1;
    const full: AuditEntry = Object.freeze({
      ...entry,
      id: `${entry.collection}:${entry.recordId}:${this.counter}`,
      createdAt: now.toISOString(),
    });
    await this.repo.insert(full.id, full as unknown as Doc, full.ownerId);
    return full;
  }

  async forRecord(collection: string, recordId: string): Promise<readonly AuditEntry[]> {
    const rows = await this.repo.find({
      specification: spec.all(spec.eq("collection", collection), spec.eq("recordId", recordId)),
    });
    return rows
      .map((r) => r.data as unknown as AuditEntry)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async forActor(actorId: string): Promise<readonly AuditEntry[]> {
    const rows = await this.repo.find({ specification: spec.eq("actorId", actorId) });
    return rows.map((r) => r.data as unknown as AuditEntry);
  }
}

/* ------------------------------------------------------------------ */
/* Transactional outbox                                                */
/* ------------------------------------------------------------------ */

export type OutboxStatus = "pending" | "delivered" | "failed";

export interface OutboxMessage {
  readonly id: string;
  readonly topic: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly status: OutboxStatus;
  readonly attempts: number;
  readonly lastError: string | null;
  readonly availableAt: string;
  readonly createdAt: string;
}

export interface OutboxOptions {
  readonly maxAttempts?: number;
  readonly retryBaseDelayMs?: number;
}

/**
 * Transactional outbox: messages are enqueued inside the same unit of work
 * as the state change, then drained separately with bounded retries.
 */
export class OutboxStore {
  private counter = 0;
  private readonly maxAttempts: number;
  private readonly retryBaseDelayMs: number;

  constructor(
    private readonly repo: Repository<Doc>,
    options: OutboxOptions = {},
  ) {
    this.maxAttempts = options.maxAttempts ?? 3;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? 1_000;
  }

  async enqueue(
    topic: string,
    payload: Readonly<Record<string, unknown>> = {},
    now = new Date(),
  ): Promise<OutboxMessage> {
    this.counter += 1;
    const msg: OutboxMessage = Object.freeze({
      id: `${topic}:${this.counter}`,
      topic,
      payload: Object.freeze({ ...payload }),
      status: "pending",
      attempts: 0,
      lastError: null,
      availableAt: now.toISOString(),
      createdAt: now.toISOString(),
    });
    await this.repo.insert(msg.id, msg as unknown as Doc);
    return msg;
  }

  async pending(now = new Date()): Promise<readonly OutboxMessage[]> {
    const rows = await this.repo.find({ specification: spec.eq("status", "pending") });
    return rows
      .map((r) => r.data as unknown as OutboxMessage)
      .filter((m) => Date.parse(m.availableAt) <= now.getTime())
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  }

  private async write(msg: OutboxMessage): Promise<OutboxMessage> {
    await this.repo.save(msg.id, msg as unknown as Doc);
    return msg;
  }

  async markDelivered(id: string): Promise<OutboxMessage> {
    const entity = await this.repo.requireById(id);
    const prev = entity.data as unknown as OutboxMessage;
    return this.write(
      Object.freeze({ ...prev, status: "delivered", attempts: prev.attempts + 1, lastError: null }),
    );
  }

  async markFailed(id: string, error: string, now = new Date()): Promise<OutboxMessage> {
    const entity = await this.repo.requireById(id);
    const prev = entity.data as unknown as OutboxMessage;
    const attempts = prev.attempts + 1;
    const exhausted = attempts >= this.maxAttempts;
    return this.write(
      Object.freeze({
        ...prev,
        attempts,
        lastError: error,
        status: exhausted ? "failed" : "pending",
        availableAt: new Date(
          now.getTime() + this.retryBaseDelayMs * Math.pow(2, attempts - 1),
        ).toISOString(),
      }),
    );
  }

  /** Drains all currently available messages through `deliver`. */
  async drain(
    deliver: (msg: OutboxMessage) => Promise<void>,
    now = new Date(),
  ): Promise<{ delivered: number; failed: number }> {
    let delivered = 0;
    let failed = 0;
    for (const msg of await this.pending(now)) {
      try {
        await deliver(msg);
        await this.markDelivered(msg.id);
        delivered += 1;
      } catch (err) {
        await this.markFailed(msg.id, String((err as Error)?.message ?? err), now);
        failed += 1;
      }
    }
    return { delivered, failed };
  }
}

export const STORE_COLLECTIONS = Object.freeze({
  events: COLLECTIONS.events,
  audit: COLLECTIONS.auditLogs,
  outbox: COLLECTIONS.outbox,
});
