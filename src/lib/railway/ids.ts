/** RICS — deterministic ID helpers (no randomness, no network). */
let counter = 0;
function next(): string {
  counter = (counter + 1) >>> 0;
  return `${Date.now().toString(36)}${counter.toString(36).padStart(4, "0")}`;
}
export const newRailRequestId = () => `rreq_${next()}`;
export const newRailCorrelationId = () => `rcor_${next()}`;
export const newRailJourneyId = () => `rjny_${next()}`;
export const newRailAlertId = () => `ralt_${next()}`;
export const newRailFareId = () => `rfar_${next()}`;
export const newRailProbeId = () => `rprb_${next()}`;
