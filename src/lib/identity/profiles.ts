/**
 * Identity Platform — Travel Profile Runtime (Sprint I-018, ADR-022).
 *
 * A Travel Profile is a *reusable preference bundle*. Built-in profiles are
 * templates; a user's profile is an editable, immutable copy of a template.
 */
import { IdentityValidationError } from "./errors";
import {
  makeConfidencePreference, mergePreferenceSets, type ConfidencePreference,
} from "./confidence";
import { deepFreeze } from "./factories";
import { newProfileHistoryId, newTravelProfileId } from "./ids";
import { requireNonEmpty } from "./validation";

export type TravelProfileType =
  | "business" | "backpacker" | "luxury" | "family"
  | "student" | "solo" | "senior" | "group";

export const TRAVEL_PROFILE_TYPES: readonly TravelProfileType[] = Object.freeze([
  "business", "backpacker", "luxury", "family", "student", "solo", "senior", "group",
]);

export interface TravelProfilePreference extends ConfidencePreference {
  /** Relative influence of this preference inside the bundle, in [0,1]. */
  readonly weight: number;
}

export interface TravelProfileMetadata {
  readonly builtIn: boolean;
  readonly templateType: TravelProfileType;
  readonly tags: readonly string[];
  readonly description: string;
  readonly attributes: Readonly<Record<string, string | number | boolean>>;
}

