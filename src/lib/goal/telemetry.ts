/**
 * Goal Engine — telemetry sinks.
 */
export interface GoalTelemetrySink {
  span<T>(name: string, fn: () => Promise<T> | T, attrs?: Record<string, unknown>): Promise<T>;
  event(name: string, attrs?: Record<string, unknown>): void;
}

export const noopGoalTelemetry: GoalTelemetrySink = {
  async span(_n, fn) { return await fn(); },
  event() { /* noop */ },
};

export function consoleGoalTelemetry(): GoalTelemetrySink {
  return {
    async span(name, fn, attrs) {
      const t0 = Date.now();
      try { return await fn(); }
      finally { /* eslint-disable-next-line no-console */ console.debug("[goal.span]", name, Date.now() - t0, attrs ?? {}); }
    },
    event(name, attrs) { /* eslint-disable-next-line no-console */ console.debug("[goal.event]", name, attrs ?? {}); },
  };
}
