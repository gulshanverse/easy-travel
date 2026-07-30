/** MTIP — provider adapter surface (interfaces only).
 *  Adapters translate provider-shaped payloads; they never perform transport
 *  and are only ever invoked from the IPCF connector executor.
 */
import type { MultiModalCapabilityId, TravelMode } from "../contracts";

export type TravelRequestInput = Readonly<Record<string, unknown>>;

export interface TravelProviderRawResult {
  readonly ok: boolean;
  /** Provider-shaped payload; normalization happens inside MTIP. */
  readonly data?: unknown;
  readonly error?: {
    readonly code: string;
    readonly message: string;
    readonly retryable?: boolean;
  };
  readonly pagination?: { readonly total?: number; readonly hasMore?: boolean };
}

export interface TravelProviderProfile {
  readonly id: string;
  readonly name: string;
  readonly mode: TravelMode;
  readonly kind: "mock" | "commercial" | "public" | "regional";
  readonly version: string;
  /** Only functional providers may execute; stubs advertise contracts only. */
  readonly functional: boolean;
  readonly capabilities: readonly MultiModalCapabilityId[];
}

export interface TravelProviderAdapter {
  readonly profile: TravelProviderProfile;
  supports(capability: MultiModalCapabilityId): boolean;
  execute(
    capability: MultiModalCapabilityId,
    input: TravelRequestInput,
  ): Promise<TravelProviderRawResult>;
  probe(): Promise<{ readonly healthy: boolean; readonly reason?: string }>;
}

/** Per-mode provider interfaces (interfaces only — no implementations here). */
export interface FlightProvider extends TravelProviderAdapter {
  readonly profile: TravelProviderProfile & { mode: "flight" };
}
export interface HotelProvider extends TravelProviderAdapter {
  readonly profile: TravelProviderProfile & { mode: "hotel" };
}
export interface MapsProvider extends TravelProviderAdapter {
  readonly profile: TravelProviderProfile & { mode: "maps" };
}
export interface WeatherProvider extends TravelProviderAdapter {
  readonly profile: TravelProviderProfile & { mode: "weather" };
}
export interface TransitProvider extends TravelProviderAdapter {
  readonly profile: TravelProviderProfile & { mode: "transit" };
}
export interface CurrencyProvider extends TravelProviderAdapter {
  readonly profile: TravelProviderProfile & { mode: "currency" };
}
export interface TimezoneProvider extends TravelProviderAdapter {
  readonly profile: TravelProviderProfile & { mode: "timezone" };
}
