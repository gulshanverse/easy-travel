/** Provider Gateway (P-1.4) — credential abstraction (ADR-035).
 *
 * Secrets are NEVER stored in source, git, logs, telemetry, events, audit
 * records, notifications or error messages. Providers hold only an opaque
 * ProviderCredentialReference; material is resolved at execution time from an
 * injected secret backend (env / secret manager / vault / cloud KMS).
 */
import { ProviderCredentialFailureError } from "./errors";
import type {
  CredentialStatus,
  ProviderAuthKind,
  ProviderCredentialReference,
  SecretMetadata,
} from "./types";

/** Resolved credential — held only for the lifetime of a single execution. */
export interface ResolvedCredential {
  readonly ref: string;
  readonly kind: ProviderAuthKind;
  /** Opaque material. Never logged, serialized, cached or emitted. */
  readonly material: string;
  readonly scope?: string;
  readonly expiresAt?: number;
}

/** Injected secret backend contract. Implementations live outside the gateway. */
export interface SecretBackend {
  readonly name: "environment" | "secret-manager" | "vault" | "cloud" | "memory";
  resolve(ref: ProviderCredentialReference): Promise<ResolvedCredential | null>;
}

export interface CredentialRotationHook {
  onRotate(ref: string, metadata: SecretMetadata): void | Promise<void>;
}

/** Test/self-hosted backend. Values are injected by the host, never committed. */
export class InMemorySecretBackend implements SecretBackend {
  readonly name = "memory" as const;
  private secrets = new Map<string, ResolvedCredential>();

  put(cred: ResolvedCredential): void {
    this.secrets.set(cred.ref, Object.freeze({ ...cred }));
  }
  revoke(ref: string): void {
    this.secrets.delete(ref);
  }
  async resolve(ref: ProviderCredentialReference): Promise<ResolvedCredential | null> {
    return this.secrets.get(ref.ref) ?? null;
  }
}

/** Reads material from process env by reference name. No value is hardcoded. */
export class EnvironmentSecretBackend implements SecretBackend {
  readonly name = "environment" as const;
  constructor(private readonly read: (key: string) => string | undefined) {}
  async resolve(ref: ProviderCredentialReference): Promise<ResolvedCredential | null> {
    const material = this.read(ref.ref);
    if (!material) return null;
    return Object.freeze({ ref: ref.ref, kind: ref.kind, material });
  }
}

export function credentialStatus(cred: ResolvedCredential | null, now = Date.now()): CredentialStatus {
  if (!cred) return "missing";
  if (cred.expiresAt !== undefined && cred.expiresAt <= now) return "expired";
  if (cred.expiresAt !== undefined && cred.expiresAt - now < 60_000) return "expiring";
  return "active";
}

/** Redaction-safe metadata describing a credential. Contains no material. */
export function secretMetadata(
  ref: ProviderCredentialReference,
  cred: ResolvedCredential | null,
  now = Date.now(),
): SecretMetadata {
  const meta: {
    ref: string;
    kind: ProviderAuthKind;
    status: CredentialStatus;
    scope?: string;
    expiresAt?: number;
  } = { ref: ref.ref, kind: ref.kind, status: credentialStatus(cred, now) };
  if (cred?.scope) meta.scope = cred.scope;
  if (cred?.expiresAt !== undefined) meta.expiresAt = cred.expiresAt;
  return Object.freeze(meta);
}

export class CredentialResolver {
  private cache = new Map<string, ResolvedCredential>();
  private hooks: CredentialRotationHook[] = [];
  private failures = 0;

  constructor(private readonly backend: SecretBackend) {}

  registerRotationHook(hook: CredentialRotationHook): void {
    this.hooks.push(hook);
  }

  credentialFailures(): number {
    return this.failures;
  }

  async resolve(ref: ProviderCredentialReference, now = Date.now()): Promise<ResolvedCredential> {
    const cached = this.cache.get(ref.ref);
    if (cached && credentialStatus(cached, now) === "active") return cached;
    const fresh = await this.backend.resolve(ref);
    const status = credentialStatus(fresh, now);
    if (!fresh || status === "expired" || status === "missing") {
      this.failures++;
      throw new ProviderCredentialFailureError(`credential unavailable for ref '${ref.ref}'`);
    }
    if (!fresh.material || fresh.material.length < 8) {
      this.failures++;
      throw new ProviderCredentialFailureError(`credential invalid for ref '${ref.ref}'`);
    }
    this.cache.set(ref.ref, fresh);
    return fresh;
  }

  /** Invalidate cached material and notify rotation listeners with metadata only. */
  async rotate(ref: ProviderCredentialReference): Promise<SecretMetadata> {
    this.cache.delete(ref.ref);
    const fresh = await this.backend.resolve(ref);
    const meta = secretMetadata(ref, fresh);
    for (const h of this.hooks) await h.onRotate(ref.ref, meta);
    return meta;
  }

  clear(): void {
    this.cache.clear();
  }
}

/* ------------------------------------------------------------------ */
/* Authentication abstraction                                          */
/* ------------------------------------------------------------------ */

/** Authentication material applied at execution time; never persisted. */
export interface AppliedAuthentication {
  readonly kind: ProviderAuthKind;
  readonly headerNames: readonly string[];
  /** Non-enumerable-by-convention: consumers pass straight to transport. */
  readonly headers: Readonly<Record<string, string>>;
}

export function applyAuthentication(
  kind: ProviderAuthKind,
  cred: ResolvedCredential | null,
): AppliedAuthentication {
  if (kind === "none" || !cred)
    return Object.freeze({ kind, headerNames: [], headers: Object.freeze({}) });
  const headers: Record<string, string> = {};
  switch (kind) {
    case "api-key":
      headers["x-api-key"] = cred.material;
      break;
    case "bearer":
    case "oauth2":
    case "oidc":
      headers["authorization"] = `Bearer ${cred.material}`;
      break;
    case "basic":
      headers["authorization"] = `Basic ${cred.material}`;
      break;
    case "hmac":
      headers["x-signature"] = cred.material;
      break;
    case "mtls":
      // Client certificates are bound at transport level by the host.
      break;
  }
  return Object.freeze({
    kind,
    headerNames: Object.keys(headers),
    headers: Object.freeze(headers),
  });
}
