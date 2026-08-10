/**
 * NCP — NotificationRuntime facade. The ONLY sanctioned entry point
 * outside this package.
 */
import { ChannelRegistry, type ChannelAdapter } from "./channels";
import {
  assertProductionNotificationConfig,
  createNotificationConfig,
  type NotificationConfig,
} from "./config";
import { NotificationEventBus, type NotificationEventListener } from "./events";
import { NotificationManager, type NotifyInput } from "./manager";
import { NotificationMetrics, type NotificationMetricsSnapshot } from "./metrics";
import type { NotificationPorts } from "./ports";
import { BUILT_IN_TEMPLATES } from "./catalog";
import { TemplateRegistry, type NotificationTemplate } from "./templates";
import { noopNotificationTelemetry, type NotificationTelemetrySink } from "./telemetry";
import type {
  Delivery,
  InAppItem,
  Notification,
  NotificationCategory,
  NotificationSnapshot,
} from "./types";
import type { SubscriptionRecord } from "./subscriptions";
import type { TemplateVersionRecord } from "./versioning";

export interface NotificationHealthCheck {
  readonly name: string;
  readonly healthy: boolean;
  readonly detail?: string;
}

export interface NotificationHealthReport {
  readonly healthy: boolean;
  readonly checks: readonly NotificationHealthCheck[];
  readonly at: number;
}

export interface NotificationRuntimeOptions {
  readonly config?: Partial<NotificationConfig>;
  readonly ports: NotificationPorts;
  readonly telemetry?: NotificationTelemetrySink;
  readonly adapters?: readonly ChannelAdapter[];
  readonly templates?: readonly NotificationTemplate[];
  readonly now?: () => number;
}

export class NotificationRuntime {
  readonly config: NotificationConfig;
  readonly events = new NotificationEventBus();
  readonly metrics = new NotificationMetrics();
  readonly manager: NotificationManager;

  constructor(options: NotificationRuntimeOptions) {
    this.config = createNotificationConfig(options.config ?? {});
    assertProductionNotificationConfig(this.config);
    this.manager = new NotificationManager({
      config: this.config,
      ports: options.ports,
      events: this.events,
      metrics: this.metrics,
      telemetry: options.telemetry ?? noopNotificationTelemetry,
      templates: new TemplateRegistry(this.config.fallbackLocale, [
        ...BUILT_IN_TEMPLATES,
        ...(options.templates ?? []),
      ]),
      channels: new ChannelRegistry(options.adapters ?? []),
      now: options.now,
    });
  }

  on(listener: NotificationEventListener): () => void {
    return this.events.on(listener);
  }

  get templates(): TemplateRegistry {
    return this.manager.templates;
  }
  get channels(): ChannelRegistry {
    return this.manager.channels;
  }

  notify(input: NotifyInput): Promise<Notification> {
    return this.manager.notify(input);
  }
  dispatchDue(now?: number): Promise<readonly Delivery[]> {
    return this.manager.dispatchDue(now);
  }
  flushDigests(now?: number) {
    return this.manager.flushDigests(now);
  }
  inbox(userId: string): Promise<readonly InAppItem[]> {
    return this.manager.listInbox(userId);
  }
  unreadCount(userId: string): Promise<number> {
    return this.manager.unreadCount(userId);
  }
  markRead(userId: string, itemId: string, now?: number): Promise<InAppItem | undefined> {
    return this.manager.markRead(userId, itemId, now);
  }
  cancel(notificationId: string, now?: number): Promise<Notification | undefined> {
    return this.manager.cancel(notificationId, now);
  }
  deliveries(notificationId: string): Promise<readonly Delivery[]> {
    return this.manager.listDeliveries(notificationId);
  }
  replayDeadLetter(id: string, now?: number): Promise<Delivery | undefined> {
    return this.manager.replayDeadLetter(id, now);
  }
  snapshot(): Promise<NotificationSnapshot> {
    return this.manager.snapshot();
  }
  metricsSnapshot(): NotificationMetricsSnapshot {
    return this.metrics.snapshot();
  }

  /** Persists a version row for every registered template. Idempotent. */
  bootstrap(): Promise<number> {
    return this.manager.publishTemplateVersions();
  }
  registerTemplate(template: NotificationTemplate): Promise<NotificationTemplate> {
    return this.manager.registerTemplate(template);
  }
  templateHistory(templateId: string, locale?: string): Promise<readonly TemplateVersionRecord[]> {
    return this.manager.templateVersions.history(templateId, locale);
  }
  setSubscription(
    userId: string,
    topic: NotificationCategory | string,
    subscribed: boolean,
    now?: number,
  ): Promise<SubscriptionRecord> {
    return this.manager.setSubscription(userId, topic, subscribed, now);
  }
  unsubscribeByToken(
    userId: string,
    topic: NotificationCategory | string,
    token: string,
    now?: number,
  ): Promise<SubscriptionRecord | undefined> {
    return this.manager.unsubscribeByToken(userId, topic, token, now);
  }
  unsubscribeToken(userId: string, topic: NotificationCategory | string): string {
    return this.manager.subscriptions.tokenFor(userId, topic);
  }
  subscriptions(userId: string): Promise<readonly SubscriptionRecord[]> {
    return this.manager.subscriptions.list(userId);
  }

  async health(): Promise<NotificationHealthReport> {
    const checks: NotificationHealthCheck[] = [];
    try {
      const snapshot = await this.manager.snapshot();
      checks.push({
        name: "persistence",
        healthy: true,
        detail: `${snapshot.notifications} notification(s)`,
      });
    } catch (error) {
      checks.push({ name: "persistence", healthy: false, detail: String(error) });
    }
    checks.push({ name: "templates", healthy: this.templates.size > 0 });
    const channelHealth = await this.channels.health();
    for (const [id, healthy] of Object.entries(channelHealth)) {
      checks.push({ name: `channel:${id}`, healthy });
    }
    return Object.freeze({
      healthy: checks.every((c) => c.healthy),
      checks: Object.freeze(checks),
      at: Date.now(),
    });
  }
}

export function createNotificationRuntime(
  options: NotificationRuntimeOptions,
): NotificationRuntime {
  return new NotificationRuntime(options);
}
