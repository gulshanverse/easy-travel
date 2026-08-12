/** Provider Gateway (P-1.4) — metrics, telemetry and events.
 *  Secrets, raw auth headers and unnecessary PII are never recorded.
 */
import { newGatewayEventId } from "./ids";
import { redactObject } from "./security";
import type { ProviderCapabilityId, ProviderId, ProviderLatency } from "./types";

/* ------------------------------------------------------------------ */
/* Metrics                                                             */
/* ------------------------------------------------------------------ */

export interface ProviderMetricRow {
  requests: number;
  successes: number;
  failures: number;
  timeouts: number;
  retries: number;
  circuitOpens: number;
  rateLimited: number;
  fallbacks: number;
  cacheHits: number;
  cacheMisses: number;
  credentialFailures: number;
  budgetRejections: number;
  latencies: number[];
}

function emptyRow(): ProviderMetricRow {
  return {
    requests: 0,
    successes: 0,
    failures: 0,
    timeouts: 0,
    retries: 0,
    circuitOpens: 0,
    rateLimited: 0,
    fallbacks: 0,
    cacheHits: 0,
    cacheMisses: 0,
    credentialFailures: 0,
    budgetRejections: 0,
    latencies: [],
  };
}

export function percentiles(samples: readonly number[]): ProviderLatency {
  if (samples.length === 0) return { p50: 0, p95: 0, p99: 0, samples: 0 };
  const sorted = [...samples].sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
  return { p50: at(0.5), p95: at(0.95), p99: at(0.99), samples: sorted.length };
}

export interface ProviderMetricsSnapshot {
  readonly providerId: ProviderId;
  readonly requests: number;
  readonly successRate: number;
  readonly failureRate: number;
  readonly availability: number;
  readonly timeouts: number;
  readonly retries: number;
  readonly circuitOpens: number;
  readonly rateLimited: number;
  readonly fallbacks: number;
  readonly cacheHitRate: number;
  readonly credentialFailures: number;
  readonly budgetRejections: number;
  readonly latency: ProviderLatency;
}

/** Bounded metric storage — latency samples are capped to keep memory flat. */
const MAX_SAMPLES = 2_000;

export class ProviderMetrics {
  private rows = new Map<ProviderId, ProviderMetricRow>();

  private row(providerId: ProviderId): ProviderMetricRow {
    let r = this.rows.get(providerId);
    if (!r) {
      r = emptyRow();
      this.rows.set(providerId, r);
    }
    return r;
  }

  record(providerId: ProviderId, field: keyof Omit<ProviderMetricRow, "latencies">, by = 1): void {
    this.row(providerId)[field] += by;
  }

  observeLatency(providerId: ProviderId, ms: number): void {
    const r = this.row(providerId);
    r.latencies.push(ms);
    if (r.latencies.length > MAX_SAMPLES) r.latencies.splice(0, r.latencies.length - MAX_SAMPLES);
  }

  snapshot(providerId: ProviderId): ProviderMetricsSnapshot {
    const r = this.row(providerId);
    const total = r.successes + r.failures;
    const cacheTotal = r.cacheHits + r.cacheMisses;
    return Object.freeze({
      providerId,
      requests: r.requests,
      successRate: total === 0 ? 0 : r.successes / total,
      failureRate: total === 0 ? 0 : r.failures / total,
      availability: total === 0 ? 1 : r.successes / total,
      timeouts: r.timeouts,
      retries: r.retries,
      circuitOpens: r.circuitOpens,
      rateLimited: r.rateLimited,
      fallbacks: r.fallbacks,
      cacheHitRate: cacheTotal === 0 ? 0 : r.cacheHits / cacheTotal,
      credentialFailures: r.credentialFailures,
      budgetRejections: r.budgetRejections,
      latency: percentiles(r.latencies),
    });
  }

  all(): readonly ProviderMetricsSnapshot[] {
    return [...this.rows.keys()].sort().map((id) => this.snapshot(id));
  }

  reset(): void {
    this.rows.clear();
  }
}

/* ------------------------------------------------------------------ */
/* Telemetry                                                           */
/* ------------------------------------------------------------------ */

export interface GatewaySpan {
  readonly name: string;
  readonly providerId?: ProviderId;
  readonly capability?: ProviderCapabilityId;
  readonly correlationId: string;
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly startedAt: number;
  end(outcome: "ok" | "error", attributes?: Readonly<Record<string, unknown>>): void;
}

