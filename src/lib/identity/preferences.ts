/**
 * Identity Platform — Preference System (pure, deterministic).
 */
import { deepFreeze } from "./factories";
import type {
  AccessibilityPreferences, DietaryPreferences, PersonalizationSignal, UserPreferences,
} from "./types";
import { validatePreferences } from "./validation";

export type PreferencePatch = Partial<Omit<UserPreferences, "id" | "userId" | "revision">> & {
  accessibility?: Partial<AccessibilityPreferences>;
  dietary?: Partial<DietaryPreferences>;
};

export function applyPreferencePatch(
  current: UserPreferences,
  patch: PreferencePatch,
  at: number,
): UserPreferences {
  const next: UserPreferences = deepFreeze({
    ...current,
    ...patch,
    preferredTransport: patch.preferredTransport
      ? [...new Set(patch.preferredTransport)]
      : current.preferredTransport,
    preferredAirlines: patch.preferredAirlines
      ? [...new Set(patch.preferredAirlines)]
      : current.preferredAirlines,
    preferredHotels: patch.preferredHotels
      ? [...new Set(patch.preferredHotels)]
      : current.preferredHotels,
    preferredNotificationChannels: patch.preferredNotificationChannels
      ? [...new Set(patch.preferredNotificationChannels)]
      : current.preferredNotificationChannels,
    preferredCurrency: (patch.preferredCurrency ?? current.preferredCurrency).toUpperCase(),
    accessibility: { ...current.accessibility, ...(patch.accessibility ?? {}) },
    dietary: { ...current.dietary, ...(patch.dietary ?? {}) },
    updatedAt: at,
    revision: current.revision + 1,
  });
  return validatePreferences(next);
}

const BUDGET_SCORE: Readonly<Record<UserPreferences["preferredBudget"], number>> = Object.freeze({
  shoestring: 0.1, budget: 0.3, balanced: 0.5, premium: 0.75, luxury: 1,
});

export function budgetScore(prefs: UserPreferences): number {
  return BUDGET_SCORE[prefs.preferredBudget];
}

/** Ranks transport modes by explicit preference order; unknown modes rank last. */
export function rankTransport(
  prefs: UserPreferences,
  candidates: readonly UserPreferences["preferredTransport"][number][],
): readonly { mode: string; rank: number }[] {
  return [...candidates]
    .map((mode) => {
      const idx = prefs.preferredTransport.indexOf(mode);
      return { mode, rank: idx === -1 ? Number.MAX_SAFE_INTEGER : idx };
    })
    .sort((a, b) => (a.rank - b.rank) || a.mode.localeCompare(b.mode));
}

export function hasAccessibilityNeeds(prefs: UserPreferences): boolean {
  const a = prefs.accessibility;
  return a.wheelchairAccess || a.stepFreeRoutes || a.assistanceRequired ||
    a.reducedMotion || a.highContrast || a.largeText;
}

export function dietaryTags(prefs: UserPreferences): readonly string[] {
  const d = prefs.dietary;
  const tags: string[] = [];
  if (d.vegetarian) tags.push("vegetarian");
  if (d.vegan) tags.push("vegan");
  if (d.halal) tags.push("halal");
  if (d.kosher) tags.push("kosher");
  if (d.glutenFree) tags.push("gluten_free");
  if (d.nutAllergy) tags.push("nut_allergy");
  return Object.freeze(tags);
}

/** Deterministic signals derived from preferences only (ADR-020/021). */
export function preferenceSignals(prefs: UserPreferences): readonly PersonalizationSignal[] {
  const signals: PersonalizationSignal[] = [
    { key: "preferred_budget", value: prefs.preferredBudget, weight: 0.25, source: "preferences" },
    { key: "preferred_language", value: prefs.preferredLanguage, weight: 0.1, source: "preferences" },
    { key: "preferred_currency", value: prefs.preferredCurrency, weight: 0.1, source: "preferences" },
    { key: "preferred_timezone", value: prefs.preferredTimezone, weight: 0.05, source: "preferences" },
    { key: "preferred_seat", value: prefs.preferredSeat, weight: 0.05, source: "preferences" },
    { key: "preferred_coach", value: prefs.preferredCoach, weight: 0.05, source: "preferences" },
    { key: "preferred_cabin", value: prefs.preferredCabin, weight: 0.05, source: "preferences" },
  ];
  prefs.preferredTransport.forEach((mode, i) => {
    signals.push({
      key: `transport:${mode}`,
      value: true,
      weight: Math.max(0.05, 0.3 - i * 0.05),
      source: "preferences",
    });
  });
  for (const airline of prefs.preferredAirlines) {
    signals.push({ key: `airline:${airline}`, value: true, weight: 0.1, source: "preferences" });
  }
  for (const hotel of prefs.preferredHotels) {
    signals.push({ key: `hotel:${hotel}`, value: true, weight: 0.1, source: "preferences" });
  }
  if (hasAccessibilityNeeds(prefs)) {
    signals.push({ key: "accessibility_required", value: true, weight: 0.2, source: "preferences" });
  }
  for (const tag of dietaryTags(prefs)) {
    signals.push({ key: `dietary:${tag}`, value: true, weight: 0.05, source: "preferences" });
  }
  return Object.freeze(signals.sort((a, b) => a.key.localeCompare(b.key)));
}
