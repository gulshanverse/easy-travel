/** ARP — deterministic ID helpers. */
let counter = 0;
function next(): string {
  counter = (counter + 1) >>> 0;
  return `${Date.now().toString(36)}${counter.toString(36).padStart(4, "0")}`;
}
export const newAgentId = (): string => `agt_${next()}`;
export const newSessionId = (): string => `sess_${next()}`;
export const newConversationId = (): string => `conv_${next()}`;
export const newTurnId = (): string => `turn_${next()}`;
export const newIntentId = (): string => `intent_${next()}`;
export const newPlanId = (): string => `plan_${next()}`;
export const newTaskId = (): string => `task_${next()}`;
export const newResponseId = (): string => `resp_${next()}`;
export const newObservationId = (): string => `obs_${next()}`;
export const newReasoningId = (): string => `rsn_${next()}`;
export const newEventId = (): string => `aevt_${next()}`;
export const newCorrelationId = (): string => `acorr_${next()}`;
export const newCausationId = (): string => `acaus_${next()}`;
