/**
 * NCP — channel adapter contract.
 *
 * A channel adapter is the ONLY place a provider may be touched, and it is
 * always injected. The platform ships mock adapters (ADR-030: mock providers
 * are first-class) and never imports a vendor SDK.
 */
import type { NotificationRecipient, NotificationChannel, NotificationPriority, RenderedMessage } from "./types";
import type { FailureKind } from "./types";

export interface ChannelSendRequest {
  readonly notificationId: string;
  readonly deliveryId: string;
  readonly userId: string;
  readonly channel: NotificationChannel;
  readonly recipient: NotificationRecipient;
  readonly message: RenderedMessage;
  readonly priority: NotificationPriority;
  readonly attempt: number;
  readonly at: number;
}

export interface ChannelSendResult {
  readonly ok: boolean;
  readonly providerId: string;
  readonly providerMessageId: string | null;
  readonly failureKind: FailureKind | null;
  readonly detail: string | null;
  readonly durationMs: number;
}

export interface ChannelAdapter {
  readonly id: string;
  readonly channel: NotificationChannel;
  /** True when the recipient has a usable address/token for this channel. */
  addressable(recipient: NotificationRecipient): boolean;
  send(request: ChannelSendRequest): Promise<ChannelSendResult>;
  healthy(): Promise<boolean>;
}

export function ok(
  providerId: string,
  providerMessageId: string,
  durationMs = 0,
): ChannelSendResult {
  return Object.freeze({
    ok: true,
    providerId,
    providerMessageId,
    failureKind: null,
    detail: null,
    durationMs,
  });
}

export function fail(
  providerId: string,
  failureKind: FailureKind,
  detail: string,
  durationMs = 0,
): ChannelSendResult {
  return Object.freeze({
    ok: false,
    providerId,
    providerMessageId: null,
    failureKind,
    detail,
    durationMs,
  });
}

/** Registry of channel adapters. One adapter per channel, replaceable. */
export class ChannelRegistry {
  private readonly adapters = new Map<NotificationChannel, ChannelAdapter>();

  constructor(seed: readonly ChannelAdapter[] = []) {
    for (const adapter of seed) this.register(adapter);
  }

  register(adapter: ChannelAdapter): ChannelAdapter {
    this.adapters.set(adapter.channel, adapter);
    return adapter;
  }

  get(channel: NotificationChannel): ChannelAdapter | undefined {
    return this.adapters.get(channel);
  }

  has(channel: NotificationChannel): boolean {
    return this.adapters.has(channel);
  }

  channels(): readonly NotificationChannel[] {
    return Object.freeze([...this.adapters.keys()].sort());
  }

  list(): readonly ChannelAdapter[] {
    return Object.freeze([...this.adapters.values()].sort((a, b) => a.id.localeCompare(b.id)));
  }

  async health(): Promise<Readonly<Record<string, boolean>>> {
    const entries: [string, boolean][] = [];
    for (const adapter of this.list()) {
      try {
        entries.push([adapter.id, await adapter.healthy()]);
      } catch {
        entries.push([adapter.id, false]);
      }
    }
    return Object.freeze(Object.fromEntries(entries));
  }
}
