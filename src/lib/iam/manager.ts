/**
 * IAM Platform — AuthenticationManager.
 * Orchestrates credentials, passwords, tokens, sessions, devices, login
 * security and audit. All state is persisted; nothing is cached in memory.
 */
import { IamAuditor } from "./audit";
import { ApiKeyManager } from "./apikeys";
import { AuthorizationManager } from "./authorization";
import { IAM_COLLECTIONS } from "./collections";
import type { IamConfig } from "./config";
import {
  CredentialManager,
  CredentialRegistry,
  type CredentialVerifier,
} from "./credentials";
import { randomToken, sha256 } from "./crypto";
import { DeviceManager, type DeviceProfileInput } from "./devices";
import {
  AccountLifecycleManager,
  DEFAULT_ACCOUNT_LIFECYCLE_POLICY,
  type AccountLifecycleRecord,
  type AccountLifecycleState,
  type AccountLifecycleTransition,
} from "./lifecycle";
import { IdentityRiskManager, type IdentityRiskDecision } from "./risk";

import {
  AccountInactiveError,
  AccountLockedError,
  InvalidCredentialsError,
  PasswordExpiredError,
  RateLimitError,
} from "./errors";
import { IamEventBus } from "./events";
import { newCredentialId, newPasswordHistoryId, newResetTokenId } from "./ids";
import { LoginSecurityManager, assessRisk } from "./login-security";
import { IAM_METRIC, IamMetrics } from "./metrics";
import { MfaManager } from "./mfa";
import {
  assertNoReuse,
  isPasswordExpired,
  PasswordValidator,
  Pbkdf2PasswordHasher,
  type PasswordHasher,
} from "./password";
import type { IamPorts } from "./ports";
import { FederationManager } from "./federation";
import { SessionManager } from "./sessions";
import { storeFor, type CollectionStore } from "./stores";
import { HmacTokenSigner, TokenService, type TokenSigner, type TokenVerifier } from "./tokens";
import type { IamTelemetrySink } from "./telemetry";
import type {
  AuthenticationMethod,
  AuthenticationResult,
  Credential,
  IamSession,
  IamSnapshot,
  PasswordHistoryEntry,
  PasswordResetToken,
} from "./types";

export interface AuthenticationManagerDeps {
  readonly config: IamConfig;
  readonly ports: IamPorts;
  readonly events: IamEventBus;
  readonly metrics: IamMetrics;
  readonly telemetry: IamTelemetrySink;
  readonly hasher?: PasswordHasher;
  readonly signer?: TokenSigner & TokenVerifier;
  readonly signingSecret?: string;
  readonly now?: () => number;
}

export interface LoginInput {
  readonly identifier: string;
  readonly password: string;
  readonly method?: AuthenticationMethod;
  readonly rememberMe?: boolean;
  readonly device?: DeviceProfileInput;
  readonly ip?: string | null;
  readonly country?: string | null;
}

function normalize(identifier: string): string {
  return identifier.trim().toLowerCase();
}

export class AuthenticationManager {
  readonly credentials: CollectionStore<Credential>;
  readonly passwordHistory: CollectionStore<PasswordHistoryEntry>;
  readonly resetTokens: CollectionStore<PasswordResetToken>;
  readonly tokens: TokenService;
  readonly sessions: SessionManager;
  readonly devices: DeviceManager;
  readonly authorization: AuthorizationManager;
  readonly apiKeys: ApiKeyManager;
  readonly mfa: MfaManager;
  readonly federation: FederationManager;
  readonly loginSecurity: LoginSecurityManager;
  readonly lifecycle: AccountLifecycleManager;
  readonly credentialPlatform: CredentialManager;
  readonly risk: IdentityRiskManager;
  readonly auditor: IamAuditor;
  readonly hasher: PasswordHasher;
  readonly validator: PasswordValidator;


  private readonly config: IamConfig;
  private readonly events: IamEventBus;
  private readonly metrics: IamMetrics;
  private readonly telemetry: IamTelemetrySink;
  private readonly clock: () => number;

