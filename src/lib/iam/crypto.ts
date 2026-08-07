/**
 * IAM Platform — cryptographic primitives.
 * Web Crypto only (Edge-compatible). No provider SDK is imported here.
 */

function subtle(): SubtleCrypto {
  const c = globalThis.crypto;
  if (!c?.subtle) throw new Error("Web Crypto subtle API is unavailable in this runtime");
  return c.subtle;
}

export function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  globalThis.crypto.getRandomValues(out);
  return out;
}

export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export function randomToken(bytes = 32): string {
  return toBase64Url(randomBytes(bytes));
}

export function encodeUtf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

export async function sha256(value: string): Promise<string> {
  const digest = await subtle().digest("SHA-256", encodeUtf8(value) as BufferSource);
  return toBase64Url(new Uint8Array(digest));
}

export async function hmacSha256(secret: string, message: string): Promise<string> {
  const key = await subtle().importKey(
    "raw",
    encodeUtf8(secret) as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await subtle().sign("HMAC", key, encodeUtf8(message) as BufferSource);
  return toBase64Url(new Uint8Array(sig));
}

export async function pbkdf2(
  password: string,
  salt: Uint8Array,
  iterations: number,
  bits = 256,
): Promise<Uint8Array> {
  const key = await subtle().importKey("raw", encodeUtf8(password) as BufferSource, "PBKDF2", false, [
    "deriveBits",
  ]);
  const derived = await subtle().deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    key,
    bits,
  );
  return new Uint8Array(derived);
}

/** Constant-time string comparison for secrets and signatures. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