export interface GatewayTelemetrySink {
  span(input: {
    name: string;
    providerId?: ProviderId;
    capability?: ProviderCapabilityId;
    correlationId: string;
    attributes?: Readonly<Record<string, unknown>>;
  }): GatewaySpan;
}

export const noopGatewayTelemetry: GatewayTelemetrySink = {
  span(input) {
    return {
      name: input.name,
      ...(input.providerId ? { providerId: input.providerId } : {}),
      ...(input.capability ? { capability: input.capability } : {}),
      correlationId: input.correlationId,
      attributes: Object.freeze(redactObject(input.attributes ?? {}) as Record<string, unknown>),
      startedAt: Date.now(),
      end() {
        /* noop */
      },
    };
  },
};

export class RecordingTelemetrySink implements GatewayTelemetrySink {
  readonly spans: {
    name: string;
    correlationId: string;
    outcome?: string;
    attributes: Record<string, unknown>;
  }[] = [];

  span(input: {
    name: string;
    providerId?: ProviderId;
    capability?: ProviderCapabilityId;
    correlationId: string;
    attributes?: Readonly<Record<string, unknown>>;
  }): GatewaySpan {
    const entry = {
      name: input.name,
      correlationId: input.correlationId,
      attributes: redactObject(input.attributes ?? {}) as Record<string, unknown>,
    } as { name: string; correlationId: string; outcome?: string; attributes: Record<string, unknown> };
    this.spans.push(entry);
    return {
      name: input.name,
      ...(input.providerId ? { providerId: input.providerId } : {}),
      ...(input.capability ? { capability: input.capability } : {}),
      correlationId: input.correlationId,
      attributes: Object.freeze(entry.attributes),
      startedAt: Date.now(),
      end(outcome, attributes) {
        entry.outcome = outcome;
        Object.assign(entry.attributes, redactObject(attributes ?? {}) as object);
      },
    };
  }

  clear(): void {
    this.spans.length = 0;
  }
}

/* ------------------------------------------------------------------ */
/* Events                                                              */
/* ------------------------------------------------------------------ */

export type GatewayEventName =
  | "ProviderRegistered"
  | "ProviderCapabilityRegistered"
  | "ProviderHealthChanged"
  | "ProviderRequestStarted"
  | "ProviderRequestCompleted"
  | "ProviderRequestFailed"
  | "ProviderRetryStarted"
  | "ProviderCircuitOpened"
  | "ProviderCircuitClosed"
  | "ProviderRateLimited"
  | "ProviderFallbackUsed"
  | "ProviderCredentialRotated"
  | "ProviderWebhookReceived"
  | "ProviderWebhookProcessed"
  | "ProviderPollingStarted"
  | "ProviderPollingCompleted";

export interface GatewayEvent {
  readonly eventId: string;
  readonly name: GatewayEventName;
  readonly timestamp: number;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly version: number;
  readonly providerId?: ProviderId;
  readonly capabilityId?: ProviderCapabilityId;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export function createGatewayEvent(input: {
  name: GatewayEventName;
  correlationId: string;
  causationId?: string;
  providerId?: ProviderId;
  capabilityId?: ProviderCapabilityId;
  metadata?: Readonly<Record<string, unknown>>;
}): GatewayEvent {
  return Object.freeze({
    eventId: newGatewayEventId(),
    name: input.name,
    timestamp: Date.now(),
    correlationId: input.correlationId,
    ...(input.causationId ? { causationId: input.causationId } : {}),
    version: 1,
    ...(input.providerId ? { providerId: input.providerId } : {}),
    ...(input.capabilityId ? { capabilityId: input.capabilityId } : {}),
    // Safe metadata only — deep-redacted, never secrets.
    metadata: Object.freeze(redactObject(input.metadata ?? {}) as Record<string, unknown>),
  });
}

export class GatewayEventBus {
  private handlers: ((e: GatewayEvent) => void)[] = [];
  readonly recorded: GatewayEvent[] = [];
  private maxRecorded = 5_000;

  subscribe(handler: (e: GatewayEvent) => void): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  publish(event: GatewayEvent): void {
    this.recorded.push(event);
    if (this.recorded.length > this.maxRecorded)
      this.recorded.splice(0, this.recorded.length - this.maxRecorded);
    for (const h of this.handlers) h(event);
  }

  byName(name: GatewayEventName): readonly GatewayEvent[] {
    return this.recorded.filter((e) => e.name === name);
  }

  clear(): void {
    this.recorded.length = 0;
  }
}