  constructor(deps: AuthenticationManagerDeps) {
    this.config = deps.config;
    this.events = deps.events;
    this.metrics = deps.metrics;
    this.telemetry = deps.telemetry;
    this.clock = deps.now ?? (() => Date.now());

    const persistence = deps.ports.persistence;
    if (!persistence)
      throw new Error("IAM requires a persistence port — in-memory authentication is prohibited");

    this.credentials = storeFor<Credential>(persistence, IAM_COLLECTIONS.credentials, (c) => c.userId);
    this.passwordHistory = storeFor<PasswordHistoryEntry>(persistence, IAM_COLLECTIONS.passwordHistory, (h) => h.userId);
    this.resetTokens = storeFor<PasswordResetToken>(persistence, IAM_COLLECTIONS.passwordResetTokens, (t) => t.userId);
    this.hasher = deps.hasher ?? new Pbkdf2PasswordHasher(this.config.environment === "production" ? 210_000 : 10_000);
    this.validator = new PasswordValidator(this.config.password);
    this.tokens = new TokenService(
      this.config.token,
      storeFor(persistence, IAM_COLLECTIONS.tokens, (t) => t.userId),
      deps.signer ?? new HmacTokenSigner(deps.signingSecret ?? randomToken(32)),
      this.clock,
    );
    this.sessions = new SessionManager(
      this.config.session,
      storeFor(persistence, IAM_COLLECTIONS.sessions, (s) => s.userId),
      storeFor(persistence, IAM_COLLECTIONS.sessionHistory, (h) => h.userId),
      this.clock,
    );
    this.devices = new DeviceManager(storeFor(persistence, IAM_COLLECTIONS.devices, (d) => d.userId), this.clock);
    this.authorization = new AuthorizationManager(
      storeFor(persistence, IAM_COLLECTIONS.roles),
      storeFor(persistence, IAM_COLLECTIONS.permissions),
      storeFor(persistence, IAM_COLLECTIONS.permissionGroups),
      storeFor(persistence, IAM_COLLECTIONS.roleAssignments),
      this.clock,
    );
    this.apiKeys = new ApiKeyManager(
      storeFor(persistence, IAM_COLLECTIONS.apiKeys, (k) => k.ownerId),
      storeFor(persistence, IAM_COLLECTIONS.serviceAccounts),
      undefined,
      this.clock,
    );
    this.mfa = new MfaManager(storeFor(persistence, IAM_COLLECTIONS.mfaEnrollments, (e) => e.userId), this.clock);
    this.federation = new FederationManager(
      storeFor(persistence, IAM_COLLECTIONS.federatedIdentities, (i) => i.userId),
      this.clock,
    );
    this.loginSecurity = new LoginSecurityManager(
      this.config.loginSecurity,
      storeFor(persistence, IAM_COLLECTIONS.loginAttempts, (a) => a.userId),
      this.clock,
    );
    this.auditor = new IamAuditor(deps.ports.audit, this.config.auditEnabled);
  }

  /* ------------------------------------------------------- credentials */

  async registerPassword(input: {
    userId: string;
    identifier: string;
    password: string;
    kind?: "email_password" | "username_password";
    activated?: boolean;
  }): Promise<Credential> {
    this.validator.assert(input.password);
    await this.validator.assertNotBreached(input.password);
    const at = this.clock();
    const hash = await this.metrics.timed(IAM_METRIC.passwordHashLatency, () =>
      this.hasher.hash(input.password),
    );
    const credential: Credential = Object.freeze({
      id: newCredentialId(),
      userId: input.userId,
      kind: "password",
      identifier: input.identifier,
      normalizedIdentifier: normalize(input.identifier),
      secretHash: hash,
      algorithm: this.hasher.algorithm,
      status: input.activated ? "active" : "pending",
      emailVerified: false,
      mfaEnabled: false,
      failedAttempts: 0,
      lockedUntil: null,
      passwordChangedAt: at,
      lastLoginAt: null,
      createdAt: at,
      updatedAt: at,
    });
    await this.credentials.put(credential);
    await this.passwordHistory.put(
      Object.freeze({
        id: newPasswordHistoryId(),
        userId: input.userId,
        hash,
        algorithm: this.hasher.algorithm,
        createdAt: at,
      }),
    );
    await this.auditor.record({
      action: "password_change",
      actorId: input.userId,
      subjectId: input.userId,
      collection: IAM_COLLECTIONS.credentials,
      recordId: credential.id,
      after: { status: credential.status },
    });
    return credential;
  }

