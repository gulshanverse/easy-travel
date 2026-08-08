/**
 * IAM Platform — generic Credential Platform.
 *
 * A credential is any verifiable proof of a principal. Password, API key and
 * service-account credentials are concrete; OAuth and passkey credentials are
 * CONTRACTS ONLY (no external provider is implemented in P-1.2).
 *
 * Invariant: secret material never leaves this module. Only opaque
 * verification material (a hash produced by a `CredentialVerifier`) is
 * persisted, and it is never returned by any public accessor.
 */
import { IamError } from "./errors";
import { newCredentialHistoryId } from "./ids";
import type { CollectionStore } from "./stores";

export type CredentialType =
  | "password"
  | "api_key"
  | "service_account"
  | "oauth"
  | "passkey"
  | "future";

export type CredentialState = "active" | "disabled" | "revoked" | "expired" | "rotated";

export class CredentialError extends IamError {}

/** Non-secret descriptive metadata; safe for logs, cards and audit records. */
export interface CredentialMetadata {
  readonly label: string;
  readonly algorithm: string | null;
  readonly createdAt: number;
  readonly rotatedAt: number | null;
  readonly expiresAt: number | null;
  readonly lastVerifiedAt: number | null;
  readonly attributes: Readonly<Record<string, unknown>>;
}

export interface CredentialDescriptor {
  readonly id: string;
  readonly subjectId: string;
  readonly subjectKind: "user" | "service_account";
  readonly type: CredentialType;
  readonly state: CredentialState;
  readonly metadata: CredentialMetadata;
}

export interface CredentialHistoryEntry {
  readonly id: string;
  readonly credentialId: string;
  readonly subjectId: string;
  readonly type: CredentialType;
  readonly action: "created" | "verified" | "rotated" | "revoked" | "disabled" | "expired" | "restored";
  readonly reason: string | null;
  readonly at: number;
}

/**
 * Provider-independent verification contract. Implementations turn raw secret
 * material into opaque verification material and compare in constant time.
 */
export interface CredentialVerifier {
  readonly type: CredentialType;
  /** Produces opaque verification material. MUST NOT be reversible. */
  materialize(secret: string): Promise<string>;
  verify(secret: string, material: string): Promise<boolean>;
}

/** Contract-only marker for federated credentials (ADR-027). */
export interface OAuthCredentialContract {
  readonly type: "oauth";
  readonly provider: string;
  readonly subject: string;
  /** Opaque reference resolved by an external secret provider — never a token. */
  readonly credentialRef: string;
}

/** Contract-only marker for WebAuthn/passkey credentials. */
export interface PasskeyCredentialContract {
  readonly type: "passkey";
  readonly credentialId: string;
  readonly publicKeyRef: string;
  readonly signCount: number;
}

export interface CredentialPolicy {
  readonly maxPerSubject: number;
  readonly defaultTtlMs: number | null;
  readonly allowRestore: boolean;
  readonly rotationGraceMs: number;
}

export const DEFAULT_CREDENTIAL_POLICY: CredentialPolicy = Object.freeze({
  maxPerSubject: 20,
  defaultTtlMs: null,
  allowRestore: true,
  rotationGraceMs: 0,
});

/** Registry of verifiers — the only way a credential type becomes usable. */
export class CredentialRegistry {
  private readonly verifiers = new Map<CredentialType, CredentialVerifier>();

  register(verifier: CredentialVerifier): void {
    this.verifiers.set(verifier.type, verifier);
  }
  get(type: CredentialType): CredentialVerifier | undefined {
    return this.verifiers.get(type);
  }
  require(type: CredentialType): CredentialVerifier {
    const v = this.verifiers.get(type);
    if (!v) throw new CredentialError(`no verifier registered for credential type '${type}'`);
    return v;
  }
  types(): readonly CredentialType[] {
    return Object.freeze([...this.verifiers.keys()].sort());
  }
}

interface StoredCredential extends CredentialDescriptor {
  /** Opaque verification material. Never exposed through a public API. */
  readonly material: string;
}

/** Strips verification material from anything leaving the manager. */
function describe(row: StoredCredential): CredentialDescriptor {
  return Object.freeze({
    id: row.id,
    subjectId: row.subjectId,
    subjectKind: row.subjectKind,
    type: row.type,
    state: row.state,
    metadata: Object.freeze({ ...row.metadata }),
  });
}

export class CredentialManager {
  constructor(
    private readonly store: CollectionStore<StoredCredential>,
    private readonly history: CollectionStore<CredentialHistoryEntry>,
    private readonly registry: CredentialRegistry,
    private readonly policy: CredentialPolicy = DEFAULT_CREDENTIAL_POLICY,
    private readonly now: () => number = () => Date.now(),
  ) {}

  get verifiers(): CredentialRegistry {
    return this.registry;
  }

