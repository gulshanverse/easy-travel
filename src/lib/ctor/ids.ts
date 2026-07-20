/** CTOR — deterministic ID helpers. */
let counter = 0;
function next(): string {
  counter = (counter + 1) >>> 0;
  return `${Date.now().toString(36)}${counter.toString(36).padStart(4, "0")}`;
}
export const newCapabilityId = (): string => `cap_${next()}`;
export const newToolId = (): string => `tool_${next()}`;
export const newWorkflowId = (): string => `wf_${next()}`;
export const newExecutionId = (): string => `exec_${next()}`;
export const newInvocationId = (): string => `inv_${next()}`;
export const newStepId = (): string => `step_${next()}`;
export const newEventId = (): string => `cevt_${next()}`;
export const newCorrelationId = (): string => `ccorr_${next()}`;
export const newCausationId = (): string => `ccaus_${next()}`;
