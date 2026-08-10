/**
 * NCP — subscription & unsubscribe registry.
 *
 * Owns per-user, per-category (topic) opt-outs and the deterministic
 * unsubscribe tokens embedded in outbound messages. Identity owns
 * *preferences*; NCP owns *delivery subscriptions* derived from
 * one-click unsubscribe actions. The two are combined at routing time.
 */
import { fingerprint } from "./ids";
import type { NotificationStore } from "./stores";
import type { NotificationCategory } from "./types";

export interface SubscriptionRecord {
  readonly id: string;
  readonly userId: string;
  readonly topic: string;
  readonly subscribed: boolean;
  readonly token: string;
  readonly updatedAt: number;
}

/** Deterministic: identical (userId, topic) always yields the same id/token. */
export function subscriptionId(userId: string, topic: string): string {
  return `sub_${fingerprint(`${userId}|${topic}`)}`;
}

export function unsubscribeToken(userId: string, topic: string, secret = "ncp"): string {
  return fingerprint(`${secret}|${userId}|${topic}`);
}

export class SubscriptionRegistry {
  constructor(
    private readonly store: NotificationStore<SubscriptionRecord>,
    private readonly secret = "ncp",
  ) {}

  private record(
    userId: string,
    topic: string,
    subscribed: boolean,
    at: number,
  ): SubscriptionRecord {
    return Object.freeze({
      id: subscriptionId(userId, topic),
      userId,
      topic,
      subscribed,
      token: unsubscribeToken(userId, topic, this.secret),
      updatedAt: at,
    });
  }

  async subscribe(userId: string, topic: string, at: number): Promise<SubscriptionRecord> {
    return this.store.put(this.record(userId, topic, true, at));
  }

  async unsubscribe(userId: string, topic: string, at: number): Promise<SubscriptionRecord> {
    return this.store.put(this.record(userId, topic, false, at));
  }

  /** One-click unsubscribe. Returns undefined when the token does not match. */
  async unsubscribeByToken(
    userId: string,
    topic: string,
    token: string,
    at: number,
  ): Promise<SubscriptionRecord | undefined> {
    if (token !== unsubscribeToken(userId, topic, this.secret)) return undefined;
    return this.unsubscribe(userId, topic, at);
  }

  tokenFor(userId: string, topic: string): string {
    return unsubscribeToken(userId, topic, this.secret);
  }

  /** Security and account topics can never be unsubscribed from. */
  async isUnsubscribed(userId: string, category: NotificationCategory): Promise<boolean> {
    if (category === "security" || category === "account") return false;
    const record = await this.store.get(subscriptionId(userId, category));
    return record ? !record.subscribed : false;
  }

  async list(userId: string): Promise<readonly SubscriptionRecord[]> {
    return this.store.where((r) => r.userId === userId);
  }
}