  async findCredential(identifier: string): Promise<Credential | undefined> {
    const normalized = normalize(identifier);
    return this.credentials.first((c) => c.normalizedIdentifier === normalized);
  }

  async activateAccount(userId: string): Promise<Credential> {
    const credential = await this.requireCredentialByUser(userId);
    const next: Credential = Object.freeze({ ...credential, status: "active", updatedAt: this.clock() });
    await this.credentials.put(next);
    this.events.emit("AccountActivated", userId);
    return next;
  }

  async verifyEmail(userId: string): Promise<Credential> {
    const credential = await this.requireCredentialByUser(userId);
    const next: Credential = Object.freeze({
      ...credential,
      emailVerified: true,
      status: credential.status === "pending" ? "active" : credential.status,
      updatedAt: this.clock(),
    });
    await this.credentials.put(next);
    this.events.emit("EmailVerified", userId);
    return next;
  }

  /* ------------------------------------------------------------ login */

  async login(input: LoginInput): Promise<AuthenticationResult> {
    const started = this.clock();
    return this.telemetry.span("iam.login", async () => {
      const identifier = normalize(input.identifier);
      if (!this.loginSecurity.rateLimit(identifier, started)) {
        this.metrics.inc(IAM_METRIC.rateLimited);
        this.events.emit("RateLimitTriggered", null, { identifier });
        throw new RateLimitError("too many authentication attempts");
      }

      const lockout = await this.loginSecurity.lockoutState(identifier, started);
      if (lockout.locked) {
        this.metrics.inc(IAM_METRIC.lockouts);
        this.events.emit("AccountLocked", null, { identifier, until: lockout.until });
        await this.auditor.record({
          action: "lockout", actorId: null, subjectId: null,
          collection: IAM_COLLECTIONS.credentials, recordId: identifier,
          after: { until: lockout.until },
        });
        throw new AccountLockedError("account temporarily locked", { until: lockout.until });
      }

      const credential = await this.findCredential(identifier);
      const method: AuthenticationMethod =
        input.method ?? (identifier.includes("@") ? "email_password" : "username_password");

      const fail = async (reason: string): Promise<never> => {
        this.metrics.inc(IAM_METRIC.loginFailure);
        await this.loginSecurity.record({
          identifier, userId: credential?.userId ?? null, success: false, method,
          reason, ip: input.ip ?? null, country: input.country ?? null,
        });
        this.events.emit("LoginFailed", credential?.userId ?? null, { identifier, reason });
        await this.auditor.record({
          action: "login_failed", actorId: null, subjectId: credential?.userId ?? null,
          collection: IAM_COLLECTIONS.credentials, recordId: credential?.id ?? identifier,
          after: { reason },
        });
        throw new InvalidCredentialsError({ reason });
      };

      if (!credential || !credential.secretHash) return fail("unknown_identifier");
      if (credential.status !== "active")
        throw new AccountInactiveError(`account is ${credential.status}`);
      if (!(await this.hasher.verify(input.password, credential.secretHash)))
        return fail("bad_password");
      if (isPasswordExpired(credential.passwordChangedAt, this.config.password, started))
        throw new PasswordExpiredError("password has expired and must be changed");

      const device = input.device ? await this.devices.register(credential.userId, input.device) : null;
      const knownCountries = await this.loginSecurity.knownCountries(credential.userId);
      const risk = assessRisk(
        {
          newDevice: device !== null && device.firstSeenAt === device.lastSeenAt,
          untrustedDevice: device !== null && device.trust !== "trusted",
          newCountry: Boolean(input.country) && !knownCountries.includes(input.country as string),
          recentFailures: lockout.failures,
          guest: false,
        },
        this.config.loginSecurity.suspiciousRiskThreshold,
      );
      if (risk.suspicious) {
        this.metrics.inc(IAM_METRIC.suspiciousLogins);
        this.events.emit("SuspiciousLoginDetected", credential.userId, { factors: risk.factors });
      }

      const roles = await this.authorization.rolesFor(credential.userId, started);
      const session = await this.sessions.start({
        userId: credential.userId,
        method,
        deviceId: device?.id ?? null,
        rememberMe: input.rememberMe ?? false,
        amr: ["pwd"],
        metadata: { ip: input.ip ?? null, country: input.country ?? null, riskScore: risk.score },
      });
      const result = await this.issuePair(credential.userId, session, roles);

      await this.credentials.put(
        Object.freeze({ ...credential, failedAttempts: 0, lastLoginAt: started, updatedAt: started }),
      );
      await this.loginSecurity.record({
        identifier, userId: credential.userId, success: true, method,
        riskScore: risk.score, ip: input.ip ?? null, country: input.country ?? null,
        deviceFingerprint: device?.fingerprint ?? null,
      });
      this.metrics.inc(IAM_METRIC.loginSuccess);
      this.metrics.observe(IAM_METRIC.loginLatency, this.clock() - started);
      this.events.emit("LoginSucceeded", credential.userId, { sessionId: session.id, method });
      await this.auditor.record({
        action: "login", actorId: credential.userId, subjectId: credential.userId,
        collection: IAM_COLLECTIONS.sessions, recordId: session.id,
        after: { method, riskScore: risk.score },
      });

      return Object.freeze({
        userId: credential.userId,
        session,
        accessToken: result.access,
        refreshToken: result.refresh,
        method,
        mfaRequired: this.config.mfaRequired && !(await this.mfa.hasActiveFactor(credential.userId)),
        device,
      });
    });
  }

