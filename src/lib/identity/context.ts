/**
 * Identity Platform — Personalization Context (Sprint I-018, ADR-021).
 *
 * A single immutable, versioned context object consumed by the Journey,
 * Decision, Goal and Agent engines. It carries resolved preferences,
 * confidence, statistics and constraints — never raw personal data,
 * and never travel options.
 */
import type { ConfidencePreference } from "./confidence";
import { deepFreeze } from "./factories";
import { newContextHistoryId } from "./ids";
import type { PreferenceConflict, PreferenceResolution } from "./resolution";
import type { TravelStatistics } from "./statistics";
import type { TravelProfileType } from "./profiles";
import type {
  NotificationChannel, PersonalizationProfile, UserPreferences,
} from "./types";

export interface PersonalizationConstraint {
  readonly key: string;
  readonly value: string | number | boolean;
  readonly hard: boolean;
  readonly reason: string;
}

export interface PersonalizationContext {
  readonly userId: string;
  readonly builtAt: number;
  readonly version: number;
  readonly locale: string;
  readonly currency: string;
  readonly timezone: string;
  readonly activeProfiles: readonly TravelProfileType[];
  readonly resolved: Readonly<Record<string, string | number | boolean>>;
  readonly resolutions: readonly PreferenceResolution[];
  readonly preferences: readonly ConfidencePreference[];
  readonly constraints: readonly PersonalizationConstraint[];
  readonly conflicts: readonly PreferenceConflict[];
  readonly statistics: TravelStatistics;
  readonly signals: PersonalizationProfile;
  readonly notificationChannels: readonly NotificationChannel[];
  readonly suppressed: boolean;
  readonly fingerprint: string;
}

export interface PersonalizationContextHistoryEntry {
  readonly id: string;
  readonly userId: string;
  readonly at: number;
  readonly version: number;
  readonly fingerprint: string;
  readonly reason: string;
}

/** Hard constraints are derived from accessibility & dietary needs only. */
export function deriveConstraints(prefs: UserPreferences): readonly PersonalizationConstraint[] {
  const out: PersonalizationConstraint[] = [];
  const a = prefs.accessibility;
  if (a.wheelchairAccess) out.push({ key: "wheelchairAccess", value: true, hard: true, reason: "wheelchair access required" });
  if (a.stepFreeRoutes) out.push({ key: "stepFreeRoutes", value: true, hard: true, reason: "step-free routes required" });
  if (a.assistanceRequired) out.push({ key: "assistanceRequired", value: true, hard: true, reason: "station assistance required" });
  if (a.reducedMotion) out.push({ key: "reducedMotion", value: true, hard: false, reason: "reduced motion preferred" });
  if (a.highContrast) out.push({ key: "highContrast", value: true, hard: false, reason: "high contrast preferred" });
  if (a.largeText) out.push({ key: "largeText", value: true, hard: false, reason: "large text preferred" });
  const d = prefs.dietary;
  if (d.nutAllergy) out.push({ key: "nutAllergy", value: true, hard: true, reason: "nut allergy is a safety constraint" });
  if (d.vegan) out.push({ key: "vegan", value: true, hard: true, reason: "vegan diet" });
  else if (d.vegetarian) out.push({ key: "vegetarian", value: true, hard: true, reason: "vegetarian diet" });
  if (d.halal) out.push({ key: "halal", value: true, hard: true, reason: "halal diet" });
  if (d.kosher) out.push({ key: "kosher", value: true, hard: true, reason: "kosher diet" });
  if (d.glutenFree) out.push({ key: "glutenFree", value: true, hard: true, reason: "gluten-free diet" });
  if (prefs.maxBudgetMinorUnits !== null) {
    out.push({ key: "maxBudgetMinorUnits", value: prefs.maxBudgetMinorUnits, hard: true, reason: "declared budget ceiling" });
  }
  return Object.freeze(out.sort((x, y) => x.key.localeCompare(y.key)));
}

function fingerprintOf(parts: readonly string[]): string {
  const canonical = parts.join("|");
  let hash = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export interface BuildPersonalizationContextInput {
  readonly userId: string;
  readonly at: number;
  readonly version?: number;
  readonly preferences: UserPreferences;
  readonly confidencePreferences: readonly ConfidencePreference[];
  readonly resolutions: readonly PreferenceResolution[];
  readonly statistics: TravelStatistics;
  readonly signals: PersonalizationProfile;
  readonly activeProfiles?: readonly TravelProfileType[];
  readonly suppressed?: boolean;
}

export function buildPersonalizationContext(
  input: BuildPersonalizationContextInput,
): PersonalizationContext {
  const suppressed = input.suppressed ?? input.signals.suppressed;
  const resolved: Record<string, string | number | boolean> = {};
  for (const r of input.resolutions) {
    if (r.value !== null) resolved[r.key] = r.value;
  }
  const conflicts = input.resolutions.flatMap((r) => [...r.conflicts]);
  const constraints = deriveConstraints(input.preferences);
  const fingerprint = fingerprintOf([
    input.userId,
    ...Object.keys(resolved).sort().map((k) => `${k}=${String(resolved[k])}`),
    ...constraints.map((c) => `${c.key}:${String(c.value)}:${c.hard}`),
    suppressed ? "suppressed" : "active",
  ]);
  return deepFreeze({
    userId: input.userId,
    builtAt: input.at,
    version: input.version ?? 1,
    locale: input.preferences.preferredLanguage,
    currency: input.preferences.preferredCurrency,
    timezone: input.preferences.preferredTimezone,
    activeProfiles: [...(input.activeProfiles ?? [])].sort(),
    resolved: suppressed ? {} : resolved,
    resolutions: suppressed ? [] : input.resolutions,
    preferences: suppressed ? [] : input.confidencePreferences,
    constraints,
    conflicts: suppressed ? [] : conflicts,
    statistics: input.statistics,
    signals: input.signals,
    notificationChannels: input.preferences.preferredNotificationChannels,
    suppressed,
    fingerprint,
  });
}

export function makeContextHistoryEntry(input: {
  userId: string; at: number; version: number; fingerprint: string; reason: string;
}): PersonalizationContextHistoryEntry {
  return deepFreeze({
    id: newContextHistoryId(),
    userId: input.userId,
    at: input.at,
    version: input.version,
    fingerprint: input.fingerprint,
    reason: input.reason,
  });
}

/** Deterministic diff between two contexts, sorted by key. */
export function diffPersonalizationContext(
  before: PersonalizationContext, after: PersonalizationContext,
): readonly string[] {
  const keys = [...new Set([...Object.keys(before.resolved), ...Object.keys(after.resolved)])].sort();
  const out: string[] = [];
  for (const key of keys) {
    const a = before.resolved[key];
    const b = after.resolved[key];
    if (a === b) continue;
    if (a === undefined) out.push(`+${key}=${String(b)}`);
    else if (b === undefined) out.push(`-${key}=${String(a)}`);
    else out.push(`~${key}: ${String(a)} → ${String(b)}`);
  }
  return Object.freeze(out);
}
