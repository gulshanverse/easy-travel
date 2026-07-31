/**
 * Identity Platform — deterministic personalization engine (ADR-021).
 *
 * Personalization produces auditable *signals* only. It never selects,
 * books, ranks or decides anything on its own — downstream decision and
 * agent engines consume these signals as inputs (ADR-020).
 */
import type { IdentityConfig } from "./config";
import { deepFreeze } from "./factories";
import { favoriteSignals } from "./favorites";
import { preferenceSignals } from "./preferences";
import type {
  ConsentRecord, Favorite, PersonalizationProfile, PersonalizationSignal,
  PrivacySettings, SavedJourney, UserPreferences,
} from "./types";
import { personalizationAllowed } from "./privacy";

/** Stable, order-independent 32-bit fingerprint (FNV-1a). */
export function fingerprintSignals(signals: readonly PersonalizationSignal[]): string {
  const canonical = [...signals]
    .map((s) => `${s.key}=${String(s.value)}@${s.weight.toFixed(4)}`)
    .sort()
    .join("|");
  let hash = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function journeySignals(journeys: readonly SavedJourney[]): readonly PersonalizationSignal[] {
  const destinations = new Map<string, number>();
  for (const j of journeys) {
    if (!j.destination || j.status === "archived") continue;
    destinations.set(j.destination, (destinations.get(j.destination) ?? 0) + 1);
  }
  return Object.freeze(
    [...destinations.entries()]
      .map(([dest, count]) => ({
        key: `destination:${dest}`,
        value: count,
        weight: Math.min(0.2, 0.05 * count),
        source: "saved_journeys",
      }))
      .sort((a, b) => a.key.localeCompare(b.key)),
  );
}

export interface BuildPersonalizationInput {
  readonly userId: string;
  readonly preferences: UserPreferences;
  readonly favorites: readonly Favorite[];
  readonly journeys: readonly SavedJourney[];
  readonly privacy: PrivacySettings;
  readonly consents: readonly ConsentRecord[];
  readonly config: IdentityConfig;
  readonly at: number;
}

export function buildPersonalizationProfile(
  input: BuildPersonalizationInput,
): PersonalizationProfile {
  const allowed = personalizationAllowed(input.privacy, input.consents);
  if (!allowed) {
    return deepFreeze({
      userId: input.userId,
      builtAt: input.at,
      signals: [],
      score: 0,
      fingerprint: fingerprintSignals([]),
      suppressed: true,
    });
  }
  const signals = [
    ...preferenceSignals(input.preferences),
    ...favoriteSignals(input.favorites),
    ...journeySignals(input.journeys),
  ].sort((a, b) => a.key.localeCompare(b.key));

  const w = input.config.personalization;

  // Deterministic completeness score in [0,1].
  const parts = [
    input.preferences.preferredTransport.length > 0 ? w.transportWeight : 0,
    input.preferences.maxBudgetMinorUnits != null ? w.budgetWeight : w.budgetWeight * 0.5,
    input.favorites.length > 0 ? w.favoriteWeight : 0,
    input.preferences.preferredLanguage ? w.localeWeight : 0,
    input.preferences.accessibility.notes || input.preferences.accessibility.wheelchairAccess
      ? w.accessibilityWeight
      : w.accessibilityWeight * 0.5,
  ];
  const score = Math.min(1, Number(parts.reduce((a, b) => a + b, 0).toFixed(6)));

  return deepFreeze({
    userId: input.userId,
    builtAt: input.at,
    signals: Object.freeze(signals),
    score,
    fingerprint: fingerprintSignals(signals),
    suppressed: false,
  });
}

/** Explains a personalization profile for auditing. */
export function explainPersonalization(profile: PersonalizationProfile): readonly string[] {
  if (profile.suppressed) return Object.freeze(["Personalization suppressed by privacy settings."]);
  return Object.freeze(
    profile.signals.map((s) => `${s.key} = ${String(s.value)} (weight ${s.weight.toFixed(2)}, from ${s.source})`),
  );
}
