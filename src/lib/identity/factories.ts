/**
 * Identity Platform — immutable model factories.
 * Every factory validates and deep-freezes its output.
 */
import {
  newCompanionId, newConsentId, newDeletionId, newEmergencyContactId, newExportId,
  newFavoriteId, newPreferencesId, newProfileId, newSavedJourneyId, newSessionId,
  newSettingsId, newUserId,
} from "./ids";
import type {
  AccessibilityPreferences, ConsentRecord, DataDeletionRequest, DataExportRequest,
  DeviceSession, DietaryPreferences, EmergencyContact, Favorite, NotificationSettings,
  PrivacySettings, SavedJourney, TravelCompanion, User, UserMetadata, UserPreferences,
  UserProfile, UserSettings, UserStatistics,
} from "./types";
import {
  validateEmail, validateFavorite, validateHandle, validateNotificationSettings,
  validatePreferences, validatePrivacySettings, validateProfile, validateSavedJourney,
  validateUser, requireNonEmpty,
} from "./validation";

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value as Record<string, unknown>)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

const DEFAULT_ACCESSIBILITY: AccessibilityPreferences = Object.freeze({
  wheelchairAccess: false,
  stepFreeRoutes: false,
  reducedMotion: false,
  highContrast: false,
  largeText: false,
  assistanceRequired: false,
  notes: null,
});

const DEFAULT_DIETARY: DietaryPreferences = Object.freeze({
  vegetarian: false,
  vegan: false,
  halal: false,
  kosher: false,
  glutenFree: false,
  nutAllergy: false,
  notes: null,
});

export interface MakeUserInput {
  id?: string;
  handle: string;
  email?: string | null;
  status?: User["status"];
  at?: number;
  metadata?: Partial<UserMetadata>;
  statistics?: Partial<UserStatistics>;
}

export function makeUser(input: MakeUserInput): User {
  const at = input.at ?? Date.now();
  const user: User = deepFreeze({
    id: input.id ?? newUserId(),
    handle: validateHandle(input.handle),
    email: validateEmail(input.email ?? null),
    status: input.status ?? "active",
    createdAt: at,
    updatedAt: at,
    metadata: {
      source: input.metadata?.source ?? "app",
      tags: [...(input.metadata?.tags ?? [])],
      attributes: { ...(input.metadata?.attributes ?? {}) },
    },
    statistics: {
      journeysSaved: input.statistics?.journeysSaved ?? 0,
      journeysCompleted: input.statistics?.journeysCompleted ?? 0,
      favoritesCount: input.statistics?.favoritesCount ?? 0,
      preferenceUpdates: input.statistics?.preferenceUpdates ?? 0,
      lastActiveAt: input.statistics?.lastActiveAt ?? null,
    },
  });
  return validateUser(user);
}

export interface MakeProfileInput {
  userId: string;
  displayName: string;
  fullName?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  homeCity?: string | null;
  homeCountry?: string | null;
  pronouns?: string | null;
  at?: number;
}

export function makeUserProfile(input: MakeProfileInput): UserProfile {
  const at = input.at ?? Date.now();
  return validateProfile(deepFreeze({
    id: newProfileId(),
    userId: requireNonEmpty(input.userId, "userId"),
    displayName: input.displayName,
    fullName: input.fullName ?? null,
    avatarUrl: input.avatarUrl ?? null,
    bio: input.bio ?? null,
    homeCity: input.homeCity ?? null,
    homeCountry: input.homeCountry ?? null,
    pronouns: input.pronouns ?? null,
    createdAt: at,
    updatedAt: at,
  }));
}

export interface MakePreferencesInput extends Partial<Omit<UserPreferences, "id" | "userId">> {
  userId: string;
  at?: number;
}

