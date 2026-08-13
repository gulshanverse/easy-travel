import { createHash } from "node:crypto";

export interface GatewayWebhookEvent {
  readonly id: string;
  readonly providerId: string;
  readonly timestamp: number;
  readonly signature: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface WebhookReplayStore {
  has(id: string): Promise<boolean>;
  mark(id: string, expiresAt: number): Promise<void>;
}

export class InMemoryWebhookReplayStore implements WebhookReplayStore {
  private readonly ids = new Map<string, number>();
  async has(id: string): Promise<boolean> {
    const expires = this.ids.get(id);
    if (expires === undefined) return false;
    if (expires <= Date.now()) {
      this.ids.delete(id);
      return false;
    }
    return true;
  }
  async mark(id: string, expiresAt: number): Promise<void> {
    this.ids.set(id, expiresAt);
  }
}

export function webhookSignature(payload: string, secret: string): string {
  return createHash("sha256").update(`${secret}:${payload}`).digest("hex");
}

export function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return false;
  return webhookSignature(payload, secret) === signature;
}

export class WebhookReplayGuard {
  constructor(private readonly store: WebhookReplayStore = new InMemoryWebhookReplayStore(), private readonly ttlMs = 10 * 60_000) {}

  async accept(id: string): Promise<boolean> {
    if (await this.store.has(id)) return false;
    await this.store.mark(id, Date.now() + this.ttlMs);
    return true;
  }
}
