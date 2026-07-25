/** IPCF — telemetry sink (structured logging + tracing). */
export interface IntegrationTelemetrySpan {
  readonly name: string;
  readonly attributes: Readonly<Record<string, unknown>>;
  end(status?: "ok" | "error", error?: Error): void;
}
export interface IntegrationTelemetrySink {
  startSpan(name: string, attributes?: Record<string, unknown>): IntegrationTelemetrySpan;
  log(level: "debug" | "info" | "warn" | "error", message: string, attributes?: Record<string, unknown>): void;
  event(name: string, attributes?: Record<string, unknown>): void;
}
export const noopIntegrationTelemetry: IntegrationTelemetrySink = {
  startSpan(name, attributes = {}) {
    return { name, attributes: Object.freeze({ ...attributes }), end() { /* no-op */ } };
  },
  log() { /* no-op */ },
  event() { /* no-op */ },
};
