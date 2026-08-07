/**
 * IAM Platform — immutable domain models.
 * These EXTEND the Identity Platform (ADR-025): a `userId` here is always an
 * Identity Platform user id. No identity model is duplicated.
 */

export type AccountStatus = "pending" | "active" | "locked" | "suspended" | "deactivated";
export type CredentialKind = "password" | "passwordless" | "federated" | "service";
export type AuthenticationMethod =
  | "email_password"
  | "username_password"
  | "passwordless"
  | "federated"
  | "api_key"
  | "service_account"
  | "guest";

export interface Credential {
  readonly id: string;
  readonly userId: string;
  readonly kind: CredentialKind;
  readonly identifier: string;
  readonly normalizedIdentifier: string;
  readonly secretHash: string | null;
  readonly algorithm: string | null;
  readonly status: AccountStatus;
  readonly emailVerified: boolean;
  readonly mfaEnabled: boolean;
  readonly failedAttempts: number;
  readonly lockedUntil: number | null;
  readonly passwordChangedAt: number | null;
  readonly lastLoginAt: number | null;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface PasswordHistoryEntry {
  readonly id: string;
  readonly userId: string;
  readonly hash: string;
  readonly algorithm: string;
  readonly createdAt: number;
}

export interface PasswordResetToken {
  readonly id: string;
  readonly userId: string;
  readonly tokenHash: string;
  readonly expiresAt: number;
  readonly usedAt: number | null;
  readonly createdAt: number;
}

export type TokenType = "access" | "refresh";
export type TokenFormat = "jwt" | "opaque";

export interface TokenClaims {
  readonly sub: string;
  readonly iss: string;
  readonly aud: string;
  readonly iat: number;
  readonly exp: number;
  readonly jti: string;
  readonly typ: TokenType;
  readonly sid: string | null;
  readonly scope: readonly string[];
  readonly roles: readonly string[];
  readonly amr: readonly string[];
}

export interface TokenRecord {
  readonly id: string;
  readonly userId: string;
  readonly sessionId: string | null;
  readonly type: TokenType;
  readonly format: TokenFormat;
  readonly fingerprint: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly revokedAt: number | null;
  readonly rotatedFrom: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface IssuedToken {
  readonly value: string;
  readonly record: TokenRecord;
  readonly claims: TokenClaims;
}

export type SessionStatus = "active" | "idle" | "expired" | "revoked";

export interface IamSession {
  readonly id: string;
  readonly userId: string;
  readonly deviceId: string | null;
  readonly method: AuthenticationMethod;
  readonly status: SessionStatus;
  readonly guest: boolean;
  readonly rememberMe: boolean;
  readonly createdAt: number;
  readonly lastSeenAt: number;
  readonly idleExpiresAt: number;
  readonly absoluteExpiresAt: number;
  readonly revokedAt: number | null;
  readonly revokedReason: string | null;
  readonly authenticatedAt: number;
  readonly amr: readonly string[];
  readonly metadata: SessionMetadata;
}

export interface SessionMetadata {
  readonly ip: string | null;
  readonly userAgent: string | null;
  readonly country: string | null;
  readonly city: string | null;
  readonly riskScore: number;
}

export interface SessionHistoryEntry {
  readonly id: string;
  readonly sessionId: string;
  readonly userId: string;
  readonly action: "started" | "refreshed" | "revoked" | "expired" | "reauthenticated";
  readonly at: number;
  readonly reason: string | null;
}

export type DevicePlatform = "browser" | "android" | "ios" | "desktop" | "tablet" | "web";
export type DeviceTrustLevel = "unknown" | "known" | "trusted" | "revoked";

export interface Device {
  readonly id: string;
  readonly userId: string;
  readonly fingerprint: string;
  readonly platform: DevicePlatform;
  readonly label: string;
  readonly trust: DeviceTrustLevel;
  readonly verifiedAt: number | null;
  readonly firstSeenAt: number;
  readonly lastSeenAt: number;
  readonly revokedAt: number | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface Permission {
  readonly id: string;
  readonly code: string;
  readonly description: string;
  readonly group: string | null;
  readonly createdAt: number;
}

export interface PermissionGroup {
  readonly id: string;
  readonly code: string;
  readonly description: string;
  readonly permissions: readonly string[];
}

export interface Role {
  readonly id: string;
  readonly code: string;
  readonly description: string;
  readonly parents: readonly string[];
  readonly permissions: readonly string[];
  readonly system: boolean;
  readonly createdAt: number;
}

export interface RoleAssignment {
  readonly id: string;
  readonly subjectId: string;
  readonly subjectKind: "user" | "service_account" | "api_key";
  readonly roleCode: string;
  readonly grantedBy: string | null;
  readonly grantedAt: number;
  readonly expiresAt: number | null;
}

export interface AuthorizationContext {
  readonly subjectId: string;
  readonly subjectKind: "user" | "service_account" | "api_key" | "guest";
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
  readonly scopes: readonly string[];
  readonly claims: Readonly<Record<string, unknown>>;
  readonly at: number;
}

export interface AuthorizationDecision {
  readonly allowed: boolean;
  readonly permission: string;
  readonly subjectId: string;
  readonly matchedRole: string | null;
  readonly matchedPolicy: string | null;
  readonly reason: string;
  readonly explanation: readonly string[];
  readonly at: number;
}

export type ApiKeyStatus = "active" | "disabled" | "expired" | "rotated";

export interface ApiKey {
  readonly id: string;
  readonly ownerId: string;
  readonly ownerKind: "user" | "service_account";
  readonly name: string;
  readonly prefix: string;
  readonly hash: string;
  readonly scopes: readonly string[];
  readonly status: ApiKeyStatus;
  readonly expiresAt: number | null;
  readonly lastUsedAt: number | null;
  readonly rotatedFrom: string | null;
  readonly createdAt: number;
}

export interface ServiceAccount {
  readonly id: string;
  readonly code: string;
  readonly description: string;
  readonly enabled: boolean;
  readonly roles: readonly string[];
  readonly scopes: readonly string[];
  readonly createdAt: number;
}

export interface LoginAttempt {
  readonly id: string;
  readonly identifier: string;
  readonly userId: string | null;
  readonly success: boolean;
  readonly method: AuthenticationMethod;
  readonly reason: string | null;
  readonly riskScore: number;
  readonly ip: string | null;
  readonly country: string | null;
  readonly deviceFingerprint: string | null;
  readonly at: number;
}

export type MfaFactorKind =
  | "totp"
  | "email_otp"
  | "sms_otp"
  | "authenticator_app"
  | "webauthn"
  | "passkey"
  | "recovery_code"
  | "backup_code";

export interface MfaEnrollment {
  readonly id: string;
  readonly userId: string;
  readonly factor: MfaFactorKind;
  readonly status: "pending" | "active" | "revoked";
  readonly label: string;
  readonly createdAt: number;
  readonly verifiedAt: number | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export type FederationProtocol = "oidc" | "oauth2" | "saml";
export type FederationProviderId =
  | "google"
  | "microsoft"
  | "apple"
  | "github"
  | "enterprise_sso"
  | "custom";

export interface FederatedIdentity {
  readonly id: string;
  readonly userId: string;
  readonly provider: FederationProviderId;
  readonly protocol: FederationProtocol;
  readonly subject: string;
  readonly linkedAt: number;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface AuthenticationResult {
  readonly userId: string;
  readonly session: IamSession;
  readonly accessToken: IssuedToken;
  readonly refreshToken: IssuedToken;
  readonly method: AuthenticationMethod;
  readonly mfaRequired: boolean;
  readonly device: Device | null;
}

export interface IamSnapshot {
  readonly at: number;
  readonly credentials: number;
  readonly sessions: number;
  readonly devices: number;
  readonly tokens: number;
  readonly roles: number;
  readonly permissions: number;
  readonly apiKeys: number;
  readonly serviceAccounts: number;
}
