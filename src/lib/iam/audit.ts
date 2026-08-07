/**
 * IAM Platform — Audit integration (ADR-028).
 * Every security-relevant action is written through the P-1.1 Audit Store
 * port. Audit records never contain secrets, hashes or token values.
 */
import type { IamAuditPort } from "./ports";

export type IamAuditAction =
  | "login"
  | "logout"
  | "login_failed"
  | "lockout"
  | "password_change"
  | "password_reset"
  | "role_change"
  | "permission_change"
  | "session_revocation"
  | "token_rotation"
  | "token_revocation"
  | "api_key_rotation"
  | "api_key_change"
  | "device_registration"
  | "device_trust_change"
  | "mfa_change"
  | "federation_link"
  | "security_event";

export interface IamAuditRecordInput {
  readonly action: IamAuditAction;
  readonly actorId: string | null;
  readonly subjectId: string | null;
  readonly collection: string;
  readonly recordId: string;
  readonly before?: Readonly<Record<string, unknown>> | null;
  readonly after?: Readonly<Record<string, unknown>> | null;
}

const SECRET_KEYS = new Set([
  "password",
  "secret",
  "secretHash",
  "hash",
  "token",
  "tokenHash",
  "fingerprint",
  "value",
]);

/** Defence in depth: strips credential-bearing fields before persisting. */
export function redact(
  value: Readonly<Record<string, unknown>> | null | undefined,
): Readonly<Record<string, unknown>> | null {
  if (!value) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) out[k] = SECRET_KEYS.has(k) ? "[redacted]" : v;
  return Object.freeze(out);
}

export class IamAuditor {
  private readonly local: IamAuditRecordInput[] = [];

  constructor(
    private readonly port: IamAuditPort | undefined,
    private readonly enabled: boolean,
  ) {}

  async record(input: IamAuditRecordInput): Promise<void> {
    if (!this.enabled) return;
    const entry = {
      ...input,
      before: redact(input.before),
      after: redact({ ...(input.after ?? {}), iamAction: input.action }),
    };
    this.local.push(entry);
    if (!this.port) return;
    await this.port.record({
      actorId: entry.actorId,
      ownerId: entry.subjectId,
      action: input.before ? "update" : "create",
      collection: entry.collection,
      recordId: entry.recordId,
      before: entry.before,
      after: entry.after,
    });
  }

  /** Local trail, useful for fitness tests and diagnostics. */
  trail(): readonly IamAuditRecordInput[] {
    return Object.freeze([...this.local]);
  }
}
