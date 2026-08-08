/**
 * IAM Platform — IamRuntime facade + factory.
 * The ONLY sanctioned entry point outside this package.
 */
import { assertProductionIamConfig, createIamConfig, type IamConfig } from "./config";
import { SYSTEM_ROLES } from "./authorization";
import { IamEventBus, type IamEventListener } from "./events";
import { collectIamHealth, type IamHealthReport } from "./health";
import { AuthenticationManager } from "./manager";
import { SecurityEventPublisher } from "./outbox";

import { IAM_METRIC, IamMetrics, type IamMetricsSnapshot } from "./metrics";
import type { PasswordHasher } from "./password";
import type { IamPorts } from "./ports";
import {
  activityCard, apiKeyCard, deviceCard, loginCard, permissionCard,
  profileSecurityCard, securityCard, sessionCard, type IamCard,
} from "./presentation";
import { noopIamTelemetry, type IamTelemetrySink } from "./telemetry";
import type { TokenSigner, TokenVerifier } from "./tokens";
import type { AuthorizationContext, AuthorizationDecision, IamSnapshot, RoleAssignment } from "./types";

export interface IamRuntimeOptions {
  readonly config?: Partial<IamConfig>;
  readonly ports: IamPorts;
  readonly telemetry?: IamTelemetrySink;
  readonly hasher?: PasswordHasher;
  readonly signer?: TokenSigner & TokenVerifier;
  readonly signingSecret?: string;
  readonly now?: () => number;
}

export class IamRuntime {
  readonly config: IamConfig;
  readonly events = new IamEventBus();
  readonly metrics = new IamMetrics();
  readonly manager: AuthenticationManager;
  readonly securityEvents: SecurityEventPublisher;

  constructor(options: IamRuntimeOptions) {
    this.config = createIamConfig(options.config ?? {});
    assertProductionIamConfig(this.config);
    this.manager = new AuthenticationManager({
      config: this.config,
      ports: options.ports,
      events: this.events,
      metrics: this.metrics,
      telemetry: options.telemetry ?? noopIamTelemetry,
      hasher: options.hasher,
      signer: options.signer,
      signingSecret: options.signingSecret,
      now: options.now,
    });
    this.securityEvents = new SecurityEventPublisher({
      eventStore: options.ports.eventStore,
      outbox: options.ports.outbox,
    });
    this.securityEvents.attach(this.events);
  }


  /** Seeds the system role hierarchy. Idempotent; no business permissions. */
  async bootstrap(): Promise<void> {
    for (const role of SYSTEM_ROLES) {
      await this.manager.authorization.defineRole({ ...role, system: true });
    }
  }

  on(listener: IamEventListener): () => void {
    return this.events.on(listener);
  }

  /* --------------------------------------------------------- delegation */
  get auth() {
    return this.manager;
  }
  get sessions() {
    return this.manager.sessions;
  }
  get devices() {
    return this.manager.devices;
  }
  get tokens() {
    return this.manager.tokens;
  }
  get authorization() {
    return this.manager.authorization;
  }
  get apiKeys() {
    return this.manager.apiKeys;
  }
  get mfa() {
    return this.manager.mfa;
  }
  get federation() {
    return this.manager.federation;
  }
  get loginSecurity() {
    return this.manager.loginSecurity;
  }
  get audit() {
    return this.manager.auditor;
  }

  async assignRole(subjectId: string, roleCode: string, grantedBy: string | null = null): Promise<RoleAssignment> {
    const assignment = await this.manager.authorization.assignRole({
      subjectId, subjectKind: "user", roleCode, grantedBy,
    });
    this.metrics.inc(IAM_METRIC.roleAssignments);
    this.events.emit("RoleAssigned", subjectId, { roleCode });
    await this.manager.auditor.record({
      action: "role_change", actorId: grantedBy, subjectId,
      collection: "iam_role_assignments", recordId: assignment.id, after: { roleCode },
    });
    return assignment;
  }

  async contextFor(userId: string, scopes: readonly string[] = []): Promise<AuthorizationContext> {
    return this.manager.authorization.buildContext({ subjectId: userId, subjectKind: "user", scopes });
  }

  async can(userId: string, permission: string): Promise<boolean> {
    this.metrics.inc(IAM_METRIC.permissionChecks);
    const allowed = await this.manager.authorization.can(permission, await this.contextFor(userId));
    if (!allowed) {
      this.metrics.inc(IAM_METRIC.permissionDenials);
      this.events.emit("PermissionDenied", userId, { permission });
    }
    return allowed;
  }

  async decide(userId: string, permission: string): Promise<AuthorizationDecision> {
    this.metrics.inc(IAM_METRIC.permissionChecks);
    return this.manager.authorization.decide(permission, await this.contextFor(userId));
  }

  /* ------------------------------------------------------- presentation */

  async cards(userId: string): Promise<readonly IamCard[]> {
    const at = Date.now();
    const [sessions, devices, attempts, keys, credential, roles] = await Promise.all([
      this.manager.sessions.listFor(userId),
      this.manager.devices.listFor(userId),
      this.manager.loginSecurity.attemptsFor(userId),
      this.manager.apiKeys.listFor(userId),
      this.manager.credentials.first((c) => c.userId === userId),
      this.manager.authorization.rolesFor(userId),
    ]);
    const permissions = await this.manager.authorization.effectivePermissions(roles);
    const federated = (await this.manager.federation.listFor(userId)).map((f) => f.provider);
    const decision = await this.decide(userId, "iam.profile.read");
    const cards: IamCard[] = [
      securityCard({
        userId,
        mfaEnabled: await this.manager.mfa.hasActiveFactor(userId),
        activeSessions: (await this.manager.sessions.activeFor(userId, at)).length,
        trustedDevices: devices.filter((d) => d.trust === "trusted").length,
        lastPasswordChangeAt: credential?.passwordChangedAt ?? null,
      }),
      profileSecurityCard({ userId, roles, permissions, federatedProviders: federated }),
      permissionCard(decision),
      activityCard(userId, attempts),
    ];
    for (const s of sessions) cards.push(sessionCard(s, at));
    for (const d of devices) cards.push(deviceCard(d));
    for (const k of keys) cards.push(apiKeyCard(k));
    const latest = attempts[0];
    if (latest) cards.push(loginCard(latest));
    return Object.freeze(cards);
  }

  /* ------------------------------------------------------ observability */

  snapshot(): Promise<IamSnapshot> {
    return this.manager.snapshot();
  }
  metricsSnapshot(): IamMetricsSnapshot {
    return this.metrics.snapshot();
  }
  health(): Promise<IamHealthReport> {
    return collectIamHealth(this.manager);
  }
}

export function createIamRuntime(options: IamRuntimeOptions): IamRuntime {
  return new IamRuntime(options);
}

/** Convenience factory that seeds the system roles. */
export async function bootstrapIamRuntime(options: IamRuntimeOptions): Promise<IamRuntime> {
  const runtime = new IamRuntime(options);
  await runtime.bootstrap();
  return runtime;
}
