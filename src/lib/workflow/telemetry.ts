/** WAR — telemetry sink + structured logging + tracing. */
export interface WorkflowTelemetryRecord {
  readonly kind: "trace" | "metric" | "log";
  readonly level: "debug" | "info" | "warn" | "error";
  readonly message: string;
  readonly timestamp: number;
  readonly attributes: Readonly<Record<string, unknown>>;
}

export interface WorkflowTelemetrySink {
  record(r: WorkflowTelemetryRecord): void;
}

export const noopWorkflowTelemetry: WorkflowTelemetrySink = { record() { /* no-op */ } };

export class InMemoryWorkflowTelemetry implements WorkflowTelemetrySink {
  readonly records: WorkflowTelemetryRecord[] = [];
  record(r: WorkflowTelemetryRecord): void { this.records.push(r); }
  clear(): void { this.records.length = 0; }
  byKind(kind: WorkflowTelemetryRecord["kind"]): readonly WorkflowTelemetryRecord[] {
    return this.records.filter(r => r.kind === kind);
  }
}

export interface WorkflowSpan {
  readonly name: string;
  readonly correlationId: string;
  readonly startedAt: number;
  end(attributes?: Readonly<Record<string, unknown>>): void;
}

export function startWorkflowSpan(
  sink: WorkflowTelemetrySink,
  name: string,
  correlationId: string,
  now: () => number,
): WorkflowSpan {
  const startedAt = now();
  return {
    name, correlationId, startedAt,
    end(attributes = {}) {
      sink.record({
        kind: "trace", level: "info", message: name, timestamp: now(),
        attributes: { correlationId, durationMs: now() - startedAt, ...attributes },
      });
    },
  };
}
