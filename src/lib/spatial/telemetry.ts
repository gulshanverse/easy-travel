/** Spatial Intelligence Engine — telemetry sink interface. */
export interface SpatialTelemetrySink {
  trace(name: string, attributes?: Record<string, string | number | boolean>): void;
  log(level: "debug" | "info" | "warn" | "error", message: string, meta?: Record<string, unknown>): void;
  metric(name: string, value: number, tags?: Record<string, string>): void;
}

export const noopSpatialTelemetry: SpatialTelemetrySink = Object.freeze({
  trace() { /* noop */ },
  log() { /* noop */ },
  metric() { /* noop */ },
});
