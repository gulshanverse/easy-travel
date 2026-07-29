/** MTIP — deterministic ID helpers (no randomness, no network). */
let counter = 0;
function next(): string {
  counter = (counter + 1) >>> 0;
  return `${Date.now().toString(36)}${counter.toString(36).padStart(4, "0")}`;
}
export const newTravelRequestId = () => `mreq_${next()}`;
export const newTravelCorrelationId = () => `mcor_${next()}`;
export const newTravelSegmentId = () => `mseg_${next()}`;
export const newTravelEventId = () => `mevt_${next()}`;
export const newTravelCardId = () => `mcrd_${next()}`;
export const newTravelProbeId = () => `mprb_${next()}`;
