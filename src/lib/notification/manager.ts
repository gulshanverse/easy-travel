/**
 * NCP — NotificationManager. Orchestrates create → route → render → deliver,
 * with dedupe, rate limiting, retries, digests and dead-lettering.
 */
import { ChannelRegistry } from "./channels";
import { NOTIFICATION_COLLECTIONS } from "./collections";
import type { NotificationConfig } from "./config";
import { DeduplicationEngine, IdempotencyEngine, RateLimiter } from "./dedupe";
import type { DedupeRecord, IdempotencyRecord, RateWindowRecord } from "./dedupe";
import { NotificationEventBus } from "./events";
import {
  NotificationValidationError,
  UnknownNotificationError,
  UnknownRecipientError,
} from "./errors";
import { DeadLetterQueue, DigestEngine, InAppInbox, makeInAppItem } from "./inbox";
import { dedupeKeyFor, newDeliveryId, newNotificationId } from "./ids";
import { aggregateState } from "./lifecycle";
import { NCP_METRIC, NotificationMetrics } from "./metrics";
import type { NotificationPorts, NotificationPreferenceRecord } from "./ports";
import { DEFAULT_PREFERENCES, digestWindowMs, localHour, route } from "./routing";
import { redact } from "./security";
import { notificationStoreFor, type NotificationStore } from "./stores";
import { renderTemplate, TemplateRegistry } from "./templates";
import { BUILT_IN_TEMPLATES } from "./catalog";
import { decideRetry } from "./retry";
import { noopNotificationTelemetry, type NotificationTelemetrySink } from "./telemetry";
import type {
  DeadLetter,
  Delivery,
  DeliveryAttempt,
  DigestBucket,
  InAppItem,
  Notification,
  NotificationAction,
  NotificationCategory,
  NotificationChannel,
  NotificationPriority,
  NotificationRecipient,
  NotificationSnapshot,
  TemplateVariables,
} from "./types";

export interface NotifyInput {
  readonly userId: string;
  readonly type: string;
  readonly category: NotificationCategory;
  readonly templateId?: string;
  readonly priority?: NotificationPriority;
  readonly variables?: TemplateVariables;
  readonly channels?: readonly NotificationChannel[];
  readonly actions?: readonly NotificationAction[];
  readonly dedupeKey?: string;
  readonly idempotencyKey?: string;
  readonly groupKey?: string;
  readonly notBefore?: number;
  readonly expiresAt?: number;
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly metadata?: Readonly<Record<string, string | number | boolean>>;
}

export interface NotificationManagerOptions {
  readonly config: NotificationConfig;
  readonly ports: NotificationPorts;
  readonly events: NotificationEventBus;
  readonly metrics: NotificationMetrics;
  readonly telemetry?: NotificationTelemetrySink;
  readonly templates?: TemplateRegistry;
  readonly channels?: ChannelRegistry;
  readonly now?: () => number;
}

export class NotificationManager {
  readonly templates: TemplateRegistry;
  readonly channels: ChannelRegistry;
  readonly inbox: InAppInbox;
  readonly digests: DigestEngine;
  readonly deadLetters: DeadLetterQueue;
  private readonly notifications: NotificationStore<Notification>;
  private readonly deliveries: NotificationStore<Delivery>;
  private readonly dedupe: DeduplicationEngine;
  private readonly idempotency: IdempotencyEngine;
  private readonly limiter: RateLimiter;
  private readonly telemetry: NotificationTelemetrySink;
  private readonly clock: () => number;

