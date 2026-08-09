/**
 * NCP — deterministic, monotonic ID helpers. IDs never encode PII.
 */
let counter = 0;
function next(prefix: string): string {
  counter = (counter + 1) >>> 0;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

export const newNotificationId = () => next("ntf");
export const newDeliveryId = () => next("dlv");
export const newInAppItemId = () => next("ina");
export const newDeadLetterId = () => next("dlq");
export const newDigestId = () => next("dgs");
export const newTemplateVersionId = () => next("tvr");
export const newNotificationEventId = () => next("nev");
export const newSubscriptionId = () => next("sub");
export const newRateWindowId = () => next("rlw");

/** FNV-1a — stable fingerprint used for dedupe keys and render fingerprints. */
export function fingerprint(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/** Deterministic dedupe key: same recipient + type + payload = same key. */
export function dedupeKeyFor(input: {
  userId: string;
  type: string;
  variables: Readonly<Record<string, unknown>>;
}): string {
  const entries = Object.entries(input.variables)
    .map(([k, v]) => `${k}=${String(v)}`)
    .sort();
  return `${input.userId}:${input.type}:${fingerprint(entries.join("|"))}`;
}