  private async issuePair(userId: string, session: IamSession, roles: readonly string[]) {
    const access = await this.tokens.issue({ userId, sessionId: session.id, type: "access", roles, amr: session.amr });
    const refresh = await this.tokens.issue({ userId, sessionId: session.id, type: "refresh", roles, amr: session.amr });
    this.metrics.inc(IAM_METRIC.tokensIssued, 2);
    this.events.emit("TokenIssued", userId, { sessionId: session.id });
    return { access, refresh };
  }

  /** Guest sessions carry no credential and only the `guest` role. */
  async startGuestSession(): Promise<AuthenticationResult> {
    const userId = `guest_${randomToken(8)}`;
    const session = await this.sessions.start({ userId, method: "guest", guest: true, amr: [] });
    const { access, refresh } = await this.issuePair(userId, session, ["guest"]);
    this.metrics.inc(IAM_METRIC.guestSessions);
    this.events.emit("GuestSessionStarted", userId, { sessionId: session.id });
    return Object.freeze({
      userId, session, accessToken: access, refreshToken: refresh,
      method: "guest" as AuthenticationMethod, mfaRequired: false, device: null,
    });
  }

  async refresh(refreshToken: string) {
    const { record } = await this.tokens.validate(refreshToken, "refresh");
    if (record.sessionId) await this.sessions.touch(record.sessionId);
    const roles = await this.authorization.rolesFor(record.userId);
    const rotated = await this.tokens.rotate(refreshToken, {
      userId: record.userId,
      sessionId: record.sessionId,
      roles,
    });
    this.metrics.inc(IAM_METRIC.tokensRotated);
    this.events.emit("TokenRotated", record.userId, { sessionId: record.sessionId });
    await this.auditor.record({
      action: "token_rotation", actorId: record.userId, subjectId: record.userId,
      collection: IAM_COLLECTIONS.tokens, recordId: record.id, after: { sessionId: record.sessionId },
    });
    return rotated;
  }

  async logout(sessionId: string, reason = "user_logout"): Promise<void> {
    const session = await this.sessions.revoke(sessionId, reason);
    const revoked = await this.tokens.revokeForSession(sessionId, reason);
    this.metrics.inc(IAM_METRIC.logout);
    this.metrics.inc(IAM_METRIC.sessionsRevoked);
    this.metrics.inc(IAM_METRIC.tokensRevoked, revoked);
    this.events.emit("LoggedOut", session?.userId ?? null, { sessionId });
    await this.auditor.record({
      action: "logout", actorId: session?.userId ?? null, subjectId: session?.userId ?? null,
      collection: IAM_COLLECTIONS.sessions, recordId: sessionId, after: { reason },
    });
  }

  /** Step-up authentication for sensitive operations. */
  async reauthenticate(sessionId: string, password: string): Promise<IamSession> {
    const session = await this.sessions.get(sessionId);
    if (!session) throw new InvalidCredentialsError({ reason: "unknown_session" });
    const credential = await this.requireCredentialByUser(session.userId);
    if (!credential.secretHash || !(await this.hasher.verify(password, credential.secretHash)))
      throw new InvalidCredentialsError({ reason: "bad_password" });
    const next = await this.sessions.markReauthenticated(sessionId);
    this.metrics.inc(IAM_METRIC.reauth);
    this.events.emit("Reauthenticated", session.userId, { sessionId });
    return next;
  }

