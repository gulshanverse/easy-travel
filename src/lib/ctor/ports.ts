/** CTOR — external subsystem ports (interface-only). */

export interface CTORCapabilityContract {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly owner: { readonly engine: string };
  readonly dependencies?: readonly { capabilityId: string; versionRange?: string }[];
  readonly ports?: readonly string[];
  readonly features?: readonly string[];
}

export interface CTORMemoryPort { healthy(): Promise<boolean>; }
export interface CTORPromptPort { healthy(): Promise<boolean>; registeredPromptCount(): number; }
export interface CTORKernelPort {
  currentUserId(): string | undefined;
  currentSessionId(): string | undefined;
  currentTimezone(): string | undefined;
}
export interface CTORProviderPort { healthy(): Promise<boolean>; registeredProviderCount(): number; }
export interface CTORGraphPort { healthy(): Promise<boolean>; }
export interface CTORJourneyPort { healthy(): Promise<boolean>; }
export interface CTORDecisionPort { healthy(): Promise<boolean>; }
export interface CTORTrustPort { healthy(): Promise<boolean>; }
export interface CTORGoalPort { healthy(): Promise<boolean>; }
export interface CTORSpatialPort { healthy(): Promise<boolean>; }

export interface CTORContractSource {
  /** Discover engine contracts from an external source. */
  discover(): Promise<readonly CTORCapabilityContract[]>;
}

export const noopMemoryPort: CTORMemoryPort = { async healthy() { return true; } };
export const noopPromptPort: CTORPromptPort = { async healthy() { return true; }, registeredPromptCount() { return 0; } };
export const noopKernelPort: CTORKernelPort = {
  currentUserId() { return undefined; }, currentSessionId() { return undefined; }, currentTimezone() { return undefined; },
};
export const noopProviderPort: CTORProviderPort = { async healthy() { return true; }, registeredProviderCount() { return 0; } };
export const noopGraphPort: CTORGraphPort = { async healthy() { return true; } };
export const noopJourneyPort: CTORJourneyPort = { async healthy() { return true; } };
export const noopDecisionPort: CTORDecisionPort = { async healthy() { return true; } };
export const noopTrustPort: CTORTrustPort = { async healthy() { return true; } };
export const noopGoalPort: CTORGoalPort = { async healthy() { return true; } };
export const noopSpatialPort: CTORSpatialPort = { async healthy() { return true; } };
