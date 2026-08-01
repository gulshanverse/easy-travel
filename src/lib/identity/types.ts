/**
 * Identity Platform — immutable domain models.
 * All models are frozen; every mutation returns a new object.
 */

export type UserStatus = "pending" | "active" | "suspended" | "deactivated" | "deleted";
export type TransportMode = "train" | "flight" | "bus" | "cab" | "ferry" | "walk" | "cycle";
export type BudgetTier = "shoestring" | "budget" | "balanced" | "premium" | "luxury";
export type SeatPreference = "window" | "aisle" | "middle" | "lower" | "upper" | "side_lower" | "any";
export type CoachPreference = "sleeper" | "ac3" | "ac2" | "ac1" | "chair_car" | "executive" | "any";
export type CabinPreference = "economy" | "premium_economy" | "business" | "first" | "any";
export type NotificationChannel = "email" | "sms" | "push" | "in_app";
export type NotificationCategory =
  | "reminder" | "workflow" | "delay" | "price" | "weather" | "marketing" | "security";
export type NotificationFrequency = "instant" | "hourly" | "daily" | "weekly" | "never";
export type FavoriteKind =
  | "place" | "station" | "airport" | "hotel" | "route" | "search"
  | "mode" | "season" | "companion";
export type Season = "spring" | "summer" | "autumn" | "winter";
export type SavedJourneyStatus =
  | "draft" | "planned" | "published" | "active" | "completed" | "archived";
export type ConsentKind =
  | "terms" | "privacy_policy" | "personalization" | "analytics" | "marketing" | "location";
export type ProfileVisibility = "private" | "companions" | "public";
export type DeviceKind = "web" | "mobile" | "tablet" | "desktop" | "unknown";
export type DataRequestStatus = "requested" | "processing" | "ready" | "fulfilled" | "rejected";

export interface UserMetadata {
  readonly source: string;
  readonly tags: readonly string[];
  readonly attributes: Readonly<Record<string, string | number | boolean>>;
}

export interface UserStatistics {
  readonly journeysSaved: number;
  readonly journeysCompleted: number;
  readonly favoritesCount: number;
  readonly preferenceUpdates: number;
  readonly lastActiveAt: number | null;
}

