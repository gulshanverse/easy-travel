/** JSR — telemetry sink. */
export interface StudioTelemetrySpan {
  readonly name: string;
  readonly attributes: Readonly<Record<string, unknown>>;
  end(status?: "ok" | "error", error?: Error): void;
}
export interface StudioTelemetrySink {
  startSpan(name: string, attributes?: Record<string, unknown>): StudioTelemetrySpan;
  event(name: string, attributes?: Record<string, unknown>): void;
}
export const noopStudioTelemetry: StudioTelemetrySink = {
  startSpan(name, attributes = {}) {
    return { name, attributes: Object.freeze({ ...attributes }), end() { /* no-op */ } };
  },
  event() { /* no-op */ },
};
