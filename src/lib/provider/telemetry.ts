/**
 * Provider Runtime — Structured telemetry + tracing hooks.
 */
export interface ProviderSpan {
  setAttr(key: string, value: unknown): void;
  addEvent(name: string, attrs?: Record<string, unknown>): void;
  end(): void;
}

export interface ProviderTelemetry {
  log(level: "debug" | "info" | "warn" | "error", message: string, fields?: Record<string, unknown>): void;
  span<T>(name: string, fn: (span: ProviderSpan) => Promise<T> | T, attrs?: Record<string, unknown>): Promise<T>;
}

class NoopSpan implements ProviderSpan {
  setAttr(): void {}
  addEvent(): void {}
  end(): void {}
}

export class NoopProviderTelemetry implements ProviderTelemetry {
  log(): void {}
  async span<T>(_name: string, fn: (span: ProviderSpan) => Promise<T> | T): Promise<T> {
    return await fn(new NoopSpan());
  }
}

export class ConsoleProviderTelemetry implements ProviderTelemetry {
  log(level: "debug" | "info" | "warn" | "error", message: string, fields?: Record<string, unknown>): void {
    // eslint-disable-next-line no-console
    (console[level] ?? console.log)(`[provider] ${message}`, fields ?? {});
  }
  async span<T>(name: string, fn: (span: ProviderSpan) => Promise<T> | T, attrs?: Record<string, unknown>): Promise<T> {
    const attributes: Record<string, unknown> = { ...(attrs ?? {}) };
    const started = Date.now();
    const span: ProviderSpan = {
      setAttr: (k, v) => { attributes[k] = v; },
      addEvent: () => {},
      end: () => {},
    };
    try {
      const result = await fn(span);
      this.log("debug", `${name} ok`, { ms: Date.now() - started, ...attributes });
      return result;
    } catch (err) {
      this.log("error", `${name} err`, { ms: Date.now() - started, ...attributes, error: (err as Error).message });
      throw err;
    }
  }
}

export const defaultProviderTelemetry: ProviderTelemetry = new NoopProviderTelemetry();