export interface UserProfile {
  readonly id: string;
  readonly userId: string;
  readonly displayName: string;
  readonly fullName: string | null;
  readonly avatarUrl: string | null;
  readonly bio: string | null;
  readonly homeCity: string | null;
  readonly homeCountry: string | null;
  readonly pronouns: string | null;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface AccessibilityPreferences {
  readonly wheelchairAccess: boolean;
  readonly stepFreeRoutes: boolean;
  readonly reducedMotion: boolean;
  readonly highContrast: boolean;
  readonly largeText: boolean;
  readonly assistanceRequired: boolean;
  readonly notes: string | null;
}

export interface DietaryPreferences {
  readonly vegetarian: boolean;
  readonly vegan: boolean;
  readonly halal: boolean;
  readonly kosher: boolean;
  readonly glutenFree: boolean;
  readonly nutAllergy: boolean;
  readonly notes: string | null;
}

export interface UserPreferences {
  readonly id: string;
  readonly userId: string;
  readonly preferredTransport: readonly TransportMode[];
  readonly preferredBudget: BudgetTier;
  readonly maxBudgetMinorUnits: number | null;
  readonly preferredSeat: SeatPreference;
  readonly preferredCoach: CoachPreference;
  readonly preferredCabin: CabinPreference;
  readonly preferredAirlines: readonly string[];
  readonly preferredHotels: readonly string[];
  readonly preferredLanguage: string;
  readonly preferredCurrency: string;
  readonly preferredTimezone: string;
  readonly preferredNotificationChannels: readonly NotificationChannel[];
  readonly accessibility: AccessibilityPreferences;
  readonly dietary: DietaryPreferences;
  readonly updatedAt: number;
  readonly revision: number;
}

export interface NotificationSettings {
  readonly userId: string;
  readonly email: boolean;
  readonly sms: boolean;
  readonly push: boolean;
  readonly inApp: boolean;
  readonly reminders: boolean;
  readonly workflowAlerts: boolean;
  readonly delayAlerts: boolean;
  readonly priceAlerts: boolean;
  readonly weatherAlerts: boolean;
  readonly quietHours: { readonly startHour: number; readonly endHour: number } | null;
  readonly frequency: NotificationFrequency;
  readonly updatedAt: number;
}

export interface PrivacySettings {
  readonly userId: string;
  readonly profileVisibility: ProfileVisibility;
  readonly shareJourneysWithCompanions: boolean;
  readonly allowPersonalization: boolean;
  readonly allowAnalytics: boolean;
  readonly allowLocationHistory: boolean;
  readonly searchableByEmail: boolean;
  readonly updatedAt: number;
}

export interface ConsentRecord {
  readonly id: string;
  readonly userId: string;
  readonly kind: ConsentKind;
  readonly granted: boolean;
  readonly version: string;
  readonly at: number;
  readonly source: string;
}

export interface DataExportRequest {
  readonly id: string;
  readonly userId: string;
  readonly status: DataRequestStatus;
  readonly requestedAt: number;
  readonly completedAt: number | null;
  readonly scopes: readonly string[];
  readonly recordCounts: Readonly<Record<string, number>>;
}

export interface DataDeletionRequest {
  readonly id: string;
  readonly userId: string;
  readonly status: DataRequestStatus;
  readonly requestedAt: number;
  readonly completedAt: number | null;
  readonly reason: string | null;
  readonly scopes: readonly string[];
}

export interface UserSettings {
  readonly id: string;
  readonly userId: string;
  readonly theme: "system" | "light" | "dark";
  readonly units: "metric" | "imperial";
  readonly dateFormat: "iso" | "dmy" | "mdy";
  readonly timeFormat: "12h" | "24h";
  readonly weekStartsOn: 0 | 1;
  readonly updatedAt: number;
}

export interface FavoriteBase {
  readonly id: string;
  readonly userId: string;
  readonly kind: FavoriteKind;
  readonly label: string;
  readonly createdAt: number;
  readonly notes: string | null;
}
export interface FavoritePlace extends FavoriteBase {
  readonly kind: "place";
  readonly placeId: string;
  readonly latitude: number | null;
  readonly longitude: number | null;
}
export interface FavoriteStation extends FavoriteBase {
  readonly kind: "station";
  readonly stationCode: string;
}
export interface FavoriteAirport extends FavoriteBase {
  readonly kind: "airport";
  readonly iataCode: string;
}
export interface FavoriteHotel extends FavoriteBase {
  readonly kind: "hotel";
  readonly hotelId: string;
}
export interface FavoriteRoute extends FavoriteBase {
  readonly kind: "route";
  readonly origin: string;
  readonly destination: string;
  readonly mode: TransportMode;
}
export interface FavoriteSearch extends FavoriteBase {
  readonly kind: "search";
  readonly query: string;
  readonly filters: Readonly<Record<string, string | number | boolean>>;
}
export interface FavoriteMode extends FavoriteBase {
  readonly kind: "mode";
  readonly mode: TransportMode;
}
export interface FavoriteSeason extends FavoriteBase {
  readonly kind: "season";
  readonly season: Season;
}
export interface FavoriteCompanion extends FavoriteBase {
  readonly kind: "companion";
  readonly companionId: string;
}
export type Favorite =
  | FavoritePlace | FavoriteStation | FavoriteAirport
  | FavoriteHotel | FavoriteRoute | FavoriteSearch
  | FavoriteMode | FavoriteSeason | FavoriteCompanion;

export interface SavedJourneyNote {
  readonly id: string;
  readonly journeyId: string;
  readonly authorId: string;
  readonly body: string;
  readonly createdAt: number;
}

export interface SavedJourneyVersion {
  readonly id: string;
  readonly journeyId: string;
  readonly revision: number;
  readonly title: string;
  readonly summary: string | null;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly createdAt: number;
  readonly reason: string;
}

export interface SavedJourney {
  readonly id: string;
  readonly userId: string;
  readonly title: string;
  readonly summary: string | null;
  readonly status: SavedJourneyStatus;
  readonly origin: string | null;
  readonly destination: string | null;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly tags: readonly string[];
  readonly payload: Readonly<Record<string, unknown>>;
  readonly revision: number;
  readonly duplicatedFrom: string | null;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly archivedAt: number | null;
}

export interface TravelCompanion {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly relationship: string | null;
  readonly ageGroup: "infant" | "child" | "adult" | "senior";
  readonly preferencesRef: string | null;
  readonly createdAt: number;
}

export interface EmergencyContact {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly relationship: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly priority: number;
  readonly createdAt: number;
}

export interface DeviceSession {
  readonly id: string;
  readonly userId: string;
  readonly device: DeviceKind;
  readonly label: string;
  readonly createdAt: number;
  readonly lastSeenAt: number;
  readonly expiresAt: number;
  readonly revokedAt: number | null;
  readonly locale: string | null;
  readonly timezone: string | null;
}

export interface User {
  readonly id: string;
  readonly handle: string;
  readonly email: string | null;
  readonly status: UserStatus;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly metadata: UserMetadata;
  readonly statistics: UserStatistics;
}

export interface IdentityHistoryEntry {
  readonly id: string;
  readonly userId: string;
  readonly at: number;
  readonly action: string;
  readonly detail: Readonly<Record<string, unknown>>;
}

/** Deterministic, auditable personalization signal set (ADR-021). */
export interface PersonalizationSignal {
  readonly key: string;
  readonly value: string | number | boolean;
  readonly weight: number;
  readonly source: string;
}

export interface PersonalizationProfile {
  readonly userId: string;
  readonly builtAt: number;
  readonly signals: readonly PersonalizationSignal[];
  readonly score: number;
  readonly fingerprint: string;
  readonly suppressed: boolean;
}

export interface UserContext {
  readonly userId: string;
  readonly locale: string;
  readonly currency: string;
  readonly timezone: string;
  readonly status: UserStatus;
  readonly personalization: PersonalizationProfile;
  readonly favoriteCount: number;
  readonly savedJourneyCount: number;
  readonly notificationChannels: readonly NotificationChannel[];
  readonly privacy: PrivacySettings;
}

export interface IdentitySnapshot {
  readonly at: number;
  readonly users: number;
  readonly favorites: number;
  readonly savedJourneys: number;
  readonly deviceSessions: number;
  readonly consents: number;
}
