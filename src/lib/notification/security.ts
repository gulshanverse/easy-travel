/**
 * NCP — content safety: sanitization, escaping, truncation and redaction.
 * No message body ever reaches logs or telemetry unredacted.
 */

const SENSITIVE_KEYS = /(password|secret|token|otp|pin|cvv|authorization|api[_-]?key|ssn)/i;

const HTML_ESCAPES: Readonly<Record<string, string>> = Object.freeze({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
});

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c);
}

/** Strips control characters and collapses whitespace runs. */
export function sanitizeText(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[ \t]+/g, " ");
}

export function truncate(value: string, max: number): string {
  if (max <= 0 || value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1))}…`;
}

/** SMS bodies must be plain text with no markup and no links to secrets. */
export function sanitizeSms(value: string, max = 480): string {
  return truncate(sanitizeText(value.replace(/<[^>]*>/g, "")).trim(), max);
}

export function redact(
  payload: Readonly<Record<string, unknown>> | null | undefined,
): Readonly<Record<string, unknown>> | null {
  if (!payload) return null;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    out[key] = SENSITIVE_KEYS.test(key) ? "[redacted]" : value;
  }
  return Object.freeze(out);
}

/** Masks recipient addresses so audit trails never hold raw contact data. */
export function maskAddress(address: string | null): string | null {
  if (!address) return null;
  if (address.includes("@")) {
    const [user, domain] = address.split("@");
    const head = user.slice(0, 1);
    return `${head}${"*".repeat(Math.max(1, user.length - 1))}@${domain}`;
  }
  const tail = address.slice(-3);
  return `${"*".repeat(Math.max(1, address.length - 3))}${tail}`;
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

export function isValidPhone(value: string): boolean {
  return /^\+?[0-9]{7,15}$/.test(value.replace(/[\s-]/g, ""));
}
