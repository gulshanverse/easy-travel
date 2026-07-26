/** RICS — provider-independent normalized railway models.
 *  Every model is immutable and free of provider vocabulary.
 */

export interface NormalizedCoordinates {
  readonly latitude: number;
  readonly longitude: number;
}

export interface NormalizedStation {
  readonly code: string;
  readonly name: string;
  readonly city: string;
  readonly region: string;
  readonly country: string;
  readonly zone: string;
  readonly coordinates: NormalizedCoordinates;
  readonly platforms: number;
  readonly categories: readonly string[];
}

export interface NormalizedStationMetadata {
  readonly station: NormalizedStation;
  readonly elevationMeters: number;
  readonly amenities: readonly string[];
  readonly accessibility: readonly string[];
  readonly dailyFootfall: number;
  readonly openedYear: number;
}

export interface NormalizedTrain {
  readonly number: string;
  readonly name: string;
  readonly category: string;
  readonly originCode: string;
  readonly destinationCode: string;
  readonly runsOn: readonly string[];
  readonly classes: readonly string[];
  readonly distanceKm: number;
  readonly durationMinutes: number;
  readonly averageSpeedKmph: number;
}

export interface NormalizedTrainMetadata {
  readonly train: NormalizedTrain;
  readonly coaches: number;
  readonly pantry: boolean;
  readonly rake: string;
  readonly introducedYear: number;
  readonly punctualityPercent: number;
}

export interface NormalizedScheduleStop {
  readonly sequence: number;
  readonly stationCode: string;
  readonly stationName: string;
  readonly arrival?: string;      // HH:MM, undefined at origin
  readonly departure?: string;    // HH:MM, undefined at terminus
  readonly haltMinutes: number;
  readonly dayOffset: number;
  readonly distanceKm: number;
  readonly platform?: string;
}

export interface NormalizedSchedule {
  readonly trainNumber: string;
  readonly stops: readonly NormalizedScheduleStop[];
}

export interface NormalizedRouteLeg {
  readonly fromCode: string;
  readonly toCode: string;
  readonly distanceKm: number;
  readonly durationMinutes: number;
}

export interface NormalizedRoute {
  readonly trainNumber: string;
  readonly legs: readonly NormalizedRouteLeg[];
  readonly totalDistanceKm: number;
  readonly totalDurationMinutes: number;
}

export interface NormalizedJourneySegment {
  readonly trainNumber: string;
  readonly trainName: string;
  readonly fromCode: string;
  readonly toCode: string;
  readonly departure: string;
  readonly arrival: string;
  readonly durationMinutes: number;
  readonly distanceKm: number;
}

export interface NormalizedJourney {
  readonly id: string;
  readonly fromCode: string;
  readonly toCode: string;
  readonly date: string;
  readonly segments: readonly NormalizedJourneySegment[];
  readonly transfers: number;
  readonly totalDurationMinutes: number;
  readonly totalDistanceKm: number;
}

export interface NormalizedFareComponent {
  readonly label: string;
  readonly amountMinor: number;
}

export interface NormalizedFare {
  readonly trainNumber: string;
  readonly fromCode: string;
  readonly toCode: string;
  readonly travelClass: string;
  readonly currency: string;
  readonly totalMinor: number;
  readonly components: readonly NormalizedFareComponent[];
  readonly refundable: boolean;
}

export interface NormalizedSeatAvailability {
  readonly trainNumber: string;
  readonly date: string;
  readonly travelClass: string;
  readonly quota: string;
  readonly status: "available" | "waitlist" | "regret" | "unknown";
  readonly available: number;
  readonly waitlist: number;
  readonly confirmationProbability: number;
}

export interface NormalizedCoachSeat {
  readonly number: string;
  readonly berth: string;
  readonly occupied: boolean;
}

export interface NormalizedCoachLayout {
  readonly trainNumber: string;
  readonly coach: string;
  readonly travelClass: string;
  readonly rows: number;
  readonly seats: readonly NormalizedCoachSeat[];
}

export interface NormalizedPlatform {
  readonly stationCode: string;
  readonly trainNumber: string;
  readonly platform: string;
  readonly expectedArrival?: string;
  readonly expectedDeparture?: string;
  readonly changed: boolean;
}

export interface NormalizedPassenger {
  readonly index: number;
  readonly bookingStatus: string;
  readonly currentStatus: string;
  readonly coach?: string;
  readonly berth?: string;
}

export interface NormalizedPNR {
  readonly pnr: string;
  readonly trainNumber: string;
  readonly fromCode: string;
  readonly toCode: string;
  readonly date: string;
  readonly travelClass: string;
  readonly chartPrepared: boolean;
  readonly passengers: readonly NormalizedPassenger[];
}

export interface NormalizedJourneyHistoryEntry {
  readonly reference: string;
  readonly trainNumber: string;
  readonly fromCode: string;
  readonly toCode: string;
  readonly date: string;
  readonly status: "completed" | "cancelled" | "upcoming";
}

export interface NormalizedJourneyHistory {
  readonly reference: string;
  readonly entries: readonly NormalizedJourneyHistoryEntry[];
}

export interface NormalizedDelay {
  readonly trainNumber: string;
  readonly stationCode: string;
  readonly delayMinutes: number;
  readonly reason: string;
  readonly measuredAt: number;
}

export interface NormalizedLiveStatus {
  readonly trainNumber: string;
  readonly date: string;
  readonly lastStationCode: string;
  readonly nextStationCode: string;
  readonly delayMinutes: number;
  readonly positionPercent: number;
  readonly speedKmph: number;
  readonly updatedAt: number;
}

export interface NormalizedAlert {
  readonly id: string;
  readonly severity: "info" | "warning" | "critical";
  readonly scope: "network" | "station" | "train";
  readonly reference: string;
  readonly title: string;
  readonly message: string;
  readonly issuedAt: number;
}

export interface NormalizedCancellation {
  readonly trainNumber: string;
  readonly date: string;
  readonly fullyCancelled: boolean;
  readonly cancelledFromCode?: string;
  readonly cancelledToCode?: string;
  readonly reason: string;
}

export interface NormalizedDiversion {
  readonly trainNumber: string;
  readonly date: string;
  readonly divertedViaCodes: readonly string[];
  readonly skippedStationCodes: readonly string[];
  readonly extraDistanceKm: number;
  readonly reason: string;
}

/** Union of every normalized railway payload. */
export type NormalizedRailwayPayload =
  | readonly NormalizedStation[]
  | NormalizedStationMetadata
  | readonly NormalizedTrain[]
  | NormalizedTrainMetadata
  | NormalizedSchedule
  | NormalizedRoute
  | readonly NormalizedJourney[]
  | NormalizedFare
  | NormalizedSeatAvailability
  | NormalizedCoachLayout
  | NormalizedPlatform
  | NormalizedPNR
  | NormalizedJourneyHistory
  | NormalizedLiveStatus
  | readonly NormalizedAlert[]
  | NormalizedDelay
  | NormalizedCancellation
  | NormalizedDiversion;