  constructor(private readonly options: NotificationManagerOptions) {
    const persistence = options.ports.persistence;
    if (!persistence) {
      throw new NotificationValidationError("a persistence port is required (P-1.1)");
    }
    this.clock = options.now ?? (() => Date.now());
    this.telemetry = options.telemetry ?? noopNotificationTelemetry;
    this.templates = options.templates ?? new TemplateRegistry(options.config.fallbackLocale, BUILT_IN_TEMPLATES);
    this.channels = options.channels ?? new ChannelRegistry();
    this.notifications = notificationStoreFor<Notification>(
      persistence,
      NOTIFICATION_COLLECTIONS.notifications,
      (n) => n.recipient.userId,
    );
    this.deliveries = notificationStoreFor<Delivery>(
      persistence,
      NOTIFICATION_COLLECTIONS.deliveries,
      (d) => d.userId,
    );
    this.inbox = new InAppInbox(
      notificationStoreFor<InAppItem>(persistence, NOTIFICATION_COLLECTIONS.inApp, (i) => i.userId),
    );
    this.digests = new DigestEngine(
      notificationStoreFor<DigestBucket>(persistence, NOTIFICATION_COLLECTIONS.digests, (d) => d.userId),
    );
    this.deadLetters = new DeadLetterQueue(
      notificationStoreFor<DeadLetter>(persistence, NOTIFICATION_COLLECTIONS.deadLetters, (d) => d.userId),
    );
    this.dedupe = new DeduplicationEngine(
      notificationStoreFor<DedupeRecord>(persistence, NOTIFICATION_COLLECTIONS.dedupe, (d) => d.userId),
      options.config.dedupeWindowMs,
    );
    this.idempotency = new IdempotencyEngine(
      notificationStoreFor<IdempotencyRecord>(persistence, NOTIFICATION_COLLECTIONS.idempotency),
    );
    this.limiter = new RateLimiter(
      notificationStoreFor<RateWindowRecord>(persistence, NOTIFICATION_COLLECTIONS.rateWindows, (r) => r.userId),
      options.config.rateLimit.windowMs,
      options.config.rateLimit.maxPerWindow,
      options.config.rateLimit.maxPerChannelPerWindow,
    );
  }

  private get config(): NotificationConfig {
    return this.options.config;
  }
  private get events(): NotificationEventBus {
    return this.options.events;
  }
  private get metrics(): NotificationMetrics {
    return this.options.metrics;
  }

  /* ------------------------------------------------------------ recipients */

  private async resolveRecipient(userId: string): Promise<NotificationRecipient> {
    const record = await this.options.ports.identity?.recipient(userId);
    if (!record) throw new UnknownRecipientError(userId);
    return Object.freeze({
      userId,
      locale: record.locale ?? this.config.defaultLocale,
      timezone: record.timezone ?? this.config.defaultTimezone,
      emailAddress: record.emailAddress ?? null,
      phoneNumber: record.phoneNumber ?? null,
      pushTokens: Object.freeze([...(record.pushTokens ?? [])]),
    });
  }

  private async resolvePreferences(userId: string): Promise<NotificationPreferenceRecord> {
    const prefs = await this.options.ports.identity?.preferences(userId);
    return prefs ?? DEFAULT_PREFERENCES;
  }

  /* ---------------------------------------------------------------- notify */

