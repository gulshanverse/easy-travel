/** Provider Gateway (P-1.4) — deterministic ID + fingerprint helpers.
 *  IDs never encode PII or secrets.
 */
let counter = 0;
function next(prefix: string): string {
  counter = (counter + 1) >>> 0;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

export const newGatewayRequestId = () => next("gwr");
export const newGatewayEventId = () => next("gev");
export const newWebhookEventId = () => next("whk");
export const newPollingRunId = () => next("pol");
export const newIdempotencyRecordId = () => next("idm");
export const newAttemptId = () => next("att");

/** FNV-1a — stable, deterministic fingerprint. */
export function fingerprint(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/** Stable JSON serialization (sorted keys) used by fingerprints + cache keys. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entries.join(",")}}`;
}

export function requestFingerprint(input: {
  capability: string;
  operation: string;
  payload: Readonly<Record<string, unknown>>;
}): string {
  return fingerprint(
    `${input.capability}|${input.operation}|${stableStringify(input.payload)}`,
  );
}

export function operationIdentity(input: {
  capability: string;
  operation: string;
  userId?: string;
  tenantId?: string;
}): string {
  return `${input.tenantId ?? "-"}:${input.userId ?? "-"}:${input.capability}:${input.operation}`;
}

export function cacheKeyFor(input: {
  providerId: string;
  capability: string;
  operation: string;
  payload: Readonly<Record<string, unknown>>;
}): string {
  return `gw:${input.providerId}:${input.capability}:${input.operation}:${requestFingerprint(input)}`;
}