export interface TravelProfile {
  readonly id: string;
  readonly userId: string | null;
  readonly type: TravelProfileType;
  readonly name: string;
  readonly active: boolean;
  readonly preferences: readonly TravelProfilePreference[];
  readonly metadata: TravelProfileMetadata;
  readonly revision: number;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface TravelProfileSnapshot {
  readonly profileId: string;
  readonly userId: string | null;
  readonly type: TravelProfileType;
  readonly at: number;
  readonly revision: number;
  readonly preferenceCount: number;
  readonly fingerprint: string;
}

export interface TravelProfileHistory {
  readonly id: string;
  readonly profileId: string;
  readonly at: number;
  readonly action: string;
  readonly revision: number;
  readonly detail: Readonly<Record<string, unknown>>;
}

interface TemplatePreference {
  readonly key: string;
  readonly value: string | number | boolean;
  readonly weight: number;
  readonly reason: string;
}

interface TravelProfileTemplate {
  readonly type: TravelProfileType;
  readonly name: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly preferences: readonly TemplatePreference[];
}

function pref(
  key: string, value: string | number | boolean, weight: number, reason: string,
): TemplatePreference {
  return Object.freeze({ key, value, weight, reason });
}

/** Built-in reusable bundles. Templates are frozen; user copies are editable. */
export const TRAVEL_PROFILE_TEMPLATES: Readonly<Record<TravelProfileType, TravelProfileTemplate>> =
  Object.freeze({
    business: Object.freeze({
      type: "business" as const,
      name: "Business Traveller",
      description: "Speed, reliability and workspace comfort over price.",
      tags: Object.freeze(["work", "speed", "flexible"]),
      preferences: Object.freeze([
        pref("preferredBudget", "premium", 0.9, "expense-backed travel"),
        pref("preferredTransport", "flight", 1, "fastest door-to-door"),
        pref("preferredCabin", "business", 0.8, "work in transit"),
        pref("preferredSeat", "aisle", 0.7, "easy access during flights"),
        pref("preferredCoach", "ac1", 0.6, "quiet rail travel"),
        pref("flexibleTickets", true, 0.9, "schedules change frequently"),
        pref("maxTransfers", 1, 0.8, "minimise disruption risk"),
      ]),
    }),
    backpacker: Object.freeze({
      type: "backpacker" as const,
      name: "Backpacker",
      description: "Lowest cost, long durations, high tolerance for transfers.",
      tags: Object.freeze(["budget", "slow", "flexible"]),
      preferences: Object.freeze([
        pref("preferredBudget", "shoestring", 1, "cost is the main constraint"),
        pref("preferredTransport", "bus", 0.8, "cheapest reliable mode"),
        pref("preferredCoach", "sleeper", 0.7, "overnight travel saves a night"),
        pref("preferredSeat", "any", 0.3, "seat is not important"),
        pref("maxTransfers", 4, 0.6, "transfers acceptable for savings"),
        pref("hostelFriendly", true, 0.8, "shared accommodation preferred"),
      ]),
    }),
    luxury: Object.freeze({
      type: "luxury" as const,
      name: "Luxury Traveller",
      description: "Comfort, privacy and service quality above all.",
      tags: Object.freeze(["premium", "comfort", "service"]),
      preferences: Object.freeze([
        pref("preferredBudget", "luxury", 1, "premium experience expected"),
        pref("preferredCabin", "first", 0.9, "maximum comfort"),
        pref("preferredCoach", "ac1", 0.85, "private rail cabins"),
        pref("preferredSeat", "window", 0.6, "views and privacy"),
        pref("minHotelRating", 5, 0.9, "five-star accommodation"),
        pref("maxTransfers", 0, 0.8, "direct connections only"),
      ]),
    }),
    family: Object.freeze({
      type: "family" as const,
      name: "Family Traveller",
      description: "Group seating, gentle pace and child-friendly logistics.",
      tags: Object.freeze(["family", "comfort", "safety"]),
      preferences: Object.freeze([
        pref("preferredBudget", "balanced", 0.8, "value for a group"),
        pref("preferredTransport", "train", 0.8, "space to move around"),
        pref("preferredSeat", "lower", 0.8, "safer for children"),
        pref("preferredCoach", "ac3", 0.6, "affordable family berths"),
        pref("adjacentSeating", true, 1, "family must sit together"),
        pref("maxTransfers", 1, 0.8, "transfers are hard with children"),
      ]),
    }),
    student: Object.freeze({
      type: "student" as const,
      name: "Student Traveller",
      description: "Discount-first travel with flexible timing.",
      tags: Object.freeze(["budget", "discounts", "flexible"]),
      preferences: Object.freeze([
        pref("preferredBudget", "budget", 0.9, "limited budget"),
        pref("preferredTransport", "train", 0.7, "student rail concessions"),
        pref("preferredCoach", "sleeper", 0.6, "cheapest overnight option"),
        pref("concessionEligible", true, 1, "student discounts apply"),
        pref("maxTransfers", 3, 0.5, "flexible when cheaper"),
      ]),
    }),
    solo: Object.freeze({
      type: "solo" as const,
      name: "Solo Traveller",
      description: "Independent, safety-aware, spontaneous travel.",
      tags: Object.freeze(["solo", "safety", "spontaneous"]),
      preferences: Object.freeze([
        pref("preferredBudget", "balanced", 0.7, "self-funded trips"),
        pref("preferredSeat", "window", 0.6, "quiet corner"),
        pref("preferredTransport", "train", 0.6, "scenic and social"),
        pref("safetyPriority", true, 0.9, "solo travel safety"),
        pref("daytimeArrival", true, 0.8, "avoid late-night arrivals"),
      ]),
    }),
    senior: Object.freeze({
      type: "senior" as const,
      name: "Senior Citizen",
      description: "Accessibility, low effort and predictable schedules.",
      tags: Object.freeze(["accessibility", "comfort", "assistance"]),
      preferences: Object.freeze([
        pref("preferredBudget", "balanced", 0.7, "fixed income"),
        pref("preferredSeat", "lower", 1, "no climbing required"),
        pref("preferredCoach", "ac2", 0.7, "comfortable and calm"),
        pref("stepFreeRoutes", true, 1, "mobility support required"),
        pref("assistanceRequired", true, 0.8, "station assistance"),
        pref("maxTransfers", 1, 0.9, "transfers are tiring"),
      ]),
    }),
    group: Object.freeze({
      type: "group" as const,
      name: "Group Traveller",
      description: "Bulk bookings, shared budgets and coordinated logistics.",
      tags: Object.freeze(["group", "coordination", "value"]),
      preferences: Object.freeze([
        pref("preferredBudget", "budget", 0.8, "shared costs"),
        pref("preferredTransport", "bus", 0.7, "one vehicle for everyone"),
        pref("adjacentSeating", true, 0.9, "group must travel together"),
        pref("groupDiscounts", true, 0.9, "bulk pricing applies"),
        pref("maxTransfers", 2, 0.6, "coordination overhead"),
      ]),
    }),
  });

function templatePreferences(
  template: TravelProfileTemplate, at: number,
): readonly TravelProfilePreference[] {
  return Object.freeze(
    [...template.preferences]
      .map((p) => deepFreeze({
        ...makeConfidencePreference({
          key: p.key,
          value: p.value,
          confidence: Number(Math.min(1, 0.6 + p.weight * 0.4).toFixed(4)),
          source: "inherited",
          at,
          reason: `${template.name}: ${p.reason}`,
        }),
        weight: p.weight,
      }))
      .sort((a, b) => a.key.localeCompare(b.key)),
  );
}

export interface MakeTravelProfileInput {
  userId?: string | null;
  type: TravelProfileType;
  name?: string;
  active?: boolean;
  preferences?: readonly TravelProfilePreference[];
  tags?: readonly string[];
  description?: string;
  attributes?: Readonly<Record<string, string | number | boolean>>;
  builtIn?: boolean;
  at?: number;
}

export function makeTravelProfile(input: MakeTravelProfileInput): TravelProfile {
  const template = TRAVEL_PROFILE_TEMPLATES[input.type];
  if (!template) throw new IdentityValidationError(`Unknown travel profile type: ${input.type}`);
  const at = input.at ?? Date.now();
  return deepFreeze({
    id: newTravelProfileId(),
    userId: input.userId ?? null,
    type: input.type,
    name: requireNonEmpty(input.name ?? template.name, "name"),
    active: input.active ?? true,
    preferences: input.preferences
      ? Object.freeze([...input.preferences].sort((a, b) => a.key.localeCompare(b.key)))
      : templatePreferences(template, at),
    metadata: {
      builtIn: input.builtIn ?? false,
      templateType: input.type,
      tags: [...(input.tags ?? template.tags)],
      description: input.description ?? template.description,
      attributes: { ...(input.attributes ?? {}) },
    },
    revision: 1,
    createdAt: at,
    updatedAt: at,
  });
}

/** The frozen catalogue of built-in, unowned profile bundles. */
export function builtInTravelProfiles(at = 0): readonly TravelProfile[] {
  return Object.freeze(
    TRAVEL_PROFILE_TYPES.map((type) =>
      makeTravelProfile({ type, builtIn: true, userId: null, at })),
  );
}

export type TravelProfilePatch = {
  readonly name?: string;
  readonly active?: boolean;
  readonly description?: string;
  readonly tags?: readonly string[];
  readonly attributes?: Readonly<Record<string, string | number | boolean>>;
  readonly preferences?: readonly TravelProfilePreference[];
};

export function applyTravelProfilePatch(
  profile: TravelProfile, patch: TravelProfilePatch, at: number,
): TravelProfile {
  if (profile.metadata.builtIn) {
    throw new IdentityValidationError("built-in travel profiles are read-only; copy first", {
      id: profile.id,
    });
  }
  const preferences = patch.preferences
    ? (mergePreferenceSets(profile.preferences, patch.preferences) as readonly ConfidencePreference[])
      .map((p) => deepFreeze({
        ...p,
        weight: patch.preferences?.find((x) => x.key === p.key)?.weight
          ?? profile.preferences.find((x) => x.key === p.key)?.weight
          ?? 0.5,
      }))
    : profile.preferences;
  return deepFreeze({
    ...profile,
    name: patch.name ?? profile.name,
    active: patch.active ?? profile.active,
    preferences: Object.freeze([...preferences].sort((a, b) => a.key.localeCompare(b.key))),
    metadata: {
      ...profile.metadata,
      description: patch.description ?? profile.metadata.description,
      tags: patch.tags ? [...new Set(patch.tags)] : profile.metadata.tags,
      attributes: patch.attributes
        ? { ...profile.metadata.attributes, ...patch.attributes }
        : profile.metadata.attributes,
    },
    revision: profile.revision + 1,
    updatedAt: at,
  });
}

/** Copies a built-in template into an owned, editable profile. */
export function adoptTravelProfile(
  type: TravelProfileType, userId: string, at: number,
): TravelProfile {
  return makeTravelProfile({ type, userId, builtIn: false, at });
}

/** Stable 32-bit fingerprint (FNV-1a) over the bundle contents. */
export function travelProfileFingerprint(profile: TravelProfile): string {
  const canonical = [...profile.preferences]
    .map((p) => `${p.key}=${String(p.value)}@${p.confidence.toFixed(4)}:${p.source}:${p.weight.toFixed(2)}`)
    .sort()
    .join("|");
  let hash = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function travelProfileSnapshot(profile: TravelProfile, at: number): TravelProfileSnapshot {
  return deepFreeze({
    profileId: profile.id,
    userId: profile.userId,
    type: profile.type,
    at,
    revision: profile.revision,
    preferenceCount: profile.preferences.length,
    fingerprint: travelProfileFingerprint(profile),
  });
}

export function makeTravelProfileHistory(input: {
  profileId: string; action: string; revision: number; at: number;
  detail?: Record<string, unknown>;
}): TravelProfileHistory {
  return deepFreeze({
    id: newProfileHistoryId(),
    profileId: input.profileId,
    at: input.at,
    action: input.action,
    revision: input.revision,
    detail: { ...(input.detail ?? {}) },
  });
}

/**
 * Flattens several active profiles into one deterministic bundle.
 * Later profiles refine earlier ones under ADR-024 merge rules.
 */
export function resolveProfileBundle(
  profiles: readonly TravelProfile[],
): readonly TravelProfilePreference[] {
  const ordered = [...profiles]
    .filter((p) => p.active)
    .sort((a, b) => (a.createdAt - b.createdAt) || a.id.localeCompare(b.id));
  const byKey = new Map<string, TravelProfilePreference>();
  for (const profile of ordered) {
    for (const p of profile.preferences) {
      const current = byKey.get(p.key);
      if (!current) { byKey.set(p.key, p); continue; }
      const winner = (p.confidence * p.weight) >= (current.confidence * current.weight)
        ? p : current;
      byKey.set(p.key, winner);
    }
  }
  return Object.freeze([...byKey.values()].sort((a, b) => a.key.localeCompare(b.key)));
}
