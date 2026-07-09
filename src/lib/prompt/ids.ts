/**
 * Deterministic ID + hash helpers. No crypto dependency — we use a stable
 * FNV-1a 64-bit hash rendered as hex. Sufficient for cache fingerprints and
 * dedupe keys; not for security.
 */

export function newCorrelationId(prefix = "prm"): string {
  // Node/edge/browser all expose crypto.randomUUID in supported runtimes.
  const uuid = globalThis.crypto?.randomUUID?.() ?? fallbackUuid();
  return `${prefix}_${uuid}`;
}

function fallbackUuid(): string {
  const rnd = () => Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0");
  return `${rnd()}-${rnd()}-${rnd()}-${rnd()}`;
}

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK = 0xffffffffffffffffn;

export function stableHash(input: string): string {
  let h = FNV_OFFSET;
  for (let i = 0; i < input.length; i++) {
    h ^= BigInt(input.charCodeAt(i));
    h = (h * FNV_PRIME) & MASK;
  }
  return h.toString(16).padStart(16, "0");
}

/** Deterministic hash of any JSON-serialisable value. */
export function stableHashJson(value: unknown): string {
  return stableHash(canonicalJson(value));
}

/** Order-independent JSON serialiser. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`;
}

/** Rough token estimator: ~4 chars per token, whitespace-normalised. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const normalised = text.replace(/\s+/g, " ").trim();
  return Math.max(1, Math.ceil(normalised.length / 4));
}