  async create(input: {
    id: string;
    subjectId: string;
    subjectKind?: "user" | "service_account";
    type: CredentialType;
    secret: string;
    label?: string;
    ttlMs?: number | null;
    attributes?: Readonly<Record<string, unknown>>;
  }): Promise<CredentialDescriptor> {
    const existing = await this.store.where(
      (c) => c.subjectId === input.subjectId && c.state === "active",
    );
    if (existing.length >= this.policy.maxPerSubject)
      throw new CredentialError(`credential limit reached for subject '${input.subjectId}'`);
    const verifier = this.registry.require(input.type);
    const at = this.now();
    const ttl = input.ttlMs === undefined ? this.policy.defaultTtlMs : input.ttlMs;
    const row: StoredCredential = Object.freeze({
      id: input.id,
      subjectId: input.subjectId,
      subjectKind: input.subjectKind ?? "user",
      type: input.type,
      state: "active" as CredentialState,
      material: await verifier.materialize(input.secret),
      metadata: Object.freeze({
        label: input.label ?? input.type,
        algorithm: null,
        createdAt: at,
        rotatedAt: null,
        expiresAt: ttl === null ? null : at + ttl,
        lastVerifiedAt: null,
        attributes: Object.freeze({ ...(input.attributes ?? {}) }),
      }),
    });
    await this.store.put(row);
    await this.log(row, "created", null, at);
    return describe(row);
  }

  async verify(id: string, secret: string): Promise<boolean> {
    const row = await this.require(id);
    const at = this.now();
    if (row.state !== "active") return false;
    if (row.metadata.expiresAt !== null && at > row.metadata.expiresAt) {
      await this.mutate(row, "expired", "expired", "ttl_elapsed", at);
      return false;
    }
    const ok = await this.registry.require(row.type).verify(secret, row.material);
    if (ok) {
      const next: StoredCredential = Object.freeze({
        ...row,
        metadata: Object.freeze({ ...row.metadata, lastVerifiedAt: at }),
      });
      await this.store.put(next);
      await this.log(next, "verified", null, at);
    }
    return ok;
  }

  async rotate(id: string, secret: string): Promise<CredentialDescriptor> {
    const row = await this.require(id);
    if (row.state !== "active") throw new CredentialError(`cannot rotate a ${row.state} credential`);
    const at = this.now();
    const next: StoredCredential = Object.freeze({
      ...row,
      material: await this.registry.require(row.type).materialize(secret),
      metadata: Object.freeze({ ...row.metadata, rotatedAt: at }),
    });
    await this.store.put(next);
    await this.log(next, "rotated", null, at);
    return describe(next);
  }

  revoke(id: string, reason = "revoked"): Promise<CredentialDescriptor> {
    return this.transition(id, "revoked", "revoked", reason);
  }
  disable(id: string, reason = "disabled"): Promise<CredentialDescriptor> {
    return this.transition(id, "disabled", "disabled", reason);
  }
  expire(id: string, reason = "expired"): Promise<CredentialDescriptor> {
    return this.transition(id, "expired", "expired", reason);
  }

  async restore(id: string): Promise<CredentialDescriptor> {
    if (!this.policy.allowRestore) throw new CredentialError("credential restore is disabled by policy");
    const row = await this.require(id);
    if (row.state === "revoked") throw new CredentialError("revoked credentials cannot be restored");
    return this.transition(id, "active", "restored", null);
  }

  async describeFor(subjectId: string): Promise<readonly CredentialDescriptor[]> {
    return (await this.store.where((c) => c.subjectId === subjectId)).map(describe);
  }

  async get(id: string): Promise<CredentialDescriptor | undefined> {
    const row = await this.store.get(id);
    return row ? describe(row) : undefined;
  }

  async historyFor(credentialId: string): Promise<readonly CredentialHistoryEntry[]> {
    return [...(await this.history.where((h) => h.credentialId === credentialId))].sort(
      (a, b) => a.at - b.at,
    );
  }

  async count(): Promise<number> {
    return this.store.count();
  }

  private async transition(
    id: string,
    state: CredentialState,
    action: CredentialHistoryEntry["action"],
    reason: string | null,
  ): Promise<CredentialDescriptor> {
    const row = await this.require(id);
    return this.mutate(row, state, action, reason, this.now());
  }

  private async mutate(
    row: StoredCredential,
    state: CredentialState,
    action: CredentialHistoryEntry["action"],
    reason: string | null,
    at: number,
  ): Promise<CredentialDescriptor> {
    const next: StoredCredential = Object.freeze({ ...row, state });
    await this.store.put(next);
    await this.log(next, action, reason, at);
    return describe(next);
  }

  private async require(id: string): Promise<StoredCredential> {
    const row = await this.store.get(id);
    if (!row) throw new CredentialError(`unknown credential '${id}'`);
    return row;
  }

  private async log(
    row: StoredCredential,
    action: CredentialHistoryEntry["action"],
    reason: string | null,
    at: number,
  ): Promise<void> {
    await this.history.put(
      Object.freeze({
        id: newCredentialHistoryId(),
        credentialId: row.id,
        subjectId: row.subjectId,
        type: row.type,
        action,
        reason,
        at,
      }),
    );
  }
}
