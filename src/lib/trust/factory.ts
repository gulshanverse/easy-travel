/**
 * Trust & Evidence Engine — TrustFactory.
 * Constructs a fully-wired TrustManager with default deps.
 */
import { mergeConfig, type TrustConfig } from "./config";
import { TrustEventBus } from "./events";
import { TrustManager } from "./manager";
import { TrustMetrics } from "./metrics";
import { noopTelemetry, type TrustTelemetrySink } from "./telemetry";

export interface TrustFactoryOptions {
  readonly config?: Partial<TrustConfig>;
  readonly telemetry?: TrustTelemetrySink;
  readonly events?: TrustEventBus;
  readonly metrics?: TrustMetrics;
  readonly now?: () => number;
}

export function createTrustManager(options: TrustFactoryOptions = {}): TrustManager {
  return new TrustManager({
    config: mergeConfig(options.config),
    telemetry: options.telemetry ?? noopTelemetry,
    events: options.events ?? new TrustEventBus(),
    metrics: options.metrics ?? new TrustMetrics(),
    now: options.now ?? (() => Date.now()),
  });
}
