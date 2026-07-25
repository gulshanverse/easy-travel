/** IPCF — webhook runtime. In-memory registry + delivery buffer. */
import { IntegrationNotFoundError, IntegrationValidationError } from "./errors";
import { newEventId, newWebhookDeliveryId } from "./ids";
import { assertNonEmpty } from "./validation";
import type {
  NormalizedEvent, WebhookDelivery, WebhookEndpoint,
} from "./types";

export class WebhookRegistry {
  private readonly items = new Map<string, WebhookEndpoint>();
  private readonly byPath = new Map<string, string>();

  register(endpoint: WebhookEndpoint): void {
    assertNonEmpty(endpoint.path, "webhook.path");
    if (this.byPath.has(endpoint.path)) {
      throw new IntegrationValidationError(`webhook path already registered: ${endpoint.path}`);
    }
    this.items.set(endpoint.id, endpoint);
    this.byPath.set(endpoint.path, endpoint.id);
  }
  get(id: string): WebhookEndpoint | undefined { return this.items.get(id); }
  require(id: string): WebhookEndpoint {
    const w = this.items.get(id);
    if (!w) throw new IntegrationNotFoundError("webhook", id);
    return w;
  }
  byPathLookup(path: string): WebhookEndpoint | undefined {
    const id = this.byPath.get(path);
    return id ? this.items.get(id) : undefined;
  }
  list(): readonly WebhookEndpoint[] { return [...this.items.values()]; }
  remove(id: string): boolean {
    const w = this.items.get(id);
    if (!w) return false;
    this.items.delete(id);
    this.byPath.delete(w.path);
    return true;
  }
  clear(): void { this.items.clear(); this.byPath.clear(); }
  size(): number { return this.items.size; }
}

export type WebhookNormalizer = (endpoint: WebhookEndpoint, payload: unknown, headers: Record<string, string>) => NormalizedEvent;

export class WebhookManager {
  private readonly deliveries: WebhookDelivery[] = [];
  constructor(
    private readonly registry: WebhookRegistry,
    private readonly maxDeliveries = 512,
  ) {}

  receive(input: {
    path: string;
    payload: unknown;
    headers?: Record<string, string>;
    normalize?: WebhookNormalizer;
  }): WebhookDelivery {
    const endpoint = this.registry.byPathLookup(input.path);
    if (!endpoint) {
      const failed: WebhookDelivery = Object.freeze({
        id: newWebhookDeliveryId(),
        webhookId: "",
        receivedAt: Date.now(),
        payload: input.payload,
        headers: Object.freeze({ ...(input.headers ?? {}) }),
        ok: false,
        error: `no webhook registered for path ${input.path}`,
      });
      this.push(failed);
      return failed;
    }
    if (!endpoint.enabled) {
      const failed: WebhookDelivery = Object.freeze({
        id: newWebhookDeliveryId(),
        webhookId: endpoint.id,
        receivedAt: Date.now(),
        payload: input.payload,
        headers: Object.freeze({ ...(input.headers ?? {}) }),
        ok: false,
        error: `webhook disabled: ${endpoint.id}`,
      });
      this.push(failed);
      return failed;
    }
    const headers = Object.freeze({ ...(input.headers ?? {}) });
    const normalized = input.normalize
      ? input.normalize(endpoint, input.payload, headers as Record<string, string>)
      : defaultNormalize(endpoint, input.payload);
    const delivery: WebhookDelivery = Object.freeze({
      id: newWebhookDeliveryId(),
      webhookId: endpoint.id,
      receivedAt: Date.now(),
      payload: input.payload,
      headers,
      normalized,
      ok: true,
    });
    this.push(delivery);
    return delivery;
  }
  private push(d: WebhookDelivery): void {
    this.deliveries.push(d);
    if (this.deliveries.length > this.maxDeliveries) {
      this.deliveries.splice(0, this.deliveries.length - this.maxDeliveries);
    }
  }
  history(): readonly WebhookDelivery[] { return [...this.deliveries]; }
  clear(): void { this.deliveries.length = 0; }
}

function defaultNormalize(endpoint: WebhookEndpoint, payload: unknown): NormalizedEvent {
  return Object.freeze({
    id: newEventId(),
    connectorId: endpoint.connectorId,
    kind: "webhook",
    at: Date.now(),
    correlationId: newEventId(),
    payload,
    metadata: Object.freeze({ webhookId: endpoint.id, path: endpoint.path }),
  });
}
