/** RICS — provider adapter surface.
 *  Adapters translate a provider-shaped payload; they never perform
 *  transport themselves in this build and are only ever invoked from
 *  the IPCF connector executor.
 */
import type { RailwayCapabilityId } from "../contracts";

export type RailwayRequestInput = Readonly<Record<string, unknown>>;

export interface RailwayProviderRawResult {
  readonly ok: boolean;
  /** Provider-shaped payload; normalization happens in RICS. */
  readonly data?: unknown;
  readonly error?: { readonly code: string; readonly message: string; readonly retryable?: boolean };
  readonly pagination?: { readonly total?: number; readonly hasMore?: boolean };
}

export interface RailwayProviderProfile {
  readonly id: string;
  readonly name: string;
  readonly kind: "mock" | "national" | "regional" | "international";
  readonly country: string;
  readonly version: string;
  /** Only functional providers may execute; stubs advertise contracts only. */
  readonly functional: boolean;
  readonly capabilities: readonly RailwayCapabilityId[];
}

export interface RailwayProviderAdapter {
  readonly profile: RailwayProviderProfile;
  supports(capability: RailwayCapabilityId): boolean;
  execute(capability: RailwayCapabilityId, input: RailwayRequestInput): Promise<RailwayProviderRawResult>;
  probe(): Promise<{ readonly healthy: boolean; readonly reason?: string }>;
}