  async notify(input: NotifyInput): Promise<Notification> {
    return this.telemetry.span("ncp.notify", async () => {
      const at = this.clock();
      const variables = input.variables ?? {};
      const templateId = input.templateId ?? input.type;
      const priority: NotificationPriority = input.priority ?? "normal";

      if (input.idempotencyKey) {
        const existing = await this.idempotency.lookup(input.idempotencyKey);
        if (existing) {
          const stored = await this.notifications.get(existing.notificationId);
          if (stored) return stored;
        }
      }

      const recipient = await this.resolveRecipient(input.userId);
      const preferences = await this.resolvePreferences(input.userId);
      const marketingSuppressed =
        (await this.options.ports.identity?.marketingSuppressed?.(input.userId)) ?? false;

      const dedupeKey = input.dedupeKey ?? dedupeKeyFor({ userId: input.userId, type: input.type, variables });
      const duplicate = await this.dedupe.check(input.userId, dedupeKey, at);

      const decision = route({
        preferences,
        category: input.category,
        priority,
        requestedChannels: input.channels ?? [],
        enabledChannels: this.config.channels,
        availableChannels: this.channels.channels(),
        quietHoursBypass: this.config.quietHoursBypass,
        hour: localHour(at, recipient.timezone),
        marketingSuppressed,
      });

      const rateVerdict = await this.limiter.check(input.userId, "all", at);
      const suppression = duplicate
        ? ("duplicate" as const)
        : !rateVerdict.allowed && priority !== "critical"
          ? ("rate_limited" as const)
          : decision.suppression;

      const notBefore = input.notBefore ?? at;
      const state = suppression
        ? ("suppressed" as const)
        : decision.digest
          ? ("scheduled" as const)
          : notBefore > at
            ? ("scheduled" as const)
            : ("queued" as const);

      const notification: Notification = Object.freeze({
        id: newNotificationId(),
        type: input.type,
        category: input.category,
        priority,
        recipient,
        templateId,
        variables: Object.freeze({ ...variables }),
        actions: Object.freeze([...(input.actions ?? [])]),
        channels: decision.channels,
        requestedChannels: Object.freeze([...(input.channels ?? [])]),
        state,
        suppression,
        schedule: Object.freeze({
          notBefore,
          expiresAt: input.expiresAt ?? null,
          digestKey: decision.digest ? `${input.category}` : null,
        }),
        dedupeKey,
        idempotencyKey: input.idempotencyKey ?? null,
        correlationId: input.correlationId ?? input.type,
        causationId: input.causationId ?? null,
        groupKey: input.groupKey ?? null,
        readAt: null,
        createdAt: at,
        updatedAt: at,
        metadata: Object.freeze({ ...(input.metadata ?? {}) }),
      });

      await this.notifications.put(notification);
      await this.dedupe.remember(input.userId, dedupeKey, notification.id, at);
      if (input.idempotencyKey) {
        await this.idempotency.remember(input.idempotencyKey, notification.id, at);
      }
      await this.audit(notification, "create");
      this.metrics.inc(NCP_METRIC.created);
      this.events.emit({
        kind: "NotificationCreated",
        at,
        userId: input.userId,
        notificationId: notification.id,
        correlationId: notification.correlationId,
        payload: redact({ type: input.type, category: input.category, priority }) ?? {},
      });

      if (suppression) {
        this.metrics.inc(suppression === "duplicate" ? NCP_METRIC.deduped : NCP_METRIC.suppressed);
        if (suppression === "rate_limited") this.metrics.inc(NCP_METRIC.rateLimited);
        this.events.emit({
          kind:
            suppression === "duplicate"
              ? "NotificationDeduplicated"
              : suppression === "rate_limited"
                ? "NotificationRateLimited"
                : "NotificationSuppressed",
          at,
          userId: input.userId,
          notificationId: notification.id,
          payload: { reason: suppression, detail: decision.reason },
        });
        return notification;
      }

      await this.limiter.consume(input.userId, "all", at);

      if (decision.digest) {
        await this.digests.open({
          userId: input.userId,
          key: `${input.category}:${preferences.frequency}`,
          category: input.category,
          notificationId: notification.id,
          at,
          windowMs: digestWindowMs(preferences.frequency, this.config.digestWindowMs),
        });
        this.events.emit({
          kind: "DigestOpened",
          at,
          userId: input.userId,
          notificationId: notification.id,
          payload: { category: input.category },
        });
        return notification;
      }

      await this.enqueueDeliveries(notification, at);
      return notification;
    });
  }

  private async enqueueDeliveries(notification: Notification, at: number): Promise<readonly Delivery[]> {
    const created: Delivery[] = [];
    for (const channel of notification.channels) {
      const delivery: Delivery = Object.freeze({
        id: newDeliveryId(),
        notificationId: notification.id,
        userId: notification.recipient.userId,
        channel,
        state: "pending",
        attempts: Object.freeze([]),
        providerId: null,
        providerMessageId: null,
        nextAttemptAt: notification.schedule.notBefore,
        suppression: null,
        createdAt: at,
        updatedAt: at,
      });
      await this.deliveries.put(delivery);
      created.push(delivery);
    }
    this.metrics.inc(NCP_METRIC.queued, created.length);
    this.events.emit({
      kind: "NotificationQueued",
      at,
      userId: notification.recipient.userId,
      notificationId: notification.id,
      payload: { channels: notification.channels.length },
    });
    await this.options.ports.outbox?.enqueue("ncp.notification.queued", {
      notificationId: notification.id,
      channels: [...notification.channels],
    });
    return Object.freeze(created);
  }

