/** IPCF — connector lifecycle state machine. */
import { IntegrationLifecycleError } from "./errors";
import type { ConnectorStatus } from "./types";

const TRANSITIONS: Readonly<Record<ConnectorStatus, readonly ConnectorStatus[]>> = Object.freeze({
  registered: ["validated", "disabled", "retired"],
  validated: ["enabled", "disabled", "retired"],
  enabled: ["disabled", "degraded", "failed", "retired"],
  degraded: ["enabled", "failed", "disabled", "retired"],
  failed: ["enabled", "disabled", "retired"],
  disabled: ["enabled", "retired"],
  retired: [],
});

export function canTransition(from: ConnectorStatus, to: ConnectorStatus): boolean {
  if (from === to) return true;
  return TRANSITIONS[from].includes(to);
}
export function assertTransition(from: ConnectorStatus, to: ConnectorStatus): void {
  if (!canTransition(from, to)) {
    throw new IntegrationLifecycleError(`invalid transition ${from} -> ${to}`);
  }
}
export function nextStates(from: ConnectorStatus): readonly ConnectorStatus[] {
  return TRANSITIONS[from];
}
