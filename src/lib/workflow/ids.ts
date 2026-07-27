/** WAR — deterministic ID helpers. */
let counter = 0;
function next(): string {
  counter = (counter + 1) >>> 0;
  return `${Date.now().toString(36)}${counter.toString(36).padStart(4, "0")}`;
}
export const newWorkflowDefinitionId = (): string => `wfd_${next()}`;
export const newWorkflowInstanceId = (): string => `wfi_${next()}`;
export const newWorkflowStepId = (): string => `wfs_${next()}`;
export const newCheckpointId = (): string => `wfc_${next()}`;
export const newScheduleId = (): string => `wfsch_${next()}`;
export const newWorkflowEventId = (): string => `wfev_${next()}`;
export const newWorkflowCorrelationId = (): string => `wfcor_${next()}`;
export const resetWorkflowIdCounter = (): void => { counter = 0; };
