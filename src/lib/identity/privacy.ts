/**
 * Identity Platform — Privacy runtime helpers.
 */
import { deepFreeze } from "./factories";
import type {
  ConsentKind, ConsentRecord, DataDeletionRequest, DataExportRequest,
  PrivacySettings, ProfileVisibility,
} from "./types";
import { validatePrivacySettings } from "./validation";

export function updatePrivacySettings(
  current: PrivacySettings,
  patch: Partial<Omit<PrivacySettings, "userId">>,
  at: number,
): PrivacySettings {
  return validatePrivacySettings(deepFreeze({ ...current, ...patch, updatedAt: at }));
}

/** Latest consent per kind wins; returns false when never granted. */
export function hasConsent(consents: readonly ConsentRecord[], kind: ConsentKind): boolean {
  let latest: ConsentRecord | undefined;
  for (const c of consents) {
    if (c.kind !== kind) continue;
    if (!latest || c.at >= latest.at) latest = c;
  }
  return latest?.granted ?? false;
}

export function consentLedger(
  consents: readonly ConsentRecord[],
): Readonly<Partial<Record<ConsentKind, ConsentRecord>>> {
  const out: Partial<Record<ConsentKind, ConsentRecord>> = {};
  for (const c of consents) {
    const prev = out[c.kind];
    if (!prev || c.at >= prev.at) out[c.kind] = c;
  }
  return Object.freeze(out);
}

export function personalizationAllowed(
  privacy: PrivacySettings,
  consents: readonly ConsentRecord[],
): boolean {
  if (!privacy.allowPersonalization) return false;
  const explicit = consents.some((c) => c.kind === "personalization");
  return explicit ? hasConsent(consents, "personalization") : true;
}

export function canViewProfile(
  privacy: PrivacySettings,
  viewer: { isSelf: boolean; isCompanion: boolean },
): boolean {
  if (viewer.isSelf) return true;
  const order: Readonly<Record<ProfileVisibility, number>> = { private: 0, companions: 1, public: 2 };
  const level = order[privacy.profileVisibility];
  if (level === 2) return true;
  if (level === 1) return viewer.isCompanion;
  return false;
}

export function completeExportRequest(
  request: DataExportRequest,
  recordCounts: Readonly<Record<string, number>>,
  at: number,
): DataExportRequest {
  return deepFreeze({
    ...request,
    status: "ready" as const,
    completedAt: at,
    recordCounts: { ...recordCounts },
  });
}

export function completeDeletionRequest(
  request: DataDeletionRequest,
  at: number,
): DataDeletionRequest {
  return deepFreeze({ ...request, status: "fulfilled" as const, completedAt: at });
}
