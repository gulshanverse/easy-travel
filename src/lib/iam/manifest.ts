/**
 * IAM Platform — Engine Contract & Capability Manifest.
 */
export interface IamEngineContract {
  readonly engine: string;
  readonly version: string;
  readonly ownership: readonly string[];
  readonly responsibilities: readonly string[];
  readonly dependencies: readonly string[];
  readonly publishedEvents: readonly string[];
  readonly publicApis: readonly string[];
  readonly extensionPoints: readonly string[];
  readonly integrationContracts: Readonly<Record<string, string>>;
  readonly prohibited: readonly string[];
}

export const AUTHENTICATION_ENGINE_CONTRACT: IamEngineContract = Object.freeze({
  engine: "iam",
  version: "1.0.0",
  ownership: Object.freeze([
    "iam.authentication", "iam.authorization", "iam.sessions", "iam.devices",
    "iam.tokens", "iam.roles", "iam.permissions", "iam.api_keys",
    "iam.service_accounts", "iam.security_policies", "iam.federation", "iam.audit",
  ]),
  responsibilities: Object.freeze([
    "Authenticate principals and issue verifiable tokens.",
    "Own sessions, devices, roles, permissions, API keys and service accounts.",
    "Extend the Identity Platform; never duplicate identity models (ADR-025).",
    "Persist all state through the Persistence Platform; never keep auth state in memory.",
    "Emit fully auditable security events (ADR-028).",
  ]),
  dependencies: Object.freeze([
    "identity.port", "persistence.port", "audit.port", "workflow.port", "agent.port", "studio.port",
  ]),
  publishedEvents: Object.freeze([
    "LoginSucceeded", "LoginFailed", "LoggedOut", "Reauthenticated", "GuestSessionStarted",
    "AccountActivated", "EmailVerified", "AccountLocked", "AccountUnlocked",
    "PasswordChanged", "PasswordResetRequested", "PasswordResetCompleted",
    "TokenIssued", "TokenRotated", "TokenRevoked",
    "SessionStarted", "SessionRefreshed", "SessionRevoked", "SessionExpired",
    "DeviceRegistered", "DeviceTrusted", "DeviceRevoked",
    "RoleAssigned", "RoleRevoked", "PermissionGranted", "PermissionRevoked", "PermissionDenied",
    "ApiKeyCreated", "ApiKeyRotated", "ApiKeyDisabled", "ServiceAccountCreated",
    "MfaEnrolled", "MfaChallenged", "MfaVerified",
    "FederatedIdentityLinked", "SuspiciousLoginDetected", "RateLimitTriggered",
  ]),
  publicApis: Object.freeze([
    "IamRuntime.registerPassword", "IamRuntime.login", "IamRuntime.logout",
    "IamRuntime.reauthenticate", "IamRuntime.startGuestSession", "IamRuntime.refresh",
    "IamRuntime.changePassword", "IamRuntime.requestPasswordReset", "IamRuntime.completePasswordReset",
    "IamRuntime.assignRole", "IamRuntime.can", "IamRuntime.require",
    "IamRuntime.createApiKey", "IamRuntime.rotateApiKey", "IamRuntime.createServiceAccount",
    "IamRuntime.cards", "IamRuntime.snapshot", "IamRuntime.health",
  ]),
  extensionPoints: Object.freeze([
    "iam.password.hasher", "iam.token.signer", "iam.mfa.factor",
    "iam.federation.adapter", "iam.authorization.policy", "iam.breach.check",
    "iam.telemetry.sink", "iam.event.listener",
  ]),
  integrationContracts: Object.freeze({
    identity: "IamIdentityPort",
    persistence: "IamPersistencePort",
    audit: "IamAuditPort",
    workflow: "IamWorkflowPort",
    agent: "IamAgentPort",
    studio: "IamStudioPort",
  }),
  prohibited: Object.freeze([
    "journey.*", "decision.*", "goal.*", "trust.*", "railway.*", "multimodal.*", "spatial.*",
    "google-oauth", "github-oauth", "sms-provider", "email-provider",
  ]),
});

export interface IamCapabilityManifest {
  readonly id: "iam";
  readonly version: string;
  readonly capabilities: readonly string[];
  readonly securityFeatures: readonly string[];
  readonly interfacesOnly: readonly string[];
  readonly metrics: readonly string[];
  readonly collections: readonly string[];
  readonly presentationCards: readonly string[];
}

export const IAM_CAPABILITY_MANIFEST: IamCapabilityManifest = Object.freeze({
  id: "iam",
  version: "1.0.0",
  capabilities: Object.freeze([
    "iam.auth.email_password", "iam.auth.username_password", "iam.auth.passwordless",
    "iam.auth.guest", "iam.auth.remember_me", "iam.auth.reauthentication",
    "iam.account.activation", "iam.account.email_verification", "iam.account.status",
    "iam.password.policy", "iam.password.history", "iam.password.reset",
    "iam.password.strength", "iam.password.reuse_protection", "iam.password.expiration",
    "iam.token.issue", "iam.token.rotate", "iam.token.revoke", "iam.token.validate",
    "iam.session.lifecycle", "iam.session.concurrency", "iam.session.audit",
    "iam.device.registration", "iam.device.trust", "iam.device.revocation",
    "iam.authorization.rbac", "iam.authorization.hierarchy", "iam.authorization.policies",
    "iam.apikey.lifecycle", "iam.service_account.lifecycle",
    "iam.security.lockout", "iam.security.rate_limit", "iam.security.risk_score",
    "iam.audit.security_events", "iam.presentation.cards",
  ]),
  securityFeatures: Object.freeze([
    "hashed.credentials", "token.fingerprints_only", "constant_time.compare",
    "refresh.rotation", "idle+absolute.timeouts", "brute_force.lockout",
    "audit.redaction", "default.deny_authorization",
  ]),
  interfacesOnly: Object.freeze([
    "mfa.totp", "mfa.email_otp", "mfa.sms_otp", "mfa.authenticator_app",
    "mfa.webauthn", "mfa.passkey", "mfa.recovery_codes", "mfa.backup_codes",
    "federation.google", "federation.microsoft", "federation.apple",
    "federation.github", "federation.enterprise_sso", "federation.saml",
    "federation.oidc", "federation.oauth2", "password.breach_check",
  ]),
  metrics: Object.freeze([
    "iam.auth.login.success", "iam.auth.login.failure", "iam.auth.login.latency_ms",
    "iam.token.issued", "iam.token.rotated", "iam.token.revoked",
    "iam.session.started", "iam.session.revoked", "iam.device.registered",
    "iam.permission.checks", "iam.permission.denials", "iam.security.lockouts",
  ]),
  collections: Object.freeze([
    "iam_credentials", "iam_password_history", "iam_password_reset_tokens",
    "iam_tokens", "iam_sessions", "iam_session_history", "iam_devices",
    "iam_roles", "iam_permissions", "iam_permission_groups", "iam_role_assignments",
    "iam_api_keys", "iam_service_accounts", "iam_login_attempts",
    "iam_mfa_enrollments", "iam_federated_identities",
  ]),
  presentationCards: Object.freeze([
    "iam.login", "iam.session", "iam.device", "iam.security",
    "iam.permission", "iam.api_key", "iam.activity", "iam.profile_security",
  ]),
});
