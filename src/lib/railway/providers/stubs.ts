/** RICS — non-functional provider stubs.
 *  These adapters publish their contract surface so the platform can plan
 *  around them, but they execute nothing. Real transport, credentials,
 *  booking and authentication are explicitly out of scope (ADR-012).
 */
import type { RailwayCapabilityId } from "../contracts";
import { RailwayProviderUnavailableError } from "../errors";
import type {
  RailwayProviderAdapter, RailwayProviderProfile, RailwayProviderRawResult, RailwayRequestInput,
} from "./types";

export abstract class StubRailProvider implements RailwayProviderAdapter {
  abstract readonly profile: RailwayProviderProfile;

  supports(capability: RailwayCapabilityId): boolean {
    return (this.profile.capabilities as readonly string[]).includes(capability);
  }

  async probe(): Promise<{ healthy: boolean; reason?: string }> {
    return { healthy: false, reason: "stub adapter — not implemented in this build" };
  }

  async execute(capability: RailwayCapabilityId, _input: RailwayRequestInput): Promise<RailwayProviderRawResult> {
    const err = new RailwayProviderUnavailableError(this.profile.id);
    return Object.freeze({
      ok: false,
      error: Object.freeze({ code: err.code, message: `${err.message} (${capability})`, retryable: false }),
    });
  }
}

const profile = (
  id: string, name: string, kind: RailwayProviderProfile["kind"], country: string,
  capabilities: readonly RailwayCapabilityId[],
): RailwayProviderProfile => Object.freeze({
  id, name, kind, country, version: "0.1.0", functional: false,
  capabilities: Object.freeze([...capabilities]),
});

/** National reservation-system style adapter (contract stub only). */
export class NationalReservationProvider extends StubRailProvider {
  readonly profile = profile("national-reservation", "National Reservation System", "national", "IN", [
    "search_train", "train_schedule", "fare_information", "seat_availability",
    "coach_layout", "check_pnr", "journey_history",
  ]);
}

/** National train-enquiry style adapter (contract stub only). */
export class NationalEnquiryProvider extends StubRailProvider {
  readonly profile = profile("national-enquiry", "National Train Enquiry System", "national", "IN", [
    "live_status", "delay_information", "platform_information",
    "cancellation_information", "diversion_information", "train_schedule",
  ]);
}

/** Grievance / service-alerts style adapter (contract stub only). */
export class GrievanceAlertsProvider extends StubRailProvider {
  readonly profile = profile("grievance-alerts", "Rail Grievance & Alerts Service", "national", "IN", [
    "service_alerts",
  ]);
}

/** Template for future international railway operators. */
export class InternationalRailProvider extends StubRailProvider {
  readonly profile: RailwayProviderProfile;
  constructor(id: string, name: string, country: string, capabilities: readonly RailwayCapabilityId[]) {
    super();
    this.profile = profile(id, name, "international", country, capabilities);
  }
}

export const createNationalReservationProvider = () => new NationalReservationProvider();
export const createNationalEnquiryProvider = () => new NationalEnquiryProvider();
export const createGrievanceAlertsProvider = () => new GrievanceAlertsProvider();
