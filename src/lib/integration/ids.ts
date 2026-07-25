/** IPCF — deterministic ID helpers. */
let counter = 0;
function next(): string {
  counter = (counter + 1) >>> 0;
  return `${Date.now().toString(36)}${counter.toString(36).padStart(4, "0")}`;
}
export const newConnectorId = () => `cnr_${next()}`;
export const newConnectorVersionId = () => `cnv_${next()}`;
export const newRequestId = () => `creq_${next()}`;
export const newResponseId = () => `cres_${next()}`;
export const newWebhookId = () => `whk_${next()}`;
export const newWebhookDeliveryId = () => `whd_${next()}`;
export const newPollingJobId = () => `plj_${next()}`;
export const newPollingRunId = () => `plr_${next()}`;
export const newEventId = () => `ievt_${next()}`;
export const newCorrelationId = () => `icor_${next()}`;
export const newCausationId = () => `icau_${next()}`;
export const newSnapshotId = () => `isnp_${next()}`;
export const newCredentialRefId = () => `cred_${next()}`;
export const newRetryId = () => `rty_${next()}`;
export const newDlqEntryId = () => `dlq_${next()}`;
