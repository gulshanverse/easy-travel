/** CTOR — lifecycle transitions. */
import { LifecycleError } from "./errors";
import type { CapabilityStatus, ToolStatus, WorkflowStatus } from "./types";

const CAP: Record<CapabilityStatus, readonly CapabilityStatus[]> = {
  registered: ["validated", "removed", "disabled"],
  validated: ["active", "disabled", "removed"],
  active: ["degraded", "disabled", "removed"],
  degraded: ["active", "disabled", "removed"],
  disabled: ["active", "removed"],
  removed: [],
};
const TOOL: Record<ToolStatus, readonly ToolStatus[]> = {
  registered: ["validated", "disabled", "removed"],
  validated: ["active", "disabled", "removed"],
  active: ["disabled", "removed"],
  disabled: ["active", "removed"],
  removed: [],
};
const WF: Record<WorkflowStatus, readonly WorkflowStatus[]> = {
  created: ["validated", "archived"],
  validated: ["scheduled", "running", "archived"],
  scheduled: ["running", "cancelled", "archived"],
  running: ["checkpoint", "completed", "failed", "cancelled"],
  checkpoint: ["running", "completed", "failed", "cancelled"],
  completed: ["archived"],
  failed: ["archived"],
  cancelled: ["archived"],
  archived: [],
};

export function canTransitionCapability(from: CapabilityStatus, to: CapabilityStatus): boolean {
  return CAP[from].includes(to);
}
export function transitionCapability(from: CapabilityStatus, to: CapabilityStatus): CapabilityStatus {
  if (!canTransitionCapability(from, to)) throw new LifecycleError(`Illegal capability transition ${from} -> ${to}`);
  return to;
}
export function canTransitionTool(from: ToolStatus, to: ToolStatus): boolean { return TOOL[from].includes(to); }
export function transitionTool(from: ToolStatus, to: ToolStatus): ToolStatus {
  if (!canTransitionTool(from, to)) throw new LifecycleError(`Illegal tool transition ${from} -> ${to}`);
  return to;
}
export function canTransitionWorkflow(from: WorkflowStatus, to: WorkflowStatus): boolean { return WF[from].includes(to); }
export function transitionWorkflow(from: WorkflowStatus, to: WorkflowStatus): WorkflowStatus {
  if (!canTransitionWorkflow(from, to)) throw new LifecycleError(`Illegal workflow transition ${from} -> ${to}`);
  return to;
}
