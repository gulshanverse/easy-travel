/**
 * NCP — in-app inbox, digest buckets and dead-letter queue helpers.
 */
import { newDeadLetterId, newDigestId, newInAppItemId } from "./ids";
import type { NotificationStore } from "./stores";
import type {
  DeadLetter,
  Delivery,
  DigestBucket,
  FailureKind,
  InAppItem,
  Notification,
  RenderedMessage,
} from "./types";

export function makeInAppItem(
  notification: Notification,
  message: RenderedMessage,
  at: number,
): InAppItem {
  return Object.freeze({
    id: newInAppItemId(),
    notificationId: notification.id,
    userId: notification.recipient.userId,
    category: notification.category,
    priority: notification.priority,
    title: message.subject ?? message.summary,
    body: message.body,
    actions: notification.actions,
    groupKey: notification.groupKey,
    readAt: null,
    archivedAt: null,
    createdAt: at,
  });
}

export class InAppInbox {
  constructor(private readonly store: NotificationStore<InAppItem>) {}

  async add(item: InAppItem): Promise<InAppItem> {
    return this.store.put(item);
  }

  async list(userId: string, options: { includeArchived?: boolean } = {}): Promise<readonly InAppItem[]> {
    const items = await this.store.where(
      (i) => i.userId === userId && (options.includeArchived === true || i.archivedAt === null),
    );
    return Object.freeze([...items].sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id)));
  }

  async unreadCount(userId: string): Promise<number> {
    return (await this.list(userId)).filter((i) => i.readAt === null).length;
  }

  async markRead(userId: string, itemId: string, at: number): Promise<InAppItem | undefined> {
    const item = await this.store.get(itemId);
    if (!item || item.userId !== userId) return undefined;
    if (item.readAt !== null) return item;
    return this.store.put(Object.freeze({ ...item, readAt: at }));
  }

  async markAllRead(userId: string, at: number): Promise<number> {
    const items = (await this.list(userId)).filter((i) => i.readAt === null);
    for (const item of items) await this.store.put(Object.freeze({ ...item, readAt: at }));
    return items.length;
  }

  async archive(userId: string, itemId: string, at: number): Promise<InAppItem | undefined> {
    const item = await this.store.get(itemId);
    if (!item || item.userId !== userId) return undefined;
    return this.store.put(Object.freeze({ ...item, archivedAt: at }));
  }

  async byNotification(notificationId: string): Promise<readonly InAppItem[]> {
    return this.store.where((i) => i.notificationId === notificationId);
  }
}

export class DigestEngine {
  constructor(private readonly store: NotificationStore<DigestBucket>) {}

  async open(input: {
    userId: string;
    key: string;
    category: DigestBucket["category"];
    notificationId: string;
    at: number;
    windowMs: number;
  }): Promise<DigestBucket> {
    const existing = await this.store.first(
      (b) => b.userId === input.userId && b.key === input.key && b.flushedAt === null,
    );
    if (existing) {
      return this.store.put(
        Object.freeze({
          ...existing,
          notificationIds: Object.freeze([...existing.notificationIds, input.notificationId]),
        }),
      );
    }
    return this.store.put(
      Object.freeze({
        id: newDigestId(),
        userId: input.userId,
        key: input.key,
        category: input.category,
        notificationIds: Object.freeze([input.notificationId]),
        opensAt: input.at,
        flushAt: input.at + input.windowMs,
        flushedAt: null,
      }),
    );
  }

  async due(at: number): Promise<readonly DigestBucket[]> {
    const buckets = await this.store.where((b) => b.flushedAt === null && b.flushAt <= at);
    return Object.freeze([...buckets].sort((a, b) => a.flushAt - b.flushAt || a.id.localeCompare(b.id)));
  }

  async flush(bucket: DigestBucket, at: number): Promise<DigestBucket> {
    return this.store.put(Object.freeze({ ...bucket, flushedAt: at }));
  }

  async pending(userId: string): Promise<readonly DigestBucket[]> {
    return this.store.where((b) => b.userId === userId && b.flushedAt === null);
  }
}

export class DeadLetterQueue {
  constructor(private readonly store: NotificationStore<DeadLetter>) {}

  async record(input: {
    delivery: Delivery;
    failureKind: FailureKind;
    reason: string;
    at: number;
  }): Promise<DeadLetter> {
    return this.store.put(
      Object.freeze({
        id: newDeadLetterId(),
        notificationId: input.delivery.notificationId,
        deliveryId: input.delivery.id,
        channel: input.delivery.channel,
        userId: input.delivery.userId,
        failureKind: input.failureKind,
        reason: input.reason,
        attempts: input.delivery.attempts.length,
        at: input.at,
        replayedAt: null,
      }),
    );
  }

  async list(): Promise<readonly DeadLetter[]> {
    const all = await this.store.all();
    return Object.freeze([...all].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id)));
  }

  async pending(): Promise<readonly DeadLetter[]> {
    return (await this.list()).filter((d) => d.replayedAt === null);
  }

  async markReplayed(id: string, at: number): Promise<DeadLetter | undefined> {
    const entry = await this.store.get(id);
    if (!entry) return undefined;
    return this.store.put(Object.freeze({ ...entry, replayedAt: at }));
  }
}
