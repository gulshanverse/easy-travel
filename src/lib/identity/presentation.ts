/**
 * Identity Platform — Journey Studio presentation models (ADR-007 compliant).
 * UI-independent, immutable card models. No React, no styling, no DOM.
 */
import { deepFreeze } from "./factories";
import type { PersonalizationContext } from "./context";
import type { TravelProfile } from "./profiles";
import type { TravelStatistics } from "./statistics";
import type { Favorite, SavedJourney, UserPreferences, UserProfile } from "./types";

export type IdentityCardKind =
  | "identity.profile" | "identity.preferences" | "identity.travel_profile"
  | "identity.statistics" | "identity.favorites" | "identity.saved_journeys"
  | "identity.personalization" | "identity.privacy";

export interface IdentityCardRow {
  readonly label: string;
  readonly value: string;
  readonly emphasis: "primary" | "secondary" | "muted";
}

export interface IdentityCard {
  readonly id: string;
  readonly kind: IdentityCardKind;
  readonly title: string;
  readonly subtitle: string | null;
  readonly rows: readonly IdentityCardRow[];
  readonly badges: readonly string[];
  readonly order: number;
}

function row(label: string, value: string, emphasis: IdentityCardRow["emphasis"] = "secondary"): IdentityCardRow {
  return Object.freeze({ label, value, emphasis });
}

function card(input: IdentityCard): IdentityCard {
  return deepFreeze(input);
}

export function profileCard(profile: UserProfile): IdentityCard {
  return card({
    id: `card_${profile.id}`,
    kind: "identity.profile",
    title: profile.displayName,
    subtitle: profile.homeCity ? `${profile.homeCity}${profile.homeCountry ? `, ${profile.homeCountry}` : ""}` : null,
    rows: Object.freeze([
      row("Name", profile.fullName ?? profile.displayName, "primary"),
      row("Pronouns", profile.pronouns ?? "—", "muted"),
      row("Bio", profile.bio ?? "—", "muted"),
    ]),
    badges: Object.freeze([]),
    order: 0,
  });
}

export function preferencesCard(prefs: UserPreferences): IdentityCard {
  return card({
    id: `card_${prefs.id}`,
    kind: "identity.preferences",
    title: "Travel preferences",
    subtitle: `Revision ${prefs.revision}`,
    rows: Object.freeze([
      row("Budget", prefs.preferredBudget, "primary"),
      row("Transport", prefs.preferredTransport.join(", ") || "—"),
      row("Seat", prefs.preferredSeat),
      row("Coach", prefs.preferredCoach),
      row("Cabin", prefs.preferredCabin),
      row("Language", prefs.preferredLanguage, "muted"),
      row("Currency", prefs.preferredCurrency, "muted"),
    ]),
    badges: Object.freeze(prefs.preferredNotificationChannels.map(String)),
    order: 1,
  });
}

export function travelProfileCard(profile: TravelProfile): IdentityCard {
  return card({
    id: `card_${profile.id}`,
    kind: "identity.travel_profile",
    title: profile.name,
    subtitle: profile.metadata.description,
    rows: Object.freeze(
      profile.preferences.slice(0, 8).map((p) =>
        row(p.key, `${String(p.value)} (${(p.confidence * 100).toFixed(0)}%)`)),
    ),
    badges: Object.freeze([profile.type, ...profile.metadata.tags]),
    order: 2,
  });
}

export function statisticsCard(stats: TravelStatistics): IdentityCard {
  return card({
    id: `card_stats_${stats.userId}`,
    kind: "identity.statistics",
    title: "Travel statistics",
    subtitle: `Travel score ${stats.travelScore}/100`,
    rows: Object.freeze([
      row("Trips completed", String(stats.tripsCompleted), "primary"),
      row("Countries", String(stats.countriesVisited)),
      row("Cities", String(stats.citiesVisited)),
      row("Rail trips", String(stats.railTrips)),
      row("Flights", String(stats.flightTrips)),
      row("Hotel nights", String(stats.hotelNights)),
      row("Average trip length", `${stats.averageDurationDays} days`, "muted"),
    ]),
    badges: Object.freeze(stats.favouriteModes.slice(0, 3).map(String)),
    order: 3,
  });
}

export function favoritesCard(userId: string, favorites: readonly Favorite[]): IdentityCard {
  const byKind = new Map<string, number>();
  for (const f of favorites) byKind.set(f.kind, (byKind.get(f.kind) ?? 0) + 1);
  return card({
    id: `card_fav_${userId}`,
    kind: "identity.favorites",
    title: "Saved favourites",
    subtitle: `${favorites.length} saved`,
    rows: Object.freeze(
      [...byKind.entries()].sort((a, b) => a[0].localeCompare(b[0]))
        .map(([kind, count]) => row(kind, String(count))),
    ),
    badges: Object.freeze([]),
    order: 4,
  });
}

export function savedJourneysCard(userId: string, journeys: readonly SavedJourney[]): IdentityCard {
  const byStatus = new Map<string, number>();
  for (const j of journeys) byStatus.set(j.status, (byStatus.get(j.status) ?? 0) + 1);
  return card({
    id: `card_journeys_${userId}`,
    kind: "identity.saved_journeys",
    title: "Saved journeys",
    subtitle: `${journeys.length} journeys`,
    rows: Object.freeze(
      [...byStatus.entries()].sort((a, b) => a[0].localeCompare(b[0]))
        .map(([status, count]) => row(status, String(count))),
    ),
    badges: Object.freeze([]),
    order: 5,
  });
}

export function personalizationCard(context: PersonalizationContext): IdentityCard {
  return card({
    id: `card_ctx_${context.userId}_${context.version}`,
    kind: "identity.personalization",
    title: context.suppressed ? "Personalization off" : "Personalization",
    subtitle: `Fingerprint ${context.fingerprint}`,
    rows: Object.freeze(
      Object.keys(context.resolved).sort()
        .map((k) => row(k, String(context.resolved[k]))),
    ),
    badges: Object.freeze([
      ...context.activeProfiles.map(String),
      ...(context.conflicts.length > 0 ? [`${context.conflicts.length} conflicts`] : []),
    ]),
    order: 6,
  });
}

export interface IdentityPresentationInput {
  readonly profile: UserProfile;
  readonly preferences: UserPreferences;
  readonly travelProfiles?: readonly TravelProfile[];
  readonly statistics: TravelStatistics;
  readonly favorites: readonly Favorite[];
  readonly journeys: readonly SavedJourney[];
  readonly context: PersonalizationContext;
}

export function buildIdentityCards(input: IdentityPresentationInput): readonly IdentityCard[] {
  const cards: IdentityCard[] = [
    profileCard(input.profile),
    preferencesCard(input.preferences),
    ...(input.travelProfiles ?? []).filter((p) => p.active).map(travelProfileCard),
    statisticsCard(input.statistics),
    favoritesCard(input.profile.userId, input.favorites),
    savedJourneysCard(input.profile.userId, input.journeys),
    personalizationCard(input.context),
  ];
  return Object.freeze(cards.sort((a, b) => (a.order - b.order) || a.id.localeCompare(b.id)));
}
