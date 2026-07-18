/** Spatial Intelligence Engine — SpatialFactory. */
import type { SpatialConfig } from "./config";
import { SpatialEventBus } from "./events";
import { SpatialManager } from "./manager";
import { SpatialMetrics } from "./metrics";
import { noopSpatialTelemetry, type SpatialTelemetrySink } from "./telemetry";

export interface CreateSpatialManagerInput {
  readonly config: SpatialConfig;
  readonly telemetry?: SpatialTelemetrySink;
  readonly events?: SpatialEventBus;
  readonly metrics?: SpatialMetrics;
  readonly now?: () => number;
}

export function createSpatialManager(input: CreateSpatialManagerInput): SpatialManager {
  return new SpatialManager({
    config: input.config,
    telemetry: input.telemetry ?? noopSpatialTelemetry,
    events: input.events ?? new SpatialEventBus(),
    metrics: input.metrics ?? new SpatialMetrics(),
    now: input.now,
  });
}
