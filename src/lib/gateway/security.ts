/** Provider Gateway (P-1.4) — security controls.
 *  Secret redaction, SSRF protection, endpoint allowlisting, size limits and
 *  data minimization. No arbitrary URL may ever become a provider endpoint.
 */

const SECRET_PATTERNS: readonly RegExp[] = [
  /\b(?:sk|pk|rk|api|key|token|secret|password|passwd|pwd|authorization|bearer)[-_ ]?[:=]?\s*["']?[A-Za-z0-9._\-/+]{8,}["']?/gi,
  /\bBearer\s+[A-Za-z0-9._\-/+]{8,}/gi,
  /\beyJ[A-Za-z0-9._-]{10,}/g,
];

const SENSITIVE_KEYS = new Set([
  "authorization",
  "apikey",
  "api_key",
  "key",
  "token",
  "accesstoken",
  "access_token",
  "refreshtoken",
  "refresh_token",
  "secret",
  "clientsecret",
  "client_secret",
  "password",
  "passphrase",
  "credential",
  "credentials",
  "cookie",
  "setcookie",
  "signature",
  "privatekey",
  "private_key",
]);

export const REDACTED = "[REDACTED]";

/** Strip anything that looks like a secret from a free-text string. */
export function redact(input: string): string {
  let out = String(input ?? "");
  for (const p of SECRET_PATTERNS) out = out.replace(p, REDACTED);
  return out;
}

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.has(key.toLowerCase().replace(/[-\s]/g, ""));
}

/** Deep-redact an object graph. Used for telemetry, events and audit rows. */
export function redactObject<T>(value: T, depth = 0): unknown {
  if (depth > 8) return REDACTED;
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return redact(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map((v) => redactObject(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = isSensitiveKey(k) ? REDACTED : redactObject(v, depth + 1);
    }
    return out;
  }
  return REDACTED;
}

/* ------------------------------------------------------------------ */
/* SSRF protection                                                     */
/* ------------------------------------------------------------------ */

const ALLOWED_SCHEMES = new Set(["https:"]);

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "0.0.0.0",
  "127.0.0.1",
  "::1",
  "[::1]",
  "metadata.google.internal",
  "metadata.goog",
  "instance-data",
]);

const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".localdomain"];

export interface UrlValidationResult {
  readonly ok: boolean;
  readonly reason?: string;
  readonly hostname?: string;
}

function isPrivateIPv4(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true; // link-local + cloud metadata
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function isPrivateIPv6(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (!h.includes(":")) return false;
  if (h === "::" || h === "::1") return true;
  if (h.startsWith("fc") || h.startsWith("fd")) return true; // unique local
  if (h.startsWith("fe80")) return true; // link-local
  if (h.startsWith("::ffff:")) return isPrivateIPv4(h.slice(7));
  return false;
}

/** Validate a candidate outbound URL against SSRF rules. */
export function validateOutboundUrl(raw: string): UrlValidationResult {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "malformed url" };
  }
  if (!ALLOWED_SCHEMES.has(url.protocol))
    return { ok: false, reason: `scheme not allowed: ${url.protocol}` };
  if (url.username || url.password) return { ok: false, reason: "credentials in url" };
  const host = url.hostname.toLowerCase();
  if (!host) return { ok: false, reason: "missing host" };
  if (BLOCKED_HOSTNAMES.has(host)) return { ok: false, reason: `blocked host: ${host}` };
  if (BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s)))
    return { ok: false, reason: `blocked host suffix: ${host}` };
  if (isPrivateIPv4(host)) return { ok: false, reason: `private ipv4: ${host}` };
  if (isPrivateIPv6(host)) return { ok: false, reason: `private ipv6: ${host}` };
  return { ok: true, hostname: host };
}

/** Registry of explicitly trusted provider endpoints (TLS enforced). */
export class EndpointAllowlist {
  private hosts = new Map<string, Set<string>>(); // host → providerIds

  allow(providerId: string, url: string): void {
    const check = validateOutboundUrl(url);
    if (!check.ok || !check.hostname)
      throw new Error(`endpoint rejected for ${providerId}: ${check.reason}`);
    const set = this.hosts.get(check.hostname) ?? new Set<string>();
    set.add(providerId);
    this.hosts.set(check.hostname, set);
  }

  isAllowed(providerId: string, url: string): UrlValidationResult {
    const check = validateOutboundUrl(url);
    if (!check.ok) return check;
    const owners = this.hosts.get(check.hostname!);
    if (!owners || !owners.has(providerId))
      return { ok: false, reason: `host not registered for provider ${providerId}` };
    return check;
  }

  hosts_(): readonly string[] {
    return [...this.hosts.keys()].sort();
  }
  clear(): void {
    this.hosts.clear();
  }
}

/* ------------------------------------------------------------------ */
/* Size limits + data minimization                                     */
/* ------------------------------------------------------------------ */

export function byteSize(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value ?? null)).length;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

const PII_KEYS = new Set([
  "email",
  "phone",
  "phonenumber",
  "address",
  "dob",
  "dateofbirth",
  "passport",
  "passportnumber",
  "nationalid",
  "ssn",
  "gender",
  "ipaddress",
]);

export function isPiiKey(key: string): boolean {
  return PII_KEYS.has(key.toLowerCase().replace(/[-_\s]/g, ""));
}

/** Field allowlist — only declared capability inputs leave the platform. */
export function minimize(
  payload: Readonly<Record<string, unknown>>,
  allowedFields: readonly string[],
): Readonly<Record<string, unknown>> {
  const allow = new Set(allowedFields);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (!allow.has(k)) continue;
    if (isSensitiveKey(k)) continue;
    out[k] = v;
  }
  return Object.freeze(out);
}

/** Response sanitization — drop sensitive material before normalization. */
export function sanitizeResponse<T>(value: T): T {
  return redactObject(value) as T;
}
