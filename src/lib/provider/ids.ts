/**
 * Provider Runtime — ID helpers.
 * Small deterministic generators; no crypto dependency.
 */
let counter = 0;
const rand = () => Math.random().toString(36).slice(2, 10);

export function newId(prefix: string): string {
  counter = (counter + 1) & 0xffffffff;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}_${rand()}`;
}

export const newProviderId = () => newId("prv");
export const newRequestId = () => newId("preq");
export const newCorrelationId = () => newId("pcor");
export const newExecutionId = () => newId("pexec");
export const newEventId = () => newId("pevt");
