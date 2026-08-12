/** Provider Gateway (P-1.4) — capability registry and negotiation.
 *  Nothing is implicit: a provider must explicitly declare every capability.
 */
import {
  ProviderInvalidRequestError,
  ProviderSchemaMismatchError,
  ProviderUnsupportedCapabilityError,
} from "./errors";
import type {
  Provider,
  ProviderCapability,
  ProviderCapabilityId,
  ProviderEnvironment,
  ProviderId,
} from "./types";

export interface CapabilityRegistration {
  readonly capability: ProviderCapability;
  readonly providerId: ProviderId;
  readonly registeredAt: number;
}

export class ProviderCapabilityRegistry {
  private byCapability = new Map<ProviderCapabilityId, CapabilityRegistration[]>();

  register(providerId: ProviderId, capability: ProviderCapability, now = Date.now()): void {
    validateCapability(capability);
    const list = (this.byCapability.get(capability.id) ?? []).filter(
      (r) => r.providerId !== providerId,
    );
    list.push(Object.freeze({ capability, providerId, registeredAt: now }));
    this.byCapability.set(capability.id, list);
  }

  unregisterProvider(providerId: ProviderId): void {
    for (const [id, list] of this.byCapability) {
      const filtered = list.filter((r) => r.providerId !== providerId);
      if (filtered.length === 0) this.byCapability.delete(id);
      else this.byCapability.set(id, filtered);
    }
  }

  has(capability: ProviderCapabilityId): boolean {
    return (this.byCapability.get(capability)?.length ?? 0) > 0;
  }

  list(): readonly ProviderCapabilityId[] {
    return [...this.byCapability.keys()].sort();
  }

  providersFor(capability: ProviderCapabilityId): readonly ProviderId[] {
    return (this.byCapability.get(capability) ?? []).map((r) => r.providerId).sort();
  }

  registrations(capability: ProviderCapabilityId): readonly CapabilityRegistration[] {
    return [...(this.byCapability.get(capability) ?? [])].sort((a, b) =>
      a.providerId < b.providerId ? -1 : 1,
    );
  }

  descriptor(
    capability: ProviderCapabilityId,
    providerId: ProviderId,
  ): ProviderCapability | undefined {
    return (this.byCapability.get(capability) ?? []).find((r) => r.providerId === providerId)
      ?.capability;
  }

  /** Discovery surface consumed by CTOR / IPCF. */
  discover(): readonly {
    id: ProviderCapabilityId;
    version: string;
    providers: readonly ProviderId[];
  }[] {
    return this.list().map((id) => {
      const regs = this.registrations(id);
      return {
        id,
        version: regs[0]?.capability.version ?? "0.0.0",
        providers: regs.map((r) => r.providerId),
      };
    });
  }

  clear(): void {
    this.byCapability.clear();
  }
}

const SEMVER = /^\d+\.\d+\.\d+$/;

export function validateCapability(cap: ProviderCapability): void {
  if (!cap.id) throw new ProviderInvalidRequestError("capability id is required");
  if (!SEMVER.test(cap.version))
    throw new ProviderInvalidRequestError(`capability ${cap.id} version must be semver`);
  if (cap.operations.length === 0)
    throw new ProviderInvalidRequestError(`capability ${cap.id} declares no operations`);
  if (cap.environments.length === 0)
    throw new ProviderInvalidRequestError(`capability ${cap.id} declares no environments`);
}

/** Capability negotiation: the gateway rejects anything not declared. */
export function negotiate(
  provider: Provider,
  capabilityId: ProviderCapabilityId,
  operation: string,
  environment: ProviderEnvironment,
): ProviderCapability {
  const cap = provider.capabilities.find((c) => c.id === capabilityId);
  if (!cap)
    throw new ProviderUnsupportedCapabilityError(
      `provider ${provider.id} does not declare capability ${capabilityId}`,
      { providerId: provider.id, capability: capabilityId },
    );
  if (!cap.operations.includes(operation))
    throw new ProviderUnsupportedCapabilityError(
      `capability ${capabilityId} does not support operation ${operation}`,
      { providerId: provider.id, capability: capabilityId },
    );
  if (!cap.environments.includes(environment))
    throw new ProviderUnsupportedCapabilityError(
      `capability ${capabilityId} is not available in environment ${environment}`,
      { providerId: provider.id, capability: capabilityId },
    );
  return cap;
}

/** Input schema validation against the declared field list. */
export function validateInput(
  cap: ProviderCapability,
  payload: Readonly<Record<string, unknown>>,
): void {
  for (const field of cap.inputFields) {
    if (field.endsWith("?")) continue;
    if (!(field in payload))
      throw new ProviderInvalidRequestError(
        `missing required input '${field}' for capability ${cap.id}`,
        { capability: cap.id },
      );
  }
}

/** Output schema validation — mismatches are schema errors, not crashes. */
export function validateOutput(cap: ProviderCapability, data: unknown): void {
  if (cap.outputFields.length === 0) return;
  if (data === null || typeof data !== "object")
    throw new ProviderSchemaMismatchError(`capability ${cap.id} returned a non-object response`, {
      capability: cap.id,
    });
  const obj = data as Record<string, unknown>;
  for (const field of cap.outputFields) {
    if (field.endsWith("?")) continue;
    if (!(field in obj))
      throw new ProviderSchemaMismatchError(
        `provider response missing output '${field}' for capability ${cap.id}`,
        { capability: cap.id },
      );
  }
}
