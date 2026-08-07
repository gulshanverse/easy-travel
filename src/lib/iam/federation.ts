/**
 * IAM Platform — Identity Federation contracts only (ADR-027).
 * No provider implementation, no HTTP, no SDK. Adapters implement these.
 */
import { FederationError } from "./errors";
import { newFederatedIdentityId } from "./ids";
import type { CollectionStore } from "./stores";
import type { FederatedIdentity, FederationProtocol, FederationProviderId } from "./types";

export interface FederationProviderDescriptor {
  readonly id: FederationProviderId;
  readonly protocol: FederationProtocol;
  readonly displayName: string;
  readonly scopes: readonly string[];
  readonly supportsRefresh: boolean;
}

export interface FederatedPrincipal {
  readonly subject: string;
  readonly email: string | null;
  readonly displayName: string | null;
  readonly emailVerified: boolean;
  readonly claims: Readonly<Record<string, unknown>>;
}

/** Contract every federation adapter must satisfy. IAM ships none. */
export interface FederationProviderAdapter {
  readonly descriptor: FederationProviderDescriptor;
  /** Builds an authorization redirect target; adapter owns provider specifics. */
  authorizationRequest(input: {
    redirectUri: string;
    state: string;
    nonce?: string;
  }): Promise<{ readonly url: string; readonly state: string }>;
  /** Exchanges a provider response for a normalised principal. */
  exchange(input: { code: string; redirectUri: string; state: string }): Promise<FederatedPrincipal>;
}

export const KNOWN_FEDERATION_PROVIDERS: readonly FederationProviderDescriptor[] = Object.freeze([
  Object.freeze({ id: "google", protocol: "oidc", displayName: "Google", scopes: Object.freeze(["openid", "email", "profile"]), supportsRefresh: true }),
  Object.freeze({ id: "microsoft", protocol: "oidc", displayName: "Microsoft", scopes: Object.freeze(["openid", "email", "profile"]), supportsRefresh: true }),
  Object.freeze({ id: "apple", protocol: "oidc", displayName: "Apple", scopes: Object.freeze(["openid", "email", "name"]), supportsRefresh: false }),
  Object.freeze({ id: "github", protocol: "oauth2", displayName: "GitHub", scopes: Object.freeze(["read:user", "user:email"]), supportsRefresh: false }),
  Object.freeze({ id: "enterprise_sso", protocol: "saml", displayName: "Enterprise SSO", scopes: Object.freeze([]), supportsRefresh: false }),
]);

export class FederationRegistry {
  private readonly adapters = new Map<FederationProviderId, FederationProviderAdapter>();

  register(adapter: FederationProviderAdapter): void {
    this.adapters.set(adapter.descriptor.id, adapter);
  }
  get(id: FederationProviderId): FederationProviderAdapter | undefined {
    return this.adapters.get(id);
  }
  require(id: FederationProviderId): FederationProviderAdapter {
    const adapter = this.adapters.get(id);
    if (!adapter) throw new FederationError(`no federation adapter registered for '${id}'`);
    return adapter;
  }
  registered(): readonly FederationProviderId[] {
    return Object.freeze([...this.adapters.keys()]);
  }
  descriptors(): readonly FederationProviderDescriptor[] {
    return KNOWN_FEDERATION_PROVIDERS;
  }
}

export class FederationManager {
  readonly registry = new FederationRegistry();

  constructor(
    private readonly identities: CollectionStore<FederatedIdentity>,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async link(input: {
    userId: string;
    provider: FederationProviderId;
    protocol: FederationProtocol;
    subject: string;
    metadata?: Readonly<Record<string, unknown>>;
  }): Promise<FederatedIdentity> {
    const existing = await this.identities.first(
      (i) => i.provider === input.provider && i.subject === input.subject,
    );
    if (existing && existing.userId !== input.userId)
      throw new FederationError("federated subject is already linked to another user");
    const identity: FederatedIdentity = Object.freeze({
      id: existing?.id ?? newFederatedIdentityId(),
      userId: input.userId,
      provider: input.provider,
      protocol: input.protocol,
      subject: input.subject,
      linkedAt: existing?.linkedAt ?? this.now(),
      metadata: Object.freeze({ ...(input.metadata ?? {}) }),
    });
    await this.identities.put(identity);
    return identity;
  }

  async unlink(id: string): Promise<boolean> {
    return this.identities.remove(id);
  }

  listFor(userId: string): Promise<readonly FederatedIdentity[]> {
    return this.identities.where((i) => i.userId === userId);
  }

  findBySubject(
    provider: FederationProviderId,
    subject: string,
  ): Promise<FederatedIdentity | undefined> {
    return this.identities.first((i) => i.provider === provider && i.subject === subject);
  }
}
