/**
 * Provider Runtime — Security layer.
 *
 * Secrets are NEVER embedded in provider configs or codebase. Adapters
 * receive a `ProviderCredentialsRef` (a name) which the SecretProvider
 * resolves at execution time. Rotation hooks let a rotation service
 * invalidate cached credentials without restarting the runtime.
 */
import { ProviderCredentialError } from "./errors";
import type { ProviderCredentialsRef } from "./types";

export interface ResolvedCredential {
  ref: string;
  scheme: "api-key" | "oauth2" | "aws-sigv4" | "custom";
  /** Opaque token consumers pass to the adapter. Never logged. */
  token: string;
  expiresAt?: number;
  metadata?: Readonly<Record<string, unknown>>;
}

export interface SecretProvider {
  resolve(ref: ProviderCredentialsRef): Promise<ResolvedCredential>;
}

export interface CredentialValidator {
  validate(cred: ResolvedCredential): void;
}

export interface CredentialRotationHook {
  onRotate(ref: string): void | Promise<void>;
}

export class DefaultCredentialValidator implements CredentialValidator {
  validate(cred: ResolvedCredential): void {
    if (!cred.token || cred.token.length < 8) {
      throw new ProviderCredentialError(`Credential '${cred.ref}' invalid`);
    }
    if (cred.expiresAt && cred.expiresAt <= Date.now()) {
      throw new ProviderCredentialError(`Credential '${cred.ref}' expired`);
    }
  }
}

/**
 * In-memory secret provider for testing / self-hosted deployments.
 * Production deployments plug in KMS/Vault-backed implementations.
 */
export class InMemorySecretProvider implements SecretProvider {
  private secrets = new Map<string, ResolvedCredential>();

  register(cred: ResolvedCredential): void { this.secrets.set(cred.ref, cred); }
  revoke(ref: string): void { this.secrets.delete(ref); }

  async resolve(ref: ProviderCredentialsRef): Promise<ResolvedCredential> {
    const found = this.secrets.get(ref.ref);
    if (!found) throw new ProviderCredentialError(`Secret not found: ${ref.ref}`);
    return found;
  }
}

export class CredentialManager {
  private cache = new Map<string, ResolvedCredential>();
  private hooks: CredentialRotationHook[] = [];
  constructor(
    private readonly provider: SecretProvider,
    private readonly validator: CredentialValidator = new DefaultCredentialValidator(),
  ) {}

  registerRotationHook(hook: CredentialRotationHook): void { this.hooks.push(hook); }

  async get(ref: ProviderCredentialsRef): Promise<ResolvedCredential> {
    const cached = this.cache.get(ref.ref);
    if (cached && (!cached.expiresAt || cached.expiresAt > Date.now())) return cached;
    const fresh = await this.provider.resolve(ref);
    this.validator.validate(fresh);
    this.cache.set(ref.ref, fresh);
    return fresh;
  }

  async rotate(ref: string): Promise<void> {
    this.cache.delete(ref);
    for (const h of this.hooks) await h.onRotate(ref);
  }
}
