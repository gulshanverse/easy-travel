/**
 * Identity Platform — telemetry sinks.
 */
export interface IdentityTelemetrySink {
  span<T>(name: string, fn: () => Promise<T> | T, attrs?: Record<string, unknown>): Promise<T>;
  event(name: string, attrs?: Record<string, unknown>): void;
}

export const noopIdentityTelemetry: IdentityTelemetrySink = {
  async span(_n, fn) { return await fn(); },
  event() { /* noop */ },
};

export function consoleIdentityTelemetry(): IdentityTelemetrySink {
  return {
    async span(name, fn, attrs) {
      const t0 = Date.now();
      try { return await fn(); }
      finally { console.debug("[identity.span]", name, Date.now() - t0, attrs ?? {}); }
    },
    event(name, attrs) { console.debug("[identity.event]", name, attrs ?? {}); },
  };
}

export function recordingIdentityTelemetry(): IdentityTelemetrySink & { readonly records: string[] } {
  const records: string[] = [];
  return {
    records,
    async span(name, fn) { records.push(`span:${name}`); return await fn(); },
    event(name) { records.push(`event:${name}`); },
  };
}
