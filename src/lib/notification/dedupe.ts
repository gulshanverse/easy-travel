/**
 * NCP — deduplication, idempotency and rate limiting.
 * All state is persisted; nothing authoritative lives in memory.
 */
import { fingerprint } from "./ids";
import type { NotificationStore } from "./stores";
import type { NotificationChannel } from "./types";

export interface DedupeRecord {
  readonly id: string;
  readonly userId: string;
  readonly key: string;
  readonly notificationId: string;
  readonly firstSeenAt: number;
  readonly expiresAt: number;
  readonly hits: number;
}

export interface IdempotencyRecord {
  readonly id: string;
  readonly key: string;
  readonly notificationId: string;
  readonly createdAt: number;
}

export interface RateWindowRecord {
  readonly id: string;
  readonly userId: string;
  readonly channel: NotificationChannel | "all";
  readonly windowStart: number;
  readonly count: number;
}

export class DeduplicationEngine {
  constructor(
    private readonly store: NotificationStore<DedupeRecord>,
    private readonly windowMs: number,
  ) {}

  static keyOf(userId: string, key: string): string {
    return `dk_${fingerprint(`${userId}:${key}`)}`;
  }

  /** Returns the existing notification id when the key is still within the window. */
  async check(userId: string, key: string, at: number): Promise<DedupeRecord | undefined> {
    const record = await this.store.get(DeduplicationEngine.keyOf(userId, key));
    if (!record) return undefined;
    if (record.expiresAt <= at) return undefined;
    return record;
  }

  async remember(
    userId: string,
    key: string,
    notificationId: string,
    at: number,
  ): Promise<DedupeRecord> {
    const id = DeduplicationEngine.keyOf(userId, key);
    const existing = await this.store.get(id);
    const record: DedupeRecord = Object.freeze({
      id,
      userId,
      key,
      notificationId: existing && existing.expiresAt > at ? existing.notificationId : notificationId,
      firstSeenAt: existing && existing.expiresAt > at ? existing.firstSeenAt : at,
      expiresAt: at + this.windowMs,
      hits: existing && existing.expiresAt > at ? existing.hits + 1 : 1,
    });
    return this.store.put(record);
  }
}

export class IdempotencyEngine {
  constructor(private readonly store: NotificationStore<IdempotencyRecord>) {}

  static keyOf(key: string): string {
    return `ik_${fingerprint(key)}`;
  }

  async lookup(key: string): Promise<IdempotencyRecord | undefined> {
    return this.store.get(IdempotencyEngine.keyOf(key));
  }

  async remember(key: string, notificationId: string, at: number): Promise<IdempotencyRecord> {
    const existing = await this.lookup(key);
    if (existing) return existing;
    return this.store.put(
      Object.freeze({ id: IdempotencyEngine.keyOf(key), key, notificationId, createdAt: at }),
    );
  }
}

export interface RateLimitVerdict {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly windowStart: number;
  readonly scope: "all" | NotificationChannel;
}

export class RateLimiter {
  constructor(
    private readonly store: NotificationStore<RateWindowRecord>,
    private readonly windowMs: number,
    private readonly maxPerWindow: number,
    private readonly maxPerChannel: number,
  ) {}

  private id(userId: string, scope: "all" | NotificationChannel): string {
    return `rw_${fingerprint(`${userId}:${scope}`)}`;
  }

  private windowStart(at: number): number {
    return Math.floor(at / this.windowMs) * this.windowMs;
  }

  async check(
    userId: string,
    scope: "all" | NotificationChannel,
    at: number,
  ): Promise<RateLimitVerdict> {
    const limit = scope === "all" ? this.maxPerWindow : this.maxPerChannel;
    const start = this.windowStart(at);
    const record = await this.store.get(this.id(userId, scope));
    const count = record && record.windowStart === start ? record.count : 0;
    return Object.freeze({
      allowed: count < limit,
      remaining: Math.max(0, limit - count),
      windowStart: start,
      scope,
    });
  }

  async consume(
    userId: string,
    scope: "all" | NotificationChannel,
    at: number,
  ): Promise<RateLimitVerdict> {
    const start = this.windowStart(at);
    const id = this.id(userId, scope);
    const record = await this.store.get(id);
    const count = record && record.windowStart === start ? record.count + 1 : 1;
    await this.store.put(Object.freeze({ id, userId, channel: scope, windowStart: start, count }));
    const limit = scope === "all" ? this.maxPerWindow : this.maxPerChannel;
    return Object.freeze({
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      windowStart: start,
      scope,
    });
  }
}
