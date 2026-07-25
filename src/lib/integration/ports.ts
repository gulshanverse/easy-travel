/** IPCF — outward-facing ports.
 *
 * IPCF communicates ONLY with:
 *   • Runtime Kernel  (via IntegrationKernelPort)
 *   • Agent Runtime   (via IntegrationAgentPort)
 *   • CTOR            (via IntegrationCtorPort)
 *   • Provider Runtime (via IntegrationProviderPort)
 *
 * All other engines are OFF-LIMITS. See ADR-008/009/010.
 *
 * Interfaces only. No implementations; no external SDK types.
 */

export interface IntegrationKernelPort {
  now(): number;
  correlate(): string;
  healthy(): Promise<boolean>;
}

export interface IntegrationAgentPort {
  healthy(): Promise<boolean>;
  notifyConnectorEvent(event: {
    readonly kind: string;
    readonly connectorId: string;
    readonly correlationId: string;
    readonly at: number;
    readonly payload?: Readonly<Record<string, unknown>>;
  }): Promise<void>;
}

export interface IntegrationCtorPort {
  healthy(): Promise<boolean>;
  /** Advertise a connector capability to CTOR for discovery. */
  advertiseCapability(input: {
    readonly connectorId: string;
    readonly capabilityId: string;
    readonly version: string;
    readonly metadata?: Readonly<Record<string, unknown>>;
  }): Promise<void>;
  /** Withdraw a previously advertised capability. */
  withdrawCapability(input: {
    readonly connectorId: string;
    readonly capabilityId: string;
  }): Promise<void>;
}

export interface IntegrationProviderPort {
  healthy(): Promise<boolean>;
}

/** Secret provider — pluggable secret resolver.
 *  IPCF NEVER stores secrets. Consumers implement this port.
 */
export interface IntegrationSecretProvider {
  resolve(ref: string): Promise<string | undefined>;
}

export const noopKernelPort: IntegrationKernelPort = {
  now: () => Date.now(),
  correlate: () => `kcor_${Date.now().toString(36)}`,
  async healthy() { return true; },
};
export const noopAgentPort: IntegrationAgentPort = {
  async healthy() { return true; },
  async notifyConnectorEvent() { /* no-op */ },
};
export const noopCtorPort: IntegrationCtorPort = {
  async healthy() { return true; },
  async advertiseCapability() { /* no-op */ },
  async withdrawCapability() { /* no-op */ },
};
export const noopProviderPort: IntegrationProviderPort = {
  async healthy() { return true; },
};
export const noopSecretProvider: IntegrationSecretProvider = {
  async resolve() { return undefined; },
};
