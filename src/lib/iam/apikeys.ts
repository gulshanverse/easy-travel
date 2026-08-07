/**
 * IAM Platform — API Keys & Service Accounts.
 * Keys are shown once at creation; only a SHA-256 hash is persisted.
 */
import { ApiKeyDisabledError, ApiKeyError, ApiKeyExpiredError, ServiceAccountError } from "./errors";
import { randomToken, sha256 } from "./crypto";
import { newApiKeyId, newServiceAccountId } from "./ids";
import type { CollectionStore } from "./stores";
import type { ApiKey, ApiKeyStatus, ServiceAccount } from "./types";

export interface CreateApiKeyInput {
  readonly ownerId: string;
  readonly ownerKind: "user" | "service_account";
  readonly name: string;
  readonly scopes?: readonly string[];
  readonly ttlMs?: number | null;
}

export interface CreatedApiKey {
  /** Full secret, returned exactly once. */
  readonly secret: string;
  readonly key: ApiKey;
}

export interface ApiKeyPolicy {
  readonly maxKeysPerOwner: number;
  readonly defaultTtlMs: number | null;
  readonly allowedScopes: readonly string[] | null;
}

export const DEFAULT_API_KEY_POLICY: ApiKeyPolicy = Object.freeze({
  maxKeysPerOwner: 10,
  defaultTtlMs: 365 * 86_400_000,
  allowedScopes: null,
});

export class ApiKeyManager {
  constructor(
    private readonly keys: CollectionStore<ApiKey>,
    private readonly accounts: CollectionStore<ServiceAccount>,
    private readonly policy: ApiKeyPolicy = DEFAULT_API_KEY_POLICY,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /* ------------------------------------------------------------- keys */

  async create(input: CreateApiKeyInput): Promise<CreatedApiKey> {
    const active = await this.keys.where(
      (k) => k.ownerId === input.ownerId && k.status === "active",
    );
    if (active.length >= this.policy.maxKeysPerOwner)
      throw new ApiKeyError(`owner has reached the API key limit (${this.policy.maxKeysPerOwner})`);
    const scopes = [...(input.scopes ?? [])];
    if (this.policy.allowedScopes) {
      const bad = scopes.filter((s) => !this.policy.allowedScopes!.includes(s));
      if (bad.length) throw new ApiKeyError(`unsupported scopes: ${bad.join(", ")}`);
    }
    const at = this.now();
    const id = newApiKeyId();
    const prefix = `et_${id.slice(-8)}`;
    const secret = `${prefix}.${randomToken(32)}`;
    const ttl = input.ttlMs === undefined ? this.policy.defaultTtlMs : input.ttlMs;
    const key: ApiKey = Object.freeze({
      id,
      ownerId: input.ownerId,
      ownerKind: input.ownerKind,
      name: input.name,
      prefix,
      hash: await sha256(secret),
      scopes: Object.freeze(scopes),
      status: "active" as ApiKeyStatus,
      expiresAt: ttl === null ? null : at + ttl,
      lastUsedAt: null,
      rotatedFrom: null,
      createdAt: at,
    });
    await this.keys.put(key);
    return Object.freeze({ secret, key });
  }

  /** Verifies a presented secret and stamps last-used. */
  async verify(secret: string): Promise<ApiKey> {
    const hash = await sha256(secret);
    const key = await this.keys.first((k) => k.hash === hash);
    if (!key) throw new ApiKeyError("unknown API key");
    if (key.status === "disabled" || key.status === "rotated")
      throw new ApiKeyDisabledError(`API key is ${key.status}`);
    const at = this.now();
    if (key.expiresAt !== null && at > key.expiresAt) {
      await this.keys.put(Object.freeze({ ...key, status: "expired" }));
      throw new ApiKeyExpiredError("API key has expired");
    }
    const used: ApiKey = Object.freeze({ ...key, lastUsedAt: at });
    await this.keys.put(used);
    return used;
  }

  async rotate(keyId: string): Promise<CreatedApiKey> {
    const previous = await this.require(keyId);
    await this.keys.put(Object.freeze({ ...previous, status: "rotated" }));
    const created = await this.create({
      ownerId: previous.ownerId,
      ownerKind: previous.ownerKind,
      name: previous.name,
      scopes: previous.scopes,
      ttlMs: previous.expiresAt === null ? null : previous.expiresAt - previous.createdAt,
    });
    const linked: ApiKey = Object.freeze({ ...created.key, rotatedFrom: previous.id });
    await this.keys.put(linked);
    return Object.freeze({ secret: created.secret, key: linked });
  }

  async disable(keyId: string): Promise<ApiKey> {
    const key = await this.require(keyId);
    const next: ApiKey = Object.freeze({ ...key, status: "disabled" });
    await this.keys.put(next);
    return next;
  }

  async expireDue(at: number = this.now()): Promise<number> {
    const due = await this.keys.where(
      (k) => k.status === "active" && k.expiresAt !== null && k.expiresAt <= at,
    );
    for (const k of due) await this.keys.put(Object.freeze({ ...k, status: "expired" }));
    return due.length;
  }

  listFor(ownerId: string): Promise<readonly ApiKey[]> {
    return this.keys.where((k) => k.ownerId === ownerId);
  }

  count(): Promise<number> {
    return this.keys.count();
  }

  private async require(keyId: string): Promise<ApiKey> {
    const key = await this.keys.get(keyId);
    if (!key) throw new ApiKeyError(`unknown API key '${keyId}'`);
    return key;
  }

  /* -------------------------------------------------- service accounts */

  async createServiceAccount(input: {
    code: string;
    description?: string;
    roles?: readonly string[];
    scopes?: readonly string[];
  }): Promise<ServiceAccount> {
    if (await this.accounts.first((a) => a.code === input.code))
      throw new ServiceAccountError(`service account '${input.code}' already exists`);
    const account: ServiceAccount = Object.freeze({
      id: newServiceAccountId(),
      code: input.code,
      description: input.description ?? "",
      enabled: true,
      roles: Object.freeze([...(input.roles ?? ["service"])]),
      scopes: Object.freeze([...(input.scopes ?? [])]),
      createdAt: this.now(),
    });
    await this.accounts.put(account);
    return account;
  }

  async setServiceAccountEnabled(id: string, enabled: boolean): Promise<ServiceAccount> {
    const account = await this.accounts.get(id);
    if (!account) throw new ServiceAccountError(`unknown service account '${id}'`);
    const next: ServiceAccount = Object.freeze({ ...account, enabled });
    await this.accounts.put(next);
    return next;
  }

  async issueServiceAccountCredential(id: string, name = "default"): Promise<CreatedApiKey> {
    const account = await this.accounts.get(id);
    if (!account) throw new ServiceAccountError(`unknown service account '${id}'`);
    if (!account.enabled) throw new ServiceAccountError("service account is disabled");
    return this.create({
      ownerId: account.id,
      ownerKind: "service_account",
      name,
      scopes: account.scopes,
    });
  }

  listServiceAccounts(): Promise<readonly ServiceAccount[]> {
    return this.accounts.all() as Promise<readonly ServiceAccount[]>;
  }

  serviceAccountCount(): Promise<number> {
    return this.accounts.count();
  }
}
