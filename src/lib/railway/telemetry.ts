/** RICS — structured logging / telemetry sink (no console by default). */
export interface RailwayLogRecord {
  readonly level: "debug" | "info" | "warn" | "error";
  readonly event: string;
  readonly message: string;
  readonly at: number;
  readonly attributes: Readonly<Record<string, unknown>>;
}

export interface RailwayTelemetrySink {
  log(record: RailwayLogRecord): void;
}

export const noopRailwayTelemetry: RailwayTelemetrySink = { log() { /* noop */ } };

export class InMemoryRailwayTelemetry implements RailwayTelemetrySink {
  readonly records: RailwayLogRecord[] = [];
  private limit: number;
  constructor(limit = 1000) { this.limit = limit; }
  log(record: RailwayLogRecord): void {
    this.records.push(record);
    if (this.records.length > this.limit) this.records.shift();
  }
  clear(): void { this.records.length = 0; }
}

export function railLog(
  sink: RailwayTelemetrySink,
  level: RailwayLogRecord["level"],
  event: string,
  message: string,
  attributes: Record<string, unknown> = {},
): void {
  sink.log(Object.freeze({
    level, event, message, at: Date.now(),
    attributes: Object.freeze({ ...attributes }),
  }));
}
