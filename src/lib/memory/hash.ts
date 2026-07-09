/**
 * Memory Engine — Canonical hashing for dedup and content identity (§4.1).
 *
 * Uses SubtleCrypto SHA-256 when available (browsers, Workers, Node ≥19),
 * else falls back to a deterministic FNV-1a-64 hex digest. Callers treat the
 * result as an opaque identity token, not a cryptographic proof.
 */

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`).join(",")}}`;
}

async function subtleSha256(str: string): Promise<string | null> {
  const s = (globalThis as unknown as { crypto?: { subtle?: SubtleCrypto } }).crypto?.subtle;
  if (!s) return null;
  const buf = new TextEncoder().encode(str);
  const hash = await s.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

function fnv1a64(str: string): string {
  let h1 = 0xcbf29ce4;
  let h2 = 0x84222325;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 ^= c;
    h2 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 = Math.imul(h2, 0x01000193);
  }
  return (h1 >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0");
}

export async function contentHash(payload: unknown, class_: string, kind: string): Promise<string> {
  const canon = `${class_}::${kind}::${canonicalize(payload)}`;
  return (await subtleSha256(canon)) ?? fnv1a64(canon);
}

export async function queryHash(input: unknown): Promise<string> {
  const canon = canonicalize(input);
  return (await subtleSha256(canon)) ?? fnv1a64(canon);
}
