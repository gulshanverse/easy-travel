/**
 * IAM Platform — Journey Studio presentation models (UI independent).
 */
import type {
  ApiKey,
  AuthorizationDecision,
  Device,
  IamSession,
  LoginAttempt,
} from "./types";

export type IamCardKind =
  | "iam.login"
  | "iam.session"
  | "iam.device"
  | "iam.security"
  | "iam.permission"
  | "iam.api_key"
  | "iam.activity"
  | "iam.profile_security";

export interface IamCard {
  readonly kind: IamCardKind;
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly severity: "info" | "warning" | "critical";
  readonly facts: readonly { readonly label: string; readonly value: string }[];
  readonly actions: readonly string[];
}

function card(input: IamCard): IamCard {
  return Object.freeze({ ...input, facts: Object.freeze(input.facts), actions: Object.freeze(input.actions) });
}

export function loginCard(attempt: LoginAttempt): IamCard {
  return card({
    kind: "iam.login",
    id: attempt.id,
    title: attempt.success ? "Sign-in successful" : "Sign-in failed",
    subtitle: attempt.method,
    severity: attempt.success ? "info" : attempt.riskScore >= 70 ? "critical" : "warning",
    facts: [
      { label: "Risk", value: String(attempt.riskScore) },
      { label: "Country", value: attempt.country ?? "unknown" },
      { label: "Reason", value: attempt.reason ?? "—" },
    ],
    actions: attempt.success ? ["review"] : ["review", "lock_account"],
  });
}

export function sessionCard(session: IamSession, at: number): IamCard {
  const expiring = session.idleExpiresAt - at;
  return card({
    kind: "iam.session",
    id: session.id,
    title: session.guest ? "Guest session" : "Active session",
    subtitle: session.method,
    severity: session.revokedAt ? "warning" : "info",
    facts: [
      { label: "Status", value: session.status },
      { label: "Device", value: session.deviceId ?? "unknown" },
      { label: "Idle expires in", value: `${Math.max(0, Math.round(expiring / 1000))}s` },
    ],
    actions: ["revoke", "view_history"],
  });
}

export function deviceCard(device: Device): IamCard {
  return card({
    kind: "iam.device",
    id: device.id,
    title: device.label,
    subtitle: device.platform,
    severity: device.trust === "revoked" ? "warning" : "info",
    facts: [
      { label: "Trust", value: device.trust },
      { label: "First seen", value: new Date(device.firstSeenAt).toISOString() },
      { label: "Last seen", value: new Date(device.lastSeenAt).toISOString() },
    ],
    actions: device.trust === "trusted" ? ["revoke"] : ["trust", "revoke"],
  });
}

export function securityCard(input: {
  userId: string;
  mfaEnabled: boolean;
  activeSessions: number;
  trustedDevices: number;
  lastPasswordChangeAt: number | null;
}): IamCard {
  return card({
    kind: "iam.security",
    id: `sec_${input.userId}`,
    title: "Account security",
    subtitle: input.mfaEnabled ? "Multi-factor enabled" : "Multi-factor not enabled",
    severity: input.mfaEnabled ? "info" : "warning",
    facts: [
      { label: "Active sessions", value: String(input.activeSessions) },
      { label: "Trusted devices", value: String(input.trustedDevices) },
      {
        label: "Password changed",
        value: input.lastPasswordChangeAt ? new Date(input.lastPasswordChangeAt).toISOString() : "never",
      },
    ],
    actions: ["change_password", "manage_mfa", "revoke_all_sessions"],
  });
}

export function permissionCard(decision: AuthorizationDecision): IamCard {
  return card({
    kind: "iam.permission",
    id: `${decision.subjectId}:${decision.permission}`,
    title: decision.allowed ? "Permission granted" : "Permission denied",
    subtitle: decision.permission,
    severity: decision.allowed ? "info" : "warning",
    facts: [
      { label: "Role", value: decision.matchedRole ?? "—" },
      { label: "Policy", value: decision.matchedPolicy ?? "—" },
      { label: "Reason", value: decision.reason },
    ],
    actions: ["explain"],
  });
}

export function apiKeyCard(key: ApiKey): IamCard {
  return card({
    kind: "iam.api_key",
    id: key.id,
    title: key.name,
    subtitle: key.prefix,
    severity: key.status === "active" ? "info" : "warning",
    facts: [
      { label: "Status", value: key.status },
      { label: "Scopes", value: key.scopes.join(", ") || "—" },
      { label: "Last used", value: key.lastUsedAt ? new Date(key.lastUsedAt).toISOString() : "never" },
    ],
    actions: ["rotate", "disable"],
  });
}

export function activityCard(userId: string, attempts: readonly LoginAttempt[]): IamCard {
  const failures = attempts.filter((a) => !a.success).length;
  return card({
    kind: "iam.activity",
    id: `act_${userId}`,
    title: "Recent activity",
    subtitle: `${attempts.length} sign-in events`,
    severity: failures > 0 ? "warning" : "info",
    facts: [
      { label: "Successes", value: String(attempts.length - failures) },
      { label: "Failures", value: String(failures) },
    ],
    actions: ["view_all"],
  });
}

export function profileSecurityCard(input: {
  userId: string;
  roles: readonly string[];
  permissions: readonly string[];
  federatedProviders: readonly string[];
}): IamCard {
  return card({
    kind: "iam.profile_security",
    id: `psec_${input.userId}`,
    title: "Access profile",
    subtitle: input.roles.join(", ") || "no roles",
    severity: "info",
    facts: [
      { label: "Permissions", value: String(input.permissions.length) },
      { label: "Federated", value: input.federatedProviders.join(", ") || "none" },
    ],
    actions: ["manage_roles"],
  });
}
