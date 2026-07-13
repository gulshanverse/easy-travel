/**
 * Deterministic ID helpers for the Journey Runtime.
 * A single monotonic counter guarantees ordering inside a process. IDs are
 * opaque strings — never parsed by consumers.
 */

let counter = 0;
const rand = (): string => Math.random().toString(36).slice(2, 10);

function next(prefix: string): string {
  counter = (counter + 1) >>> 0;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}_${rand()}`;
}

export const newJourneyId = () => next("jny");
export const newStageId = () => next("stg");
export const newIntentId = () => next("int");
export const newConstraintId = () => next("cst");
export const newTimelineId = () => next("tml");
export const newSnapshotId = () => next("snp");
export const newEventId = () => next("evt");
export const newCorrelationId = () => next("cor");
export const newContextId = () => next("ctx");
