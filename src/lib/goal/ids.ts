/**
 * Goal Intelligence & Planning Engine — deterministic ID helpers.
 */
let counter = 0;
function next(prefix: string): string {
  counter = (counter + 1) >>> 0;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}
export const newGoalId = () => next("goal");
export const newIntentId = () => next("gin");
export const newPlanId = () => next("gpl");
export const newMilestoneId = () => next("gms");
export const newStepId = () => next("gst");
export const newCheckpointId = () => next("gck");
export const newProgressId = () => next("gpr");
export const newReviewId = () => next("grv");
export const newSnapshotId = () => next("gsn");
export const newEventId = () => next("gev");
export const newHistoryId = () => next("ghs");
export const newCorrelationId = () => next("cor");