export function makeUserPreferences(input: MakePreferencesInput): UserPreferences {
  const at = input.at ?? input.updatedAt ?? Date.now();
  return validatePreferences(deepFreeze({
    id: newPreferencesId(),
    userId: requireNonEmpty(input.userId, "userId"),
    preferredTransport: [...(input.preferredTransport ?? ["train", "flight"])],
    preferredBudget: input.preferredBudget ?? "balanced",
    maxBudgetMinorUnits: input.maxBudgetMinorUnits ?? null,
    preferredSeat: input.preferredSeat ?? "any",
    preferredCoach: input.preferredCoach ?? "any",
    preferredCabin: input.preferredCabin ?? "any",
    preferredAirlines: [...(input.preferredAirlines ?? [])],
    preferredHotels: [...(input.preferredHotels ?? [])],
    preferredLanguage: input.preferredLanguage ?? "en",
    preferredCurrency: (input.preferredCurrency ?? "USD").toUpperCase(),
    preferredTimezone: input.preferredTimezone ?? "UTC",
    preferredNotificationChannels: [...(input.preferredNotificationChannels ?? ["in_app"])],
    accessibility: { ...DEFAULT_ACCESSIBILITY, ...(input.accessibility ?? {}) },
    dietary: { ...DEFAULT_DIETARY, ...(input.dietary ?? {}) },
    updatedAt: at,
    revision: input.revision ?? 1,
  }));
}

export function makeUserSettings(input: { userId: string; at?: number } & Partial<UserSettings>): UserSettings {
  const at = input.at ?? Date.now();
  return deepFreeze({
    id: newSettingsId(),
    userId: requireNonEmpty(input.userId, "userId"),
    theme: input.theme ?? "system",
    units: input.units ?? "metric",
    dateFormat: input.dateFormat ?? "iso",
    timeFormat: input.timeFormat ?? "24h",
    weekStartsOn: input.weekStartsOn ?? 1,
    updatedAt: at,
  });
}

export function makeNotificationSettings(
  input: { userId: string; at?: number } & Partial<NotificationSettings>,
): NotificationSettings {
  const at = input.at ?? Date.now();
  return validateNotificationSettings(deepFreeze({
    userId: requireNonEmpty(input.userId, "userId"),
    email: input.email ?? true,
    sms: input.sms ?? false,
    push: input.push ?? false,
    inApp: input.inApp ?? true,
    reminders: input.reminders ?? true,
    workflowAlerts: input.workflowAlerts ?? true,
    delayAlerts: input.delayAlerts ?? true,
    priceAlerts: input.priceAlerts ?? false,
    weatherAlerts: input.weatherAlerts ?? false,
    quietHours: input.quietHours ?? null,
    frequency: input.frequency ?? "instant",
    updatedAt: at,
  }));
}

export function makePrivacySettings(
  input: { userId: string; at?: number } & Partial<PrivacySettings>,
): PrivacySettings {
  const at = input.at ?? Date.now();
  return validatePrivacySettings(deepFreeze({
    userId: requireNonEmpty(input.userId, "userId"),
    profileVisibility: input.profileVisibility ?? "private",
    shareJourneysWithCompanions: input.shareJourneysWithCompanions ?? false,
    allowPersonalization: input.allowPersonalization ?? true,
    allowAnalytics: input.allowAnalytics ?? false,
    allowLocationHistory: input.allowLocationHistory ?? false,
    searchableByEmail: input.searchableByEmail ?? false,
    updatedAt: at,
  }));
}

export type MakeFavoriteInput =
  Omit<Favorite, "id" | "createdAt" | "notes"> & { notes?: string | null; at?: number };

export function makeFavorite(input: MakeFavoriteInput): Favorite {
  const { at, notes, ...rest } = input;
  const fav = deepFreeze({
    ...rest,
    id: newFavoriteId(),
    notes: notes ?? null,
    createdAt: at ?? Date.now(),
  }) as Favorite;
  return validateFavorite(fav);
}

export interface MakeSavedJourneyInput extends Partial<Omit<SavedJourney, "id" | "userId">> {
  userId: string;
  title: string;
  at?: number;
}

