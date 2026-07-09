/**
 * Memory Engine — ID generation and correlation helpers.
 *
 * Uses `crypto.randomUUID()` when available (Workers, Node ≥19, browsers) and
 * falls back to a v4-shaped hex string so tests run in stripped environments.
 */

const g = globalThis as unknown as { crypto?: { randomUUID?: () => string } };

export function newId(): string {
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  // RFC 4122 v4 fallback
  const rnd = new Uint8Array(16);
  for (let i = 0; i < 16; i++) rnd[i] = Math.floor(Math.random() * 256);
  rnd[6] = (rnd[6] & 0x0f) | 0x40;
  rnd[8] = (rnd[8] & 0x3f) | 0x80;
  const hex = Array.from(rnd, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function newCorrelationId(prefix = "mem"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