  /* --------------------------------------------------------- passwords */

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<Credential> {
    const credential = await this.requireCredentialByUser(userId);
    if (!credential.secretHash || !(await this.hasher.verify(currentPassword, credential.secretHash)))
      throw new InvalidCredentialsError({ reason: "bad_password" });
    return this.setPassword(credential, newPassword, "password_change");
  }

  private async setPassword(credential: Credential, newPassword: string, action: "password_change" | "password_reset") {
    this.validator.assert(newPassword);
    await this.validator.assertNotBreached(newPassword);
    const history = await this.passwordHistory.where((h) => h.userId === credential.userId);
    await assertNoReuse(newPassword, history, this.hasher, this.config.password.historyDepth);

    const at = this.clock();
    const hash = await this.metrics.timed(IAM_METRIC.passwordHashLatency, () => this.hasher.hash(newPassword));
    const next: Credential = Object.freeze({
      ...credential, secretHash: hash, algorithm: this.hasher.algorithm,
      passwordChangedAt: at, updatedAt: at, failedAttempts: 0,
    });
    await this.credentials.put(next);
    await this.passwordHistory.put(
      Object.freeze({
        id: newPasswordHistoryId(), userId: credential.userId, hash,
        algorithm: this.hasher.algorithm, createdAt: at,
      }),
    );
    await this.sessions.revokeAllForUser(credential.userId, action);
    await this.tokens.revokeForUser(credential.userId, action);
    this.metrics.inc(IAM_METRIC.passwordChanges);
    this.events.emit("PasswordChanged", credential.userId, { action });
    await this.auditor.record({
      action, actorId: credential.userId, subjectId: credential.userId,
      collection: IAM_COLLECTIONS.credentials, recordId: credential.id, after: { changedAt: at },
    });
    return next;
  }

  /** Returns the raw reset token exactly once; only its hash is persisted. */
  async requestPasswordReset(identifier: string): Promise<{ token: string; record: PasswordResetToken } | null> {
    const credential = await this.findCredential(identifier);
    if (!credential) return null;
    const at = this.clock();
    const token = randomToken(32);
    const record: PasswordResetToken = Object.freeze({
      id: newResetTokenId(),
      userId: credential.userId,
      tokenHash: await sha256(token),
      expiresAt: at + this.config.password.resetTokenTtlMs,
      usedAt: null,
      createdAt: at,
    });
    await this.resetTokens.put(record);
    this.events.emit("PasswordResetRequested", credential.userId, {});
    return { token, record };
  }

  async completePasswordReset(token: string, newPassword: string): Promise<Credential> {
    const hash = await sha256(token);
    const record = await this.resetTokens.first((t) => t.tokenHash === hash);
    const at = this.clock();
    if (!record || record.usedAt !== null || at > record.expiresAt)
      throw new InvalidCredentialsError({ reason: "invalid_reset_token" });
    const credential = await this.requireCredentialByUser(record.userId);
    const updated = await this.setPassword(credential, newPassword, "password_reset");
    await this.resetTokens.put(Object.freeze({ ...record, usedAt: at }));
    this.events.emit("PasswordResetCompleted", record.userId, {});
    return updated;
  }

  /* --------------------------------------------------------- snapshot */

  async snapshot(): Promise<IamSnapshot> {
    const counts = await this.authorization.count();
    return Object.freeze({
      at: this.clock(),
      credentials: await this.credentials.count(),
      sessions: await this.sessions.count(),
      devices: await this.devices.count(),
      tokens: (await this.tokens.listForUser("*")).length,
      roles: counts.roles,
      permissions: counts.permissions,
      apiKeys: await this.apiKeys.count(),
      serviceAccounts: await this.apiKeys.serviceAccountCount(),
    });
  }

  private async requireCredentialByUser(userId: string): Promise<Credential> {
    const credential = await this.credentials.first((c) => c.userId === userId);
    if (!credential) throw new InvalidCredentialsError({ reason: "unknown_user" });
    return credential;
  }
}
