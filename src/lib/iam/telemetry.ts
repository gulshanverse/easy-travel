/**
 * IAM Platform — telemetry sinks (spans + events). Provider independent.
 */
export interface IamTelemetrySink {
  span<T>(name: string, fn: () => Promise<T> | T, attrs?: Record<string, unknown>): Promise<T>;
  event(name: string, attrs?: Record<string, unknown>): void;
}

export const noopIamTelemetry: IamTelemetrySink = {
  async span(_n, fn) {
    return await fn();
  },
  event() {
    /* noop */
  },
};

export function recordingIamTelemetry(): IamTelemetrySink & { readonly records: string[] } {
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
