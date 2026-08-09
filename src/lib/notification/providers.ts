/**
 * NCP — deterministic mock channel adapters (ADR-030).
 *
 * Mock providers are first-class: they are the reference implementation the
 * platform is verified against, and they behave identically on every run.
 */
import { fingerprint } from "./ids";
import { fail, ok, type ChannelAdapter, type ChannelSendRequest, type ChannelSendResult } from "./channels";
import { isValidEmail, isValidPhone, maskAddress } from "./security";
import type { FailureKind, NotificationChannel, NotificationRecipient } from "./types";

export interface MockAdapterOptions {
  readonly id?: string;
  /** Deterministic failure injection: fails when hash(seed) % modulus === 0. */
  readonly failEvery?: number;
  readonly failureKind?: FailureKind;
  readonly healthy?: boolean;
  readonly latencyMs?: number;
}

export interface SentRecord {
  readonly channel: NotificationChannel;
  readonly notificationId: string;
  readonly userId: string;
  readonly address: string | null;
  readonly subject: string | null;
  readonly body: string;
  readonly at: number;
}

abstract class BaseMockAdapter implements ChannelAdapter {
  readonly id: string;
  abstract readonly channel: NotificationChannel;
  readonly sent: SentRecord[] = [];

  constructor(protected readonly options: MockAdapterOptions = {}) {
    this.id = options.id ?? "mock";
  }

  abstract addressable(recipient: NotificationRecipient): boolean;
  protected abstract address(recipient: NotificationRecipient): string | null;

  protected injectedFailure(request: ChannelSendRequest): ChannelSendResult | null {
    const every = this.options.failEvery ?? 0;
    if (every <= 0) return null;
    const hash = parseInt(fingerprint(`${this.id}:${request.notificationId}:${request.attempt}`), 16);
    if (hash % every !== 0) return null;
    return fail(
      this.id,
      this.options.failureKind ?? "transient",
      "injected mock failure",
      this.options.latencyMs ?? 0,
    );
  }

  async send(request: ChannelSendRequest): Promise<ChannelSendResult> {
    const address = this.address(request.recipient);
    if (!this.addressable(request.recipient)) {
      return fail(this.id, "invalid_recipient", `no usable ${this.channel} address`);
    }
    const injected = this.injectedFailure(request);
    if (injected) return injected;
    this.sent.push(
      Object.freeze({
        channel: this.channel,
        notificationId: request.notificationId,
        userId: request.userId,
        address: maskAddress(address),
        subject: request.message.subject,
        body: request.message.body,
        at: request.at,
      }),
    );
    return ok(
      this.id,
      `${this.id}_${fingerprint(`${request.deliveryId}:${request.attempt}`)}`,
      this.options.latencyMs ?? 0,
    );
  }

  async healthy(): Promise<boolean> {
    return this.options.healthy ?? true;
  }

  clear(): void {
    this.sent.length = 0;
  }
}

export class MockInAppAdapter extends BaseMockAdapter {
  readonly channel = "in_app" as const;
  constructor(options: MockAdapterOptions = {}) {
    super({ id: "mock.in_app", ...options });
  }
  addressable(): boolean {
    return true;
  }
  protected address(recipient: NotificationRecipient): string | null {
    return recipient.userId;
  }
}

export class MockEmailAdapter extends BaseMockAdapter {
  readonly channel = "email" as const;
  constructor(options: MockAdapterOptions = {}) {
    super({ id: "mock.email", ...options });
  }
  addressable(recipient: NotificationRecipient): boolean {
    return Boolean(recipient.emailAddress && isValidEmail(recipient.emailAddress));
  }
  protected address(recipient: NotificationRecipient): string | null {
    return recipient.emailAddress;
  }
}

export class MockPushAdapter extends BaseMockAdapter {
  readonly channel = "push" as const;
  constructor(options: MockAdapterOptions = {}) {
    super({ id: "mock.push", ...options });
  }
  addressable(recipient: NotificationRecipient): boolean {
    return recipient.pushTokens.length > 0;
  }
  protected address(recipient: NotificationRecipient): string | null {
    return recipient.pushTokens[0] ?? null;
  }
}

export class MockSmsAdapter extends BaseMockAdapter {
  readonly channel = "sms" as const;
  constructor(options: MockAdapterOptions = {}) {
    super({ id: "mock.sms", ...options });
  }
  addressable(recipient: NotificationRecipient): boolean {
    return Boolean(recipient.phoneNumber && isValidPhone(recipient.phoneNumber));
  }
  protected address(recipient: NotificationRecipient): string | null {
    return recipient.phoneNumber;
  }
}

export function mockChannelAdapters(options: MockAdapterOptions = {}): readonly ChannelAdapter[] {
  return Object.freeze([
    new MockInAppAdapter(options),
    new MockEmailAdapter(options),
    new MockPushAdapter(options),
    new MockSmsAdapter(options),
  ]);
}
