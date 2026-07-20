/** CTOR — telemetry sink. */
export interface CTORTelemetryRecord {
  readonly kind: "trace" | "log" | "diagnostic";
  readonly level?: "debug" | "info" | "warn" | "error";
  readonly message: string;
  readonly attributes?: Readonly<Record<string, unknown>>;
  readonly timestamp: number;
}
export interface CTORTelemetrySink {
  record(r: CTORTelemetryRecord): void;
}
export const noopCTORTelemetry: CTORTelemetrySink = { record() { /* noop */ } };

export class InMemoryCTORTelemetry implements CTORTelemetrySink {
  readonly records: CTORTelemetryRecord[] = [];
  record(r: CTORTelemetryRecord): void { this.records.push(r); }
  clear(): void { this.records.length = 0; }
}
