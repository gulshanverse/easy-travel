/** ARP — telemetry sink. */
export interface AgentTelemetryRecord {
  readonly kind: "trace" | "metric" | "log";
  readonly level: "debug" | "info" | "warn" | "error";
  readonly message: string;
  readonly timestamp: number;
  readonly attributes: Readonly<Record<string, unknown>>;
}
export interface AgentTelemetrySink {
  record(r: AgentTelemetryRecord): void;
}
export const noopAgentTelemetry: AgentTelemetrySink = { record() { /* no-op */ } };
