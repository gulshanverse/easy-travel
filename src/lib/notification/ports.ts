/**
 * NCP — external subsystem ports (ADR-029/030/031).
 *
 * The platform integrates ONLY with Persistence (P-1.1), Identity/IAM,
 * Workflow, Agent and Studio — and only through the structural shapes below.
 * No provider SDK, transport or vendor type may appear here.
 */
import type {
  NotificationCategory,
  NotificationChannel,
  NotificationPriority,
} from "./types";

export type NotificationDoc = Record<string, unknown>;

/** Minimal repository shape borrowed structurally from the Persistence Platform. */
export interface NotificationRepository<T extends NotificationDoc = NotificationDoc> {
  readonly collection: string;
  save(id: string, data: T, ownerId?: string | null): Promise<unknown>;
  insert(id: string, data: T, ownerId?: string | null): Promise<unknown>;
  findById(id: string, includeDeleted?: boolean): Promise<{ data: T } | null>;
  find(options?: { specification?: unknown; limit?: number }): Promise<readonly { data: T }[]>;
  count(options?: { specification?: unknown }): Promise<number>;
  hardDelete(id: string): Promise<boolean>;
}

export interface NotificationPersistencePort {
  repository<T extends NotificationDoc>(collection: string): NotificationRepository<T>;
}

export interface NotificationAuditPort {
  record(entry: {
    actorId: string | null;
    ownerId: string | null;
    action: "create" | "update" | "delete" | "restore" | "read";
    collection: string;
    recordId: string;
    before: Readonly<Record<string, unknown>> | null;
    after: Readonly<Record<string, unknown>> | null;
  }): Promise<unknown>;
}

export interface NotificationEventStorePort {
  append(input: {
    stream: string;
    eventType: string;
    payload?: Readonly<Record<string, unknown>>;
    ownerId?: string | null;
  }): Promise<unknown>;
}

export interface NotificationOutboxPort {
  enqueue(topic: string, payload?: Readonly<Record<string, unknown>>): Promise<unknown>;
}

/** Recipient resolution. NCP never owns identity data — it reads it. */
export interface NotificationRecipientRecord {
  readonly userId: string;
  readonly locale?: string;
  readonly timezone?: string;
  readonly emailAddress?: string | null;
  readonly phoneNumber?: string | null;
  readonly pushTokens?: readonly string[];
}

/** Preference shape read from the frozen Identity Platform. */
export interface NotificationPreferenceRecord {
  readonly channels: readonly NotificationChannel[];
  readonly categories: Readonly<Partial<Record<NotificationCategory, boolean>>>;
  readonly quietHours: { readonly startHour: number; readonly endHour: number } | null;
  readonly frequency: "instant" | "hourly" | "daily" | "weekly" | "never";
  readonly unsubscribedCategories?: readonly NotificationCategory[];
}

export interface NotificationIdentityPort {
  recipient(userId: string): Promise<NotificationRecipientRecord | null>;
  preferences(userId: string): Promise<NotificationPreferenceRecord | null>;
  /** Privacy suppression (e.g. personalization/marketing consent withdrawn). */
  marketingSuppressed?(userId: string): Promise<boolean>;
}

export interface NotificationWorkflowPort {
  signal(name: string, payload: Readonly<Record<string, unknown>>): Promise<void>;
}

export interface NotificationAgentPort {
  currentActorId(): string | undefined;
}

export interface NotificationStudioPort {
  publishCards(userId: string, cards: readonly unknown[]): void;
}

export interface NotificationPorts {
  readonly persistence?: NotificationPersistencePort;
  readonly audit?: NotificationAuditPort;
  readonly eventStore?: NotificationEventStorePort;
  readonly outbox?: NotificationOutboxPort;
  readonly identity?: NotificationIdentityPort;
  readonly workflow?: NotificationWorkflowPort;
  readonly agent?: NotificationAgentPort;
  readonly studio?: NotificationStudioPort;
}

export const noopNotificationIdentityPort: NotificationIdentityPort = {
  async recipient() {
    return null;
  },
  async preferences() {
    return null;
  },
};

export const noopNotificationWorkflowPort: NotificationWorkflowPort = {
  async signal() {
    /* noop */
  },
};

export const noopNotificationAgentPort: NotificationAgentPort = {
  currentActorId() {
    return undefined;
  },
};

export const noopNotificationStudioPort: NotificationStudioPort = {
  publishCards() {
    /* noop */
  },
};

/** Priority ordering used by schedulers and rate limiters. */
export const PRIORITY_WEIGHT: Readonly<Record<NotificationPriority, number>> = Object.freeze({
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
});
