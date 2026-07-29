/** MTIP — structured logging / tracing sink (no console by default). */
export interface MultiModalLogRecord {
  readonly level: "debug" | "info" | "warn" | "error";
  readonly event: string;
  readonly message: string;
  readonly at: number;
  readonly attributes: Readonly<Record<string, unknown>>;
}

export interface MultiModalTelemetrySink {
  log(record: MultiModalLogRecord): void;
}

export const noopMultiModalTelemetry: MultiModalTelemetrySink = { log() { /* noop */ } };

export class InMemoryMultiModalTelemetry implements MultiModalTelemetrySink {
  readonly records: MultiModalLogRecord[] = [];
  private limit: number;
  constructor(limit = 2000) { this.limit = limit; }
  log(record: MultiModalLogRecord): void {
    this.records.push(record);
    if (this.records.length > this.limit) this.records.shift();
  }
  byEvent(event: string): readonly MultiModalLogRecord[] {
    return this.records.filter((r) => r.event === event);
  }
  clear(): void { this.records.length = 0; }
}

export function travelLog(
  sink: MultiModalTelemetrySink,
  level: MultiModalLogRecord["level"],
  event: string,
  message: string,
  attributes: Record<string, unknown> = {},
): void {
  sink.log(Object.freeze({
    level, event, message, at: Date.now(),
    attributes: Object.freeze({ ...attributes }),
  }));
}

/** Minimal deterministic tracing span (in-memory, no exporters). */
export interface TravelSpan {
  readonly name: string;
  readonly startedAt: number;
  end(attributes?: Record<string, unknown>): void;
}

export function startTravelSpan(
  sink: MultiModalTelemetrySink,
  name: string,
  attributes: Record<string, unknown> = {},
): TravelSpan {
  const startedAt = Date.now();
  return {
    name,
    startedAt,
    end(extra: Record<string, unknown> = {}) {
      travelLog(sink, "debug", "multimodal.span", name, {
        ...attributes, ...extra, durationMs: Date.now() - startedAt,
      });
    },
  };
}
