/**
 * IAM Platform — Security Event Store & Transactional Outbox integration.
 *
 * Security events are appended to the P-1.1 Event Store (append-only,
 * sequenced) and, when asynchronous delivery is required, enqueued in the
 * P-1.1 Outbox. IAM implements NO email/SMS/push provider — only the
 * reliable-delivery contract.
 */
import { redact } from "./audit";
import type { IamEvent, IamEventBus, IamEventKind } from "./events";
import type { IamEventStorePort, IamOutboxPort } from "./ports";

/** Envelope persisted for every security event. Never contains secrets. */
export interface SecurityEventEnvelope {
  readonly eventId: string;
  readonly timestamp: number;
  readonly actor: string | null;
  readonly subject: string | null;
  readonly correlationId: string;
  readonly causationId: string | null;
  readonly version: number;
  readonly kind: IamEventKind;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export const SECURITY_EVENT_VERSION = 1;

/** Events whose downstream delivery must survive a crash (email, push, SIEM). */
export const DELIVERABLE_SECURITY_EVENTS: readonly IamEventKind[] = Object.freeze([
  "LoginFailed",
  "AccountLocked",
  "AccountUnlocked",
  "AccountSuspended",
  "AccountDisabled",
  "PasswordChanged",
  "PasswordResetRequested",
  "PasswordResetCompleted",
  "DeviceRegistered",
  "DeviceRevoked",
  "ApiKeyCreated",
  "ApiKeyRotated",
  "SecurityRiskDetected",
  "SuspiciousLoginDetected",
]);

export function toEnvelope(event: IamEvent): SecurityEventEnvelope {
  return Object.freeze({
    eventId: event.id,
    timestamp: event.at,
    actor: event.actorId,
    subject: event.subjectId,
    correlationId: event.correlationId,
    causationId: event.causationId,
    version: event.version,
    kind: event.kind,
    metadata: redact(event.payload) ?? Object.freeze({}),
  });
}

export interface SecurityEventPublisherOptions {
  readonly eventStore?: IamEventStorePort;
  readonly outbox?: IamOutboxPort;
  readonly deliverable?: readonly IamEventKind[];
  readonly topic?: string;
  readonly onError?: (error: unknown, event: IamEvent) => void;
}

/**
 * Subscribes to the IAM event bus and mirrors every event into the Event
 * Store, plus the Outbox for delivery-bearing kinds.
 */
export class SecurityEventPublisher {
  private readonly deliverable: ReadonlySet<IamEventKind>;
  private readonly topic: string;
  private readonly pending: Promise<unknown>[] = [];
  private unsubscribe: (() => void) | null = null;

  constructor(private readonly options: SecurityEventPublisherOptions = {}) {
    this.deliverable = new Set(options.deliverable ?? DELIVERABLE_SECURITY_EVENTS);
    this.topic = options.topic ?? "iam.security";
  }

  attach(bus: IamEventBus): () => void {
    this.unsubscribe?.();
    this.unsubscribe = bus.on((event) => {
      this.pending.push(
        this.publish(event).catch((error) => this.options.onError?.(error, event)),
      );
    });
    return () => this.detach();
  }

  detach(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  /** Awaits every in-flight publish; used by tests and graceful shutdown. */
  async flush(): Promise<void> {
    while (this.pending.length) {
      const batch = this.pending.splice(0, this.pending.length);
      await Promise.all(batch);
    }
  }

  async publish(event: IamEvent): Promise<SecurityEventEnvelope> {
    const envelope = toEnvelope(event);
    if (this.options.eventStore) {
      await this.options.eventStore.append({
        stream: `iam:${event.subjectId ?? "anonymous"}`,
        eventType: event.kind,
        payload: envelope as unknown as Readonly<Record<string, unknown>>,
        ownerId: event.subjectId,
      });
    }
    if (this.options.outbox && this.deliverable.has(event.kind)) {
      await this.options.outbox.enqueue(
        `${this.topic}.${event.kind}`,
        envelope as unknown as Readonly<Record<string, unknown>>,
      );
    }
    return envelope;
  }
}
