/**
 * Runtime Core — Structured logging + distributed tracing hooks.
 *
 * Adapters (OpenTelemetry, Datadog, etc.) implement RuntimeTelemetry. The
 * default NoopTelemetry keeps unit tests silent; ConsoleTelemetry prints
 * JSON records suitable for log aggregation.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogRecord {
  level: LogLevel;
  message: string;
  timestamp: number;
  attrs?: Record<string, unknown>;
}

export interface Span {
  setAttr(key: string, value: unknown): void;
  addEvent(name: string, attrs?: Record<string, unknown>): void;
  end(error?: unknown): void;
}

export interface RuntimeTelemetry {
  debug(message: string, attrs?: Record<string, unknown>): void;
  info(message: string, attrs?: Record<string, unknown>): void;
  warn(message: string, attrs?: Record<string, unknown>): void;
  error(message: string, attrs?: Record<string, unknown>): void;
  span<T>(
    name: string,
    fn: (span: Span) => Promise<T> | T,
    attrs?: Record<string, unknown>,
  ): Promise<T>;
}

const LEVEL_RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export class ConsoleTelemetry implements RuntimeTelemetry {
  constructor(private readonly minLevel: LogLevel = "info") {}

  private emit(level: LogLevel, message: string, attrs?: Record<string, unknown>): void {
    if (LEVEL_RANK[level] < LEVEL_RANK[this.minLevel]) return;
    const record: LogRecord = { level, message, timestamp: Date.now(), attrs };
    // eslint-disable-next-line no-console
    (console[level] ?? console.log)(JSON.stringify(record));
  }

  debug(m: string, a?: Record<string, unknown>): void { this.emit("debug", m, a); }
  info(m: string, a?: Record<string, unknown>): void { this.emit("info", m, a); }
  warn(m: string, a?: Record<string, unknown>): void { this.emit("warn", m, a); }
  error(m: string, a?: Record<string, unknown>): void { this.emit("error", m, a); }

  async span<T>(
    name: string,
    fn: (span: Span) => Promise<T> | T,
    attrs?: Record<string, unknown>,
  ): Promise<T> {
    const start = Date.now();
    const collected: Record<string, unknown> = { ...(attrs ?? {}) };
    const span: Span = {
      setAttr: (k, v) => { collected[k] = v; },
      addEvent: () => { /* noop */ },
      end: () => { /* noop */ },
    };
    try {
      const out = await fn(span);
      this.debug(`span:${name}`, { ms: Date.now() - start, ...collected });
      return out;
    } catch (err) {
      this.error(`span:${name}`, {
        ms: Date.now() - start,
        error: (err as Error).message,
        ...collected,
      });
      throw err;
    }
  }
}

export class NoopTelemetry implements RuntimeTelemetry {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
  async span<T>(_n: string, fn: (span: Span) => Promise<T> | T): Promise<T> {
    return fn({ setAttr: () => {}, addEvent: () => {}, end: () => {} });
  }
}

export const defaultRuntimeTelemetry: RuntimeTelemetry = new NoopTelemetry();
