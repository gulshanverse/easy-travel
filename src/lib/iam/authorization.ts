/**
 * IAM Platform — Authorization Platform (ADR-026).
 * RBAC with role hierarchy and permission inheritance, deterministic policy
 * evaluation and an ABAC-ready policy interface. Provider independent.
 */
import { PermissionDeniedError, RoleCycleError } from "./errors";
import { newPermissionGroupId, newPermissionId, newRoleAssignmentId, newRoleId } from "./ids";
import type { CollectionStore } from "./stores";
import type {
  AuthorizationContext,
  AuthorizationDecision,
  Permission,
  PermissionGroup,
  Role,
  RoleAssignment,
} from "./types";

/** Future-ABAC policy hook: evaluated after RBAC, may allow or deny. */
export interface AuthorizationPolicy {
  readonly id: string;
  readonly description: string;
  evaluate(
    permission: string,
    context: AuthorizationContext,
  ): { readonly effect: "allow" | "deny" | "abstain"; readonly reason: string };
}

export interface PermissionCheckInput {
  readonly permission: string;
  readonly context: AuthorizationContext;
}

export class AuthorizationManager {
  private readonly policies: AuthorizationPolicy[] = [];

  constructor(
    private readonly roles: CollectionStore<Role>,
    private readonly permissions: CollectionStore<Permission>,
    private readonly groups: CollectionStore<PermissionGroup>,
    private readonly assignments: CollectionStore<RoleAssignment>,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /* -------------------------------------------------------- permissions */

  async definePermission(code: string, description = "", group: string | null = null): Promise<Permission> {
    const existing = await this.permissions.first((p) => p.code === code);
    if (existing) return existing;
    const permission: Permission = Object.freeze({
      id: newPermissionId(),
      code,
      description,
      group,
      createdAt: this.now(),
    });
    await this.permissions.put(permission);
    return permission;
  }

  async defineGroup(code: string, permissions: readonly string[], description = ""): Promise<PermissionGroup> {
    const group: PermissionGroup = Object.freeze({
      id: newPermissionGroupId(),
      code,
      description,
      permissions: Object.freeze([...permissions]),
    });
    await this.groups.put(group);
    return group;
  }

  listPermissions(): Promise<readonly Permission[]> {
    return this.permissions.all() as Promise<readonly Permission[]>;
  }

  /* --------------------------------------------------------------- roles */

  async defineRole(input: {
    code: string;
    description?: string;
    parents?: readonly string[];
    permissions?: readonly string[];
    system?: boolean;
  }): Promise<Role> {
    const existing = await this.roles.first((r) => r.code === input.code);
    const role: Role = Object.freeze({
      id: existing?.id ?? newRoleId(),
      code: input.code,
      description: input.description ?? existing?.description ?? "",
      parents: Object.freeze([...(input.parents ?? existing?.parents ?? [])]),
      permissions: Object.freeze([...(input.permissions ?? existing?.permissions ?? [])]),
      system: input.system ?? existing?.system ?? false,
      createdAt: existing?.createdAt ?? this.now(),
    });
    await this.assertNoCycle(role);
    await this.roles.put(role);
    for (const code of role.permissions) await this.definePermission(code);
    return role;
  }

  private async assertNoCycle(role: Role): Promise<void> {
    const all = await this.roles.all();
    const byCode = new Map(all.map((r) => [r.code, r]));
    byCode.set(role.code, role);
    const seen = new Set<string>();
    const walk = (code: string, path: readonly string[]): void => {
      if (path.includes(code))
        throw new RoleCycleError(`role hierarchy cycle: ${[...path, code].join(" -> ")}`);
      if (seen.has(code)) return;
      seen.add(code);
      for (const parent of byCode.get(code)?.parents ?? []) walk(parent, [...path, code]);
      seen.delete(code);
    };
    walk(role.code, []);
  }

  async getRole(code: string): Promise<Role | undefined> {
    return this.roles.first((r) => r.code === code);
  }

  listRoles(): Promise<readonly Role[]> {
    return this.roles.all() as Promise<readonly Role[]>;
  }

  /** Resolves a role's effective permissions, following the parent hierarchy. */
  async effectivePermissions(roleCodes: readonly string[]): Promise<readonly string[]> {
    const all = await this.roles.all();
    const byCode = new Map(all.map((r) => [r.code, r]));
    const out = new Set<string>();
    const visited = new Set<string>();
    const walk = (code: string): void => {
      if (visited.has(code)) return;
      visited.add(code);
      const role = byCode.get(code);
      if (!role) return;
      for (const p of role.permissions) out.add(p);
      for (const parent of role.parents) walk(parent);
    };
    for (const code of roleCodes) walk(code);
    return Object.freeze([...out].sort());
  }

  /* --------------------------------------------------------- assignments */

  async assignRole(input: {
    subjectId: string;
    subjectKind: RoleAssignment["subjectKind"];
    roleCode: string;
    grantedBy?: string | null;
    expiresAt?: number | null;
  }): Promise<RoleAssignment> {
    const assignment: RoleAssignment = Object.freeze({
      id: newRoleAssignmentId(),
      subjectId: input.subjectId,
      subjectKind: input.subjectKind,
      roleCode: input.roleCode,
      grantedBy: input.grantedBy ?? null,
      grantedAt: this.now(),
      expiresAt: input.expiresAt ?? null,
    });
    await this.assignments.put(assignment);
    return assignment;
  }

  async revokeRole(subjectId: string, roleCode: string): Promise<number> {
    const rows = await this.assignments.where(
      (a) => a.subjectId === subjectId && a.roleCode === roleCode,
    );
    for (const r of rows) await this.assignments.remove(r.id);
    return rows.length;
  }

  async rolesFor(subjectId: string, at: number = this.now()): Promise<readonly string[]> {
    const rows = await this.assignments.where(
      (a) => a.subjectId === subjectId && (a.expiresAt === null || a.expiresAt > at),
    );
    return Object.freeze([...new Set(rows.map((r) => r.roleCode))].sort());
  }

  /* -------------------------------------------------------- context/eval */

  async buildContext(input: {
    subjectId: string;
    subjectKind: AuthorizationContext["subjectKind"];
    scopes?: readonly string[];
    claims?: Readonly<Record<string, unknown>>;
    at?: number;
  }): Promise<AuthorizationContext> {
    const at = input.at ?? this.now();
    const roles = await this.rolesFor(input.subjectId, at);
    const permissions = await this.effectivePermissions(roles);
    return Object.freeze({
      subjectId: input.subjectId,
      subjectKind: input.subjectKind,
      roles,
      permissions,
      scopes: Object.freeze([...(input.scopes ?? [])]),
      claims: Object.freeze({ ...(input.claims ?? {}) }),
      at,
    });
  }

  registerPolicy(policy: AuthorizationPolicy): void {
    this.policies.push(policy);
  }

  /** Deterministic decision: explicit deny wins, then RBAC, then default deny. */
  async decide(permission: string, context: AuthorizationContext): Promise<AuthorizationDecision> {
    const explanation: string[] = [];
    for (const policy of this.policies) {
      const result = policy.evaluate(permission, context);
      if (result.effect === "deny")
        return this.decision(false, permission, context, null, policy.id, result.reason, [
          ...explanation,
          `policy '${policy.id}' denied: ${result.reason}`,
        ]);
      if (result.effect === "allow")
        return this.decision(true, permission, context, null, policy.id, result.reason, [
          ...explanation,
          `policy '${policy.id}' allowed: ${result.reason}`,
        ]);
      explanation.push(`policy '${policy.id}' abstained`);
    }

    if (context.permissions.includes(permission) || context.permissions.includes("*")) {
      const matchedRole = await this.roleGranting(permission, context.roles);
      return this.decision(true, permission, context, matchedRole, null, "granted by role", [
        ...explanation,
        `permission '${permission}' granted via role '${matchedRole ?? "wildcard"}'`,
      ]);
    }

    const wildcard = context.permissions.find(
      (p) => p.endsWith(".*") && permission.startsWith(p.slice(0, -1)),
    );
    if (wildcard) {
      return this.decision(true, permission, context, null, null, "granted by wildcard", [
        ...explanation,
        `permission '${permission}' matched wildcard '${wildcard}'`,
      ]);
    }

    return this.decision(false, permission, context, null, null, "no matching grant", [
      ...explanation,
      `subject holds ${context.permissions.length} permission(s); none match '${permission}'`,
    ]);
  }

  async can(permission: string, context: AuthorizationContext): Promise<boolean> {
    return (await this.decide(permission, context)).allowed;
  }

  async require(permission: string, context: AuthorizationContext): Promise<AuthorizationDecision> {
    const decision = await this.decide(permission, context);
    if (!decision.allowed) throw new PermissionDeniedError(permission, context.subjectId);
    return decision;
  }

  async count(): Promise<{ roles: number; permissions: number }> {
    return { roles: await this.roles.count(), permissions: await this.permissions.count() };
  }

  private async roleGranting(permission: string, roles: readonly string[]): Promise<string | null> {
    for (const code of roles) {
      const perms = await this.effectivePermissions([code]);
      if (perms.includes(permission) || perms.includes("*")) return code;
    }
    return null;
  }

  private decision(
    allowed: boolean,
    permission: string,
    context: AuthorizationContext,
    matchedRole: string | null,
    matchedPolicy: string | null,
    reason: string,
    explanation: readonly string[],
  ): AuthorizationDecision {
    return Object.freeze({
      allowed,
      permission,
      subjectId: context.subjectId,
      matchedRole,
      matchedPolicy,
      reason,
      explanation: Object.freeze([...explanation]),
      at: context.at,
    });
  }
}

/** System roles seeded at composition time. No business permissions. */
export const SYSTEM_ROLES = Object.freeze([
  Object.freeze({ code: "guest", description: "Unauthenticated visitor", permissions: Object.freeze(["iam.session.read"]) }),
  Object.freeze({ code: "user", description: "Authenticated end user", parents: Object.freeze(["guest"]), permissions: Object.freeze(["iam.profile.read", "iam.session.manage", "iam.device.manage"]) }),
  Object.freeze({ code: "moderator", description: "Elevated operator", parents: Object.freeze(["user"]), permissions: Object.freeze(["iam.audit.read"]) }),
  Object.freeze({ code: "admin", description: "Platform administrator", parents: Object.freeze(["moderator"]), permissions: Object.freeze(["iam.*"]) }),
  Object.freeze({ code: "service", description: "Machine principal", permissions: Object.freeze(["iam.token.introspect"]) }),
]);
