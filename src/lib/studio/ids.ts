/** JSR — deterministic ID helpers. */
let counter = 0;
function next(): string {
  counter = (counter + 1) >>> 0;
  return `${Date.now().toString(36)}${counter.toString(36).padStart(4, "0")}`;
}
export const newStudioSessionId = () => `jss_${next()}`;
export const newWorkspaceId = () => `wsp_${next()}`;
export const newDraftId = () => `drf_${next()}`;
export const newRevisionId = () => `rev_${next()}`;
export const newVersionId = () => `ver_${next()}`;
export const newCheckpointId = () => `chk_${next()}`;
export const newCardId = () => `crd_${next()}`;
export const newTimelineId = () => `tml_${next()}`;
export const newTimelineItemId = () => `tli_${next()}`;
export const newTimelineSectionId = () => `tls_${next()}`;
export const newTimelineGroupId = () => `tlg_${next()}`;
export const newTimelineEventId = () => `tle_${next()}`;
export const newParticipantId = () => `ptp_${next()}`;
export const newStudioEventId = () => `sevt_${next()}`;
export const newStudioCorrelationId = () => `scorr_${next()}`;
export const newStudioCausationId = () => `scaus_${next()}`;
export const newSnapshotId = () => `snp_${next()}`;
