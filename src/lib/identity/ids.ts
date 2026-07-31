/**
 * Identity, Personalization & User Platform (IPUP) — deterministic ID helpers.
 */
let counter = 0;
function next(prefix: string): string {
  counter = (counter + 1) >>> 0;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

export const newUserId = () => next("usr");
export const newProfileId = () => next("prf");
export const newPreferencesId = () => next("pref");
export const newSettingsId = () => next("uset");
export const newFavoriteId = () => next("fav");
export const newSavedJourneyId = () => next("sjy");
export const newJourneyVersionId = () => next("sjv");
export const newJourneyNoteId = () => next("sjn");
export const newCompanionId = () => next("cmp");
export const newEmergencyContactId = () => next("emc");
export const newSessionId = () => next("dev");
export const newConsentId = () => next("cns");
export const newExportId = () => next("exp");
export const newDeletionId = () => next("del");
export const newEventId = () => next("iev");
export const newHistoryId = () => next("ihs");
export const newCorrelationId = () => next("cor");
