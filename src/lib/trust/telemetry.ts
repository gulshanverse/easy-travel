/**
 * Trust & Evidence Engine — telemetry sinks (noop + console).
 * Real exporters plug in behind the interface without touching runtime code.
 */
export interface TrustTelemetrySink {
  span<T>(name: string, fn: () => Promise<T> | T, attrs?: Record<string, unknown>): Promise<T>;
  event(name: string, attrs?: Record<string, unknown>): void;
}

export const noopTelemetry: TrustTelemetrySink = {
  async span(_n, fn) { return await fn(); },
  event() { /* noop */ },
};

export function consoleTelemetry(): TrustTelemetrySink {
  return {
    async span(name, fn, attrs) {
      const t0 = Date.now();
      try { return await fn(); }
      finally {
        // eslint-disable-next-line no-console
        console.debug("[trust.span]", name, Date.now() - t0, attrs ?? {});
      }
    },
    event(name, attrs) {
      // eslint-disable-next-line no-console
      console.debug("[trust.event]", name, attrs ?? {});
    },
  };
}