  /* -------------------------------------------------------------- dispatch */

  /** Sends every delivery that is due. Safe to call repeatedly (idempotent). */
  async dispatchDue(now?: number): Promise<readonly Delivery[]> {
    const at = now ?? this.clock();
    const due = (await this.deliveries.where(
      (d) =>
        (d.state === "pending" || d.state === "failed") &&
        (d.nextAttemptAt === null || d.nextAttemptAt <= at),
    )).slice(0, this.config.maxBatchSize);

    const results: Delivery[] = [];
    for (const delivery of [...due].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))) {
      results.push(await this.dispatchOne(delivery, at));
    }
    return Object.freeze(results);
  }

  private async dispatchOne(delivery: Delivery, at: number): Promise<Delivery> {
    const notification = await this.notifications.get(delivery.notificationId);
    if (!notification) throw new UnknownNotificationError(delivery.notificationId);

    if (notification.schedule.expiresAt !== null && notification.schedule.expiresAt <= at) {
      return this.settleDelivery(delivery, { ...delivery, state: "skipped", updatedAt: at });
    }

    const adapter = this.channels.get(delivery.channel);
    const attemptNumber = delivery.attempts.length + 1;

    if (!adapter) {
      return this.handleFailure(notification, delivery, attemptNumber, "permanent", "no channel adapter", at, 0);
    }

    let message;
    try {
      message = renderTemplate({
        template: this.templates.resolve(notification.templateId, notification.recipient.locale),
        channel: delivery.channel,
        variables: notification.variables,
        actions: notification.actions,
        maxBodyLength: this.config.maxBodyLength,
      });
      this.metrics.inc(NCP_METRIC.rendered);
    } catch (error) {
      this.metrics.inc(NCP_METRIC.renderFailed);
      return this.handleFailure(
        notification, delivery, attemptNumber, "render_error", String(error), at, 0,
      );
    }

    const started = this.clock();
    const result = await adapter.send({
      notificationId: notification.id,
      deliveryId: delivery.id,
      userId: notification.recipient.userId,
      channel: delivery.channel,
      recipient: notification.recipient,
      message,
      priority: notification.priority,
      attempt: attemptNumber,
      at,
    });
    const durationMs = result.durationMs || Math.max(0, this.clock() - started);
    this.metrics.observe(NCP_METRIC.sendLatency, durationMs);

    if (!result.ok) {
      return this.handleFailure(
        notification,
        delivery,
        attemptNumber,
        result.failureKind ?? "provider_error",
        result.detail ?? "send failed",
        at,
        durationMs,
      );
    }

    const attempt: DeliveryAttempt = Object.freeze({
      attempt: attemptNumber,
      at,
      ok: true,
      providerId: result.providerId,
      failureKind: null,
      detail: null,
      durationMs,
    });

    if (delivery.channel === "in_app") {
      await this.inbox.add(makeInAppItem(notification, message, at));
    }

    const sent: Delivery = Object.freeze({
      ...delivery,
      state: "sent",
      attempts: Object.freeze([...delivery.attempts, attempt]),
      providerId: result.providerId,
      providerMessageId: result.providerMessageId,
      nextAttemptAt: null,
      updatedAt: at,
    });
    await this.deliveries.put(sent);
    this.metrics.inc(NCP_METRIC.sent);
    this.events.emit({
      kind: "NotificationSent",
      at,
      userId: notification.recipient.userId,
      notificationId: notification.id,
      channel: delivery.channel,
      payload: { providerId: result.providerId, attempt: attemptNumber },
    });
    await this.refreshNotificationState(notification, at);
    return sent;
  }

  private async handleFailure(
    notification: Notification,
    delivery: Delivery,
    attemptNumber: number,
    failureKind: DeliveryAttempt["failureKind"] extends null ? never : NonNullable<DeliveryAttempt["failureKind"]>,
    detail: string,
    at: number,
    durationMs: number,
  ): Promise<Delivery> {
    const attempt: DeliveryAttempt = Object.freeze({
      attempt: attemptNumber,
      at,
      ok: false,
      providerId: null,
      failureKind,
      detail,
      durationMs,
    });
    const attempts = Object.freeze([...delivery.attempts, attempt]);
    const retry = decideRetry({
      config: this.config.retry,
      attempt: attemptNumber,
      failureKind,
      at,
      seed: delivery.id,
    });

    this.metrics.inc(NCP_METRIC.failed);
    this.events.emit({
      kind: "NotificationFailed",
      at,
      userId: delivery.userId,
      notificationId: delivery.notificationId,
      channel: delivery.channel,
      payload: { failureKind, attempt: attemptNumber, detail },
    });

    if (retry.retry) {
      const next: Delivery = Object.freeze({
        ...delivery,
        state: "failed",
        attempts,
        nextAttemptAt: retry.nextAttemptAt,
        updatedAt: at,
      });
      await this.deliveries.put(next);
      this.metrics.inc(NCP_METRIC.retried);
      this.events.emit({
        kind: "NotificationRetryScheduled",
        at,
        userId: delivery.userId,
        notificationId: delivery.notificationId,
        channel: delivery.channel,
        payload: { nextAttemptAt: retry.nextAttemptAt, attempt: retry.attempt },
      });
      return next;
    }

    const dead: Delivery = Object.freeze({
      ...delivery,
      state: this.config.deadLetterEnabled ? "dead_lettered" : "failed",
      attempts,
      nextAttemptAt: null,
      updatedAt: at,
    });
    await this.deliveries.put(dead);
    if (this.config.deadLetterEnabled) {
      await this.deadLetters.record({ delivery: dead, failureKind, reason: retry.reason, at });
      this.metrics.inc(NCP_METRIC.deadLettered);
      this.events.emit({
        kind: "NotificationDeadLettered",
        at,
        userId: delivery.userId,
        notificationId: delivery.notificationId,
        channel: delivery.channel,
        payload: { failureKind, attempts: attempts.length },
      });
      await this.options.ports.outbox?.enqueue("ncp.notification.dead_lettered", {
        notificationId: delivery.notificationId,
        channel: delivery.channel,
      });
    }
    await this.refreshNotificationState(notification, at);
    return dead;
  }

  private async settleDelivery(previous: Delivery, next: Delivery): Promise<Delivery> {
    const frozen = Object.freeze({ ...next });
    await this.deliveries.put(frozen);
    return frozen;
  }

  private async refreshNotificationState(notification: Notification, at: number): Promise<Notification> {
    const deliveries = await this.deliveries.where((d) => d.notificationId === notification.id);
    const state = aggregateState(notification.state, deliveries.map((d) => d.state));
    if (state === notification.state) return notification;
    const next = Object.freeze({ ...notification, state, updatedAt: at });
    await this.notifications.put(next);
    return next;
  }

  /* --------------------------------------------------------------- digests */

  async flushDigests(now?: number): Promise<readonly DigestBucket[]> {
    const at = now ?? this.clock();
    const flushed: DigestBucket[] = [];
    for (const bucket of await this.digests.due(at)) {
      for (const id of bucket.notificationIds) {
        const notification = await this.notifications.get(id);
        if (!notification || notification.state !== "scheduled") continue;
        const queued = Object.freeze({ ...notification, state: "queued" as const, updatedAt: at });
        await this.notifications.put(queued);
        await this.enqueueDeliveries(queued, at);
      }
      flushed.push(await this.digests.flush(bucket, at));
      this.metrics.inc(NCP_METRIC.digestFlushed);
      this.events.emit({
        kind: "DigestFlushed",
        at,
        userId: bucket.userId,
        notificationId: null,
        payload: { key: bucket.key, size: bucket.notificationIds.length },
      });
    }
    return Object.freeze(flushed);
  }

  /* ------------------------------------------------------------ dead letter */

  async replayDeadLetter(id: string, now?: number): Promise<Delivery | undefined> {
    const at = now ?? this.clock();
    const entry = await this.deadLetters.markReplayed(id, at);
    if (!entry) return undefined;
    const delivery = await this.deliveries.get(entry.deliveryId);
    if (!delivery) return undefined;
    const revived = Object.freeze({
      ...delivery,
      state: "pending" as const,
      attempts: Object.freeze([]),
      nextAttemptAt: at,
      updatedAt: at,
    });
    await this.deliveries.put(revived);
    return revived;
  }

  /* ----------------------------------------------------------------- reads */

  async markRead(userId: string, itemId: string, now?: number): Promise<InAppItem | undefined> {
    const at = now ?? this.clock();
    const item = await this.inbox.markRead(userId, itemId, at);
    if (!item) return undefined;
    const notification = await this.notifications.get(item.notificationId);
    if (notification && notification.readAt === null) {
      await this.notifications.put(
        Object.freeze({ ...notification, readAt: at, state: "read" as const, updatedAt: at }),
      );
    }
    this.metrics.inc(NCP_METRIC.read);
    this.events.emit({
      kind: "NotificationRead",
      at,
      userId,
      notificationId: item.notificationId,
      channel: "in_app",
    });
    return item;
  }

  async listInbox(userId: string): Promise<readonly InAppItem[]> {
    return this.inbox.list(userId);
  }
  async unreadCount(userId: string): Promise<number> {
    return this.inbox.unreadCount(userId);
  }
  async getNotification(id: string): Promise<Notification | undefined> {
    return this.notifications.get(id);
  }
  async listNotifications(userId: string): Promise<readonly Notification[]> {
    const items = await this.notifications.where((n) => n.recipient.userId === userId);
    return Object.freeze([...items].sort((a, b) => b.createdAt - a.createdAt));
  }
  async listDeliveries(notificationId: string): Promise<readonly Delivery[]> {
    return this.deliveries.where((d) => d.notificationId === notificationId);
  }

  async cancel(notificationId: string, now?: number): Promise<Notification | undefined> {
    const at = now ?? this.clock();
    const notification = await this.notifications.get(notificationId);
    if (!notification) return undefined;
    const next = Object.freeze({ ...notification, state: "cancelled" as const, updatedAt: at });
    await this.notifications.put(next);
    for (const delivery of await this.listDeliveries(notificationId)) {
      if (delivery.state === "pending" || delivery.state === "failed") {
        await this.deliveries.put(Object.freeze({ ...delivery, state: "skipped" as const, updatedAt: at }));
      }
    }
    this.events.emit({ kind: "NotificationCancelled", at, userId: notification.recipient.userId, notificationId });
    return next;
  }

  /* -------------------------------------------------------------- plumbing */

  private async audit(notification: Notification, action: "create" | "update"): Promise<void> {
    if (!this.config.auditEnabled) return;
    await this.options.ports.audit?.record({
      actorId: this.options.ports.agent?.currentActorId() ?? null,
      ownerId: notification.recipient.userId,
      action,
      collection: NOTIFICATION_COLLECTIONS.notifications,
      recordId: notification.id,
      before: null,
      after: redact({
        type: notification.type,
        category: notification.category,
        state: notification.state,
      }),
    });
    await this.options.ports.eventStore?.append({
      stream: `ncp:${notification.recipient.userId}`,
      eventType: `Notification${action === "create" ? "Created" : "Updated"}`,
      payload: { notificationId: notification.id, type: notification.type },
      ownerId: notification.recipient.userId,
    });
  }

  async snapshot(): Promise<NotificationSnapshot> {
    return Object.freeze({
      notifications: await this.notifications.count(),
      deliveries: await this.deliveries.count(),
      inApp: (await this.inbox.list("*", { includeArchived: true })).length,
      deadLetters: (await this.deadLetters.list()).length,
      digests: (await this.digests.due(Number.MAX_SAFE_INTEGER)).length,
      templates: this.templates.size,
      at: this.clock(),
    });
  }
}
