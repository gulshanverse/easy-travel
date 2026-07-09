/**
 * Structured logging + tracing hooks for the Prompt Runtime.
 * No external tracing SDK — a Span interface that adapters (OTel etc.) can
 * satisfy is exposed instead.
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogRecord {
  level: LogLevel;
  message: string;
  timestamp: number;
  attrs?: Record<string, unknown>;
}

export interface PromptTelemetry {
  debug(msg: string, attrs?: Record<string, unknown>): void;
  info(msg: string, attrs?: Record<string, unknown>): void;
  warn(msg: string, attrs?: Record<string, unknown>): void;
  error(msg: string, attrs?: Record<string, unknown>): void;
  span<T>(name: string, fn: (span: Span) => Promise<T> | T, attrs?: Record<string, unknown>): Promise<T>;
}

export interface Span {
  setAttr(key: string, value: unknown): void;
  addEvent(name: string, attrs?: Record<string, unknown>): void;
  end(error?: unknown): void;
}

export class ConsoleTelemetry implements PromptTelemetry {
  constructor(private readonly minLevel: LogLevel = "info") {}
  private levels: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

  private emit(level: LogLevel, message: string, attrs?: Record<string, unknown>): void {
    if (this.levels[level] < this.levels[this.minLevel]) return;
    const rec: LogRecord = { level, message, timestamp: Date.now(), attrs };
    // eslint-disable-next-line no-console
    (console[level] ?? console.log)(JSON.stringify(rec));
  }

  debug(m: string, a?: Record<string, unknown>) { this.emit("debug", m, a); }
  info(m: string, a?: Record<string, unknown>) { this.emit("info", m, a); }
  warn(m: string, a?: Record<string, unknown>) { this.emit("warn", m, a); }
  error(m: string, a?: Record<string, unknown>) { this.emit("error", m, a); }

  async span<T>(name: string, fn: (span: Span) => Promise<T> | T): Promise<T> {
    const start = Date.now();
    const attrs: Record<string, unknown> = {};
    const span: Span = {
      setAttr: (k, v) => { attrs[k] = v; },
      addEvent: () => { /* noop */ },
      end: () => { /* noop */ },
    };
    try {
      const out = await fn(span);
      this.debug(`span:${name}`, { ms: Date.now() - start, ...attrs });
      return out;
    } catch (err) {
      this.error(`span:${name}`, { ms: Date.now() - start, error: (err as Error).message, ...attrs });
      throw err;
    }
  }
}

export class NoopTelemetry implements PromptTelemetry {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
  async span<T>(_n: string, fn: (span: Span) => Promise<T> | T): Promise<T> {
    return fn({ setAttr: () => {}, addEvent: () => {}, end: () => {} });
  }
}

export const defaultPromptTelemetry: PromptTelemetry = new NoopTelemetry();
