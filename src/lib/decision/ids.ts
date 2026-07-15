/**
 * Decision Runtime — Identifier helpers.
 * Opaque, deterministic-within-process IDs. Never parsed by consumers.
 */
let counter = 0;
const rand = () => Math.random().toString(36).slice(2, 10);
function next(prefix: string): string {
  counter = (counter + 1) >>> 0;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}_${rand()}`;
}
export const newDecisionId = () => next("dec");
export const newOptionId = () => next("opt");
export const newScoreId = () => next("scr");
export const newConstraintId = () => next("dcn");
export const newTradeoffId = () => next("trd");
export const newEvidenceId = () => next("evd");
export const newExplanationId = () => next("exp");
export const newOutcomeId = () => next("otc");
export const newSnapshotId = () => next("snp");
export const newContextId = () => next("ctx");
export const newEventId = () => next("evt");
export const newCorrelationId = () => next("cor");
export const newCausationId = () => next("cau");
