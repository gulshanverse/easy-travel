/**
 * Memory Engine — Structured telemetry.
 *
 * Thin logger + span helper. In production a sink can be attached to ship
 * spans/logs to OTLP; by default logs go to console at warn+ only.
 */

export interface LogFields {
  [key: string]: unknown;
}

export interface Span {
  end(fields?: LogFields): void;
  fail(err: unknown, fields?: LogFields): void;
}

export interface TelemetrySink {
  log(level: "debug" | "info" | "warn" | "error", msg: string, fields?: LogFields): void;
  span?(name: string, fields?: LogFields): Span;
}

class ConsoleSink implements TelemetrySink {
  log(level: "debug" | "info" | "warn" | "error", msg: string, fields?: LogFields): void {
    if (level === "debug" || level === "info") return;
    const line = fields ? `${msg} ${JSON.stringify(fields)}` : msg;
    if (level === "warn") console.warn(`[memory] ${line}`);
    else console.error(`[memory] ${line}`);
  }
}

export class MemoryTelemetry {
  constructor(private sink: TelemetrySink = new ConsoleSink()) {}

  setSink(sink: TelemetrySink): void {
    this.sink = sink;
  }

  debug(msg: string, fields?: LogFields): void { this.sink.log("debug", msg, fields); }
  info(msg: string, fields?: LogFields): void { this.sink.log("info", msg, fields); }
  warn(msg: string, fields?: LogFields): void { this.sink.log("warn", msg, fields); }
  error(msg: string, fields?: LogFields): void { this.sink.log("error", msg, fields); }

  span(name: string, fields?: LogFields): Span {
    if (this.sink.span) return this.sink.span(name, fields);
    const started = Date.now();
    return {
      end: (extra) => this.debug(`span.end ${name}`, { ...fields, ...extra, ms: Date.now() - started }),
      fail: (err, extra) => this.warn(`span.fail ${name}`, { ...fields, ...extra, error: String(err), ms: Date.now() - started }),
    };
  }
}

export const defaultTelemetry = new MemoryTelemetry();
