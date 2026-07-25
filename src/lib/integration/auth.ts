/** IPCF — authentication abstractions.
 *  Interfaces + deterministic descriptor helpers only.
 *  IPCF NEVER stores secret values; only opaque credential references.
 */
import { IntegrationAuthenticationError } from "./errors";
import { newCredentialRefId } from "./ids";
import type {
  AuthenticationKind, ConnectorAuthentication, ConnectorCredentialReference,
} from "./types";

export interface AuthenticationHookContext {
  readonly connectorId: string;
  readonly kind: AuthenticationKind;
  readonly credentialRef?: ConnectorCredentialReference;
  readonly at: number;
}
export interface AuthenticationDescriptor {
  readonly kind: AuthenticationKind;
  readonly headers: Readonly<Record<string, string>>;
  readonly query: Readonly<Record<string, string>>;
  readonly metadata: Readonly<Record<string, unknown>>;
}
export interface AuthenticationHook {
  readonly kind: AuthenticationKind;
  apply(ctx: AuthenticationHookContext): Promise<AuthenticationDescriptor>;
}
export interface CredentialRefreshHook {
  refresh(ref: ConnectorCredentialReference): Promise<ConnectorCredentialReference>;
}

/** Deterministic no-op descriptor used for pipeline stubbing. */
export function anonymousDescriptor(): AuthenticationDescriptor {
  return Object.freeze({
    kind: "anonymous",
    headers: Object.freeze({}),
    query: Object.freeze({}),
    metadata: Object.freeze({}),
  });
}

export function makeCredentialRef(input: {
  ref: string; kind: AuthenticationKind;
  scopes?: readonly string[];
  metadata?: Record<string, unknown>;
}): ConnectorCredentialReference {
  if (typeof input.ref !== "string" || input.ref.length === 0) {
    throw new IntegrationAuthenticationError("credential ref must be a non-empty string");
  }
  return Object.freeze({
    id: newCredentialRefId(),
    ref: input.ref,
    kind: input.kind,
    scopes: input.scopes ? Object.freeze([...input.scopes]) : undefined,
    metadata: input.metadata ? Object.freeze({ ...input.metadata }) : undefined,
  });
}

export function makeAuthentication(input: {
  kind: AuthenticationKind;
  credentialRef?: ConnectorCredentialReference;
  refreshable?: boolean;
  refreshHookName?: string;
  metadata?: Record<string, unknown>;
}): ConnectorAuthentication {
  if (input.kind !== "anonymous" && !input.credentialRef) {
    throw new IntegrationAuthenticationError(`authentication kind '${input.kind}' requires a credential reference`);
  }
  return Object.freeze({
    kind: input.kind,
    credentialRef: input.credentialRef,
    refreshable: input.refreshable ?? false,
    refreshHookName: input.refreshHookName,
    metadata: input.metadata ? Object.freeze({ ...input.metadata }) : undefined,
  });
}

export class AuthenticationRegistry {
  private readonly hooks = new Map<AuthenticationKind, AuthenticationHook>();
  private readonly refreshers = new Map<string, CredentialRefreshHook>();

  registerHook(hook: AuthenticationHook): void {
    this.hooks.set(hook.kind, hook);
  }
  registerRefresher(name: string, hook: CredentialRefreshHook): void {
    this.refreshers.set(name, hook);
  }
  hook(kind: AuthenticationKind): AuthenticationHook | undefined { return this.hooks.get(kind); }
  refresher(name: string): CredentialRefreshHook | undefined { return this.refreshers.get(name); }

  async apply(auth: ConnectorAuthentication, ctx: Omit<AuthenticationHookContext, "kind" | "credentialRef">): Promise<AuthenticationDescriptor> {
    if (auth.kind === "anonymous") return anonymousDescriptor();
    const hook = this.hooks.get(auth.kind);
    if (!hook) {
      // Deterministic default: expose the referenced credential id in headers as
      // a symbolic marker so downstream policy/telemetry can attribute the call
      // without ever handling a real secret value.
      const ref = auth.credentialRef?.ref ?? "";
      return Object.freeze({
        kind: auth.kind,
        headers: Object.freeze({ "x-connector-auth-kind": auth.kind, "x-connector-cred-ref": ref }),
        query: Object.freeze({}),
        metadata: Object.freeze({ synthetic: true }),
      });
    }
    return hook.apply({ ...ctx, kind: auth.kind, credentialRef: auth.credentialRef });
  }
}
