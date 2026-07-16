/**
 * Trust & Evidence Engine — deterministic ID helpers.
 * No randomness escapes the module boundary; monotonic counter + prefix.
 */
let counter = 0;
function next(prefix: string): string {
  counter = (counter + 1) >>> 0;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}
export const newEvidenceId = () => next("ev");
export const newBundleId = () => next("evb");
export const newSourceId = () => next("src");
export const newSnapshotId = () => next("snp");
export const newConflictId = () => next("cft");
export const newDecisionId = () => next("dcn");
export const newTrustId = () => next("tr");
export const newRequestId = () => next("req");
