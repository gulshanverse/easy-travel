/**
 * Identity Platform — validation helpers. Pure and deterministic.
 */
import { IdentityValidationError } from "./errors";
import type {
  Favorite, NotificationSettings, PrivacySettings, SavedJourney,
  User, UserPreferences, UserProfile,
} from "./types";

const HANDLE_RE = /^[a-z0-9](?:[a-z0-9_.-]{1,30})[a-z0-9]$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CURRENCY_RE = /^[A-Z]{3}$/;

export function requireNonEmpty(value: string | null | undefined, field: string): string {
  const v = (value ?? "").trim();
  if (!v) throw new IdentityValidationError(`${field} is required`, { field });
  return v;
}

export function validateHandle(handle: string): string {
  const h = requireNonEmpty(handle, "handle").toLowerCase();
  if (!HANDLE_RE.test(h)) throw new IdentityValidationError(`Invalid handle: ${handle}`, { handle });
  return h;
}

export function validateEmail(email: string | null | undefined): string | null {
  if (email == null || email === "") return null;
  const e = email.trim().toLowerCase();
  if (!EMAIL_RE.test(e)) throw new IdentityValidationError(`Invalid email: ${email}`, { email });
  return e;
}

export function validateCurrency(currency: string): string {
  const c = requireNonEmpty(currency, "currency").toUpperCase();
  if (!CURRENCY_RE.test(c)) throw new IdentityValidationError(`Invalid currency: ${currency}`, { currency });
  return c;
}

export function validateLanguage(language: string): string {
  const l = requireNonEmpty(language, "language");
  if (!/^[a-z]{2}(-[A-Za-z0-9]{2,8})?$/.test(l)) {
    throw new IdentityValidationError(`Invalid language tag: ${language}`, { language });
  }
  return l;
}

export function validateTimezone(tz: string): string {
  const t = requireNonEmpty(tz, "timezone");
  if (!/^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){0,2}$/.test(t)) {
    throw new IdentityValidationError(`Invalid timezone: ${tz}`, { timezone: tz });
  }
  return t;
}

export function validateHour(hour: number, field: string): number {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new IdentityValidationError(`${field} must be an integer hour 0..23`, { field, hour });
  }
  return hour;
}

export function validateUser(user: User): User {
  validateHandle(user.handle);
  validateEmail(user.email);
  if (!Object.isFrozen(user)) throw new IdentityValidationError("User must be frozen", { id: user.id });
  return user;
}

export function validateProfile(profile: UserProfile): UserProfile {
  requireNonEmpty(profile.displayName, "displayName");
  if (profile.bio && profile.bio.length > 2000) {
    throw new IdentityValidationError("bio too long", { length: profile.bio.length });
  }
  return profile;
}

export function validatePreferences(prefs: UserPreferences): UserPreferences {
  validateLanguage(prefs.preferredLanguage);
  validateCurrency(prefs.preferredCurrency);
  validateTimezone(prefs.preferredTimezone);
  if (prefs.maxBudgetMinorUnits != null && prefs.maxBudgetMinorUnits < 0) {
    throw new IdentityValidationError("maxBudgetMinorUnits must be >= 0", {
      value: prefs.maxBudgetMinorUnits,
    });
  }
  if (new Set(prefs.preferredTransport).size !== prefs.preferredTransport.length) {
    throw new IdentityValidationError("preferredTransport contains duplicates");
  }
  return prefs;
}

export function validateNotificationSettings(s: NotificationSettings): NotificationSettings {
  if (s.quietHours) {
    validateHour(s.quietHours.startHour, "quietHours.startHour");
    validateHour(s.quietHours.endHour, "quietHours.endHour");
  }
  return s;
}

export function validatePrivacySettings(s: PrivacySettings): PrivacySettings {
  if (!["private", "companions", "public"].includes(s.profileVisibility)) {
    throw new IdentityValidationError(`Invalid profileVisibility: ${s.profileVisibility}`);
  }
  return s;
}

export function validateFavorite(fav: Favorite): Favorite {
  requireNonEmpty(fav.label, "label");
  switch (fav.kind) {
    case "station": requireNonEmpty(fav.stationCode, "stationCode"); break;
    case "airport":
      if (!/^[A-Z]{3}$/.test(fav.iataCode)) {
        throw new IdentityValidationError(`Invalid IATA code: ${fav.iataCode}`);
      }
      break;
    case "hotel": requireNonEmpty(fav.hotelId, "hotelId"); break;
    case "place": requireNonEmpty(fav.placeId, "placeId"); break;
    case "route":
      requireNonEmpty(fav.origin, "origin");
      requireNonEmpty(fav.destination, "destination");
      if (fav.origin === fav.destination) {
        throw new IdentityValidationError("route origin and destination must differ");
      }
      break;
    case "search": requireNonEmpty(fav.query, "query"); break;
    case "mode": requireNonEmpty(fav.mode, "mode"); break;
    case "season": requireNonEmpty(fav.season, "season"); break;
    case "companion": requireNonEmpty(fav.companionId, "companionId"); break;
  }
  return fav;
}

export function validateSavedJourney(j: SavedJourney): SavedJourney {
  requireNonEmpty(j.title, "title");
  if (j.startDate && j.endDate && j.startDate > j.endDate) {
    throw new IdentityValidationError("startDate must be <= endDate", {
      startDate: j.startDate, endDate: j.endDate,
    });
  }
  if (new Set(j.tags).size !== j.tags.length) {
    throw new IdentityValidationError("tags contain duplicates");
  }
  if (j.sharing.isShared && !j.sharing.shareId) {
    throw new IdentityValidationError("shared journeys require a shareId", { id: j.id });
  }
  return j;
}

/** Stable identity key for favorites — used for de-duplication. */
export function favoriteKey(fav: Favorite): string {
  switch (fav.kind) {
    case "place": return `place:${fav.placeId}`;
    case "station": return `station:${fav.stationCode}`;
    case "airport": return `airport:${fav.iataCode}`;
    case "hotel": return `hotel:${fav.hotelId}`;
    case "route": return `route:${fav.mode}:${fav.origin}>${fav.destination}`;
    case "search": return `search:${fav.query}`;
    case "mode": return `mode:${fav.mode}`;
    case "season": return `season:${fav.season}`;
    case "companion": return `companion:${fav.companionId}`;
  }
}
