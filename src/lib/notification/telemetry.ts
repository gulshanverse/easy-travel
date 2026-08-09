/**
 * NCP — telemetry sinks (spans + events). Provider independent.
 */
export interface NotificationTelemetrySink {
  span<T>(name: string, fn: () => Promise<T> | T, attrs?: Record<string, unknown>): Promise<T>;
  event(name: string, attrs?: Record<string, unknown>): void;
}

export const noopNotificationTelemetry: NotificationTelemetrySink = {
  async span(_name, fn) {
    return await fn();
  },
  event() {
    /* noop */
  },
};

export function recordingNotificationTelemetry(): NotificationTelemetrySink & {
  readonly records: string[];
} {
  const records: string[] = [];
  return {
    records,
    async span(name, fn) {
      records.push(`span:${name}`);
      return await fn();
    },
    event(name) {
      records.push(`event:${name}`);
    },
  };
}
