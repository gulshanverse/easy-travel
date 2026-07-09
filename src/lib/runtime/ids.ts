/**
 * Runtime Core — Identifier helpers.
 *
 * Correlation, causation, and span identifiers used across the runtime. Uses
 * crypto.randomUUID when available and falls back to a monotonic pseudo-UUID.
 */

let counter = 0;

export function randomId(prefix = "id"): string {
  try {
    return `${prefix}_${crypto.randomUUID()}`;
  } catch {
    counter = (counter + 1) >>> 0;
    return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 10)}`;
  }
}

export const newRequestId = () => randomId("req");
export const newSessionId = () => randomId("sess");
export const newCorrelationId = () => randomId("corr");
export const newCausationId = () => randomId("cause");
export const newEventId = () => randomId("evt");
export const newSpanId = () => randomId("span");
export const newTraceId = () => randomId("trace");