export function makeSavedJourney(input: MakeSavedJourneyInput): SavedJourney {
  const at = input.at ?? Date.now();
  return validateSavedJourney(deepFreeze({
    id: newSavedJourneyId(),
    userId: requireNonEmpty(input.userId, "userId"),
    title: input.title,
    summary: input.summary ?? null,
    status: input.status ?? "draft",
    origin: input.origin ?? null,
    destination: input.destination ?? null,
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
    tags: [...(input.tags ?? [])],
    payload: { ...(input.payload ?? {}) },
    revision: input.revision ?? 1,
    duplicatedFrom: input.duplicatedFrom ?? null,
    createdAt: at,
    updatedAt: at,
    archivedAt: input.archivedAt ?? null,
  }));
}

export function makeTravelCompanion(
  input: { userId: string; name: string; relationship?: string | null;
    ageGroup?: TravelCompanion["ageGroup"]; preferencesRef?: string | null; at?: number },
): TravelCompanion {
  return deepFreeze({
    id: newCompanionId(),
    userId: requireNonEmpty(input.userId, "userId"),
    name: requireNonEmpty(input.name, "name"),
    relationship: input.relationship ?? null,
    ageGroup: input.ageGroup ?? "adult",
    preferencesRef: input.preferencesRef ?? null,
    createdAt: input.at ?? Date.now(),
  });
}

export function makeEmergencyContact(
  input: { userId: string; name: string; relationship?: string | null;
    phone?: string | null; email?: string | null; priority?: number; at?: number },
): EmergencyContact {
  return deepFreeze({
    id: newEmergencyContactId(),
    userId: requireNonEmpty(input.userId, "userId"),
    name: requireNonEmpty(input.name, "name"),
    relationship: input.relationship ?? null,
    phone: input.phone ?? null,
    email: validateEmail(input.email ?? null),
    priority: input.priority ?? 1,
    createdAt: input.at ?? Date.now(),
  });
}

export function makeDeviceSession(
  input: { userId: string; device?: DeviceSession["device"]; label?: string;
    ttlMs?: number; locale?: string | null; timezone?: string | null; at?: number },
): DeviceSession {
  const at = input.at ?? Date.now();
  return deepFreeze({
    id: newSessionId(),
    userId: requireNonEmpty(input.userId, "userId"),
    device: input.device ?? "web",
    label: input.label ?? "Unnamed device",
    createdAt: at,
    lastSeenAt: at,
    expiresAt: at + (input.ttlMs ?? 1000 * 60 * 60 * 24 * 30),
    revokedAt: null,
    locale: input.locale ?? null,
    timezone: input.timezone ?? null,
  });
}

export function makeConsentRecord(
  input: { userId: string; kind: ConsentRecord["kind"]; granted: boolean;
    version?: string; source?: string; at?: number },
): ConsentRecord {
  return deepFreeze({
    id: newConsentId(),
    userId: requireNonEmpty(input.userId, "userId"),
    kind: input.kind,
    granted: input.granted,
    version: input.version ?? "1.0.0",
    at: input.at ?? Date.now(),
    source: input.source ?? "app",
  });
}

export function makeDataExportRequest(
  input: { userId: string; scopes?: readonly string[]; at?: number },
): DataExportRequest {
  return deepFreeze({
    id: newExportId(),
    userId: requireNonEmpty(input.userId, "userId"),
    status: "requested",
    requestedAt: input.at ?? Date.now(),
    completedAt: null,
    scopes: [...(input.scopes ?? ["profile", "preferences", "journeys", "favorites"])],
    recordCounts: {},
  });
}

export function makeDataDeletionRequest(
  input: { userId: string; reason?: string | null; scopes?: readonly string[]; at?: number },
): DataDeletionRequest {
  return deepFreeze({
    id: newDeletionId(),
    userId: requireNonEmpty(input.userId, "userId"),
    status: "requested",
    requestedAt: input.at ?? Date.now(),
    completedAt: null,
    reason: input.reason ?? null,
    scopes: [...(input.scopes ?? ["all"])],
  });
}
