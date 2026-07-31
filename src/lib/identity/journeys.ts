/**
 * Identity Platform — Saved Journey engine (pure helpers).
 */
import { IdentityValidationError } from "./errors";
import { deepFreeze } from "./factories";
import { newJourneyNoteId, newJourneyVersionId } from "./ids";
import type { SavedJourney, SavedJourneyNote, SavedJourneyVersion } from "./types";
import { validateSavedJourney } from "./validation";

export type SavedJourneyPatch = Partial<
  Omit<SavedJourney, "id" | "userId" | "revision" | "createdAt" | "duplicatedFrom">
>;

export function updateSavedJourney(
  journey: SavedJourney,
  patch: SavedJourneyPatch,
  at: number,
): SavedJourney {
  if (journey.status === "archived" && patch.status !== "planned" && patch.status !== "draft") {
    throw new IdentityValidationError("Archived journeys must be restored before editing", {
      id: journey.id,
    });
  }
  return validateSavedJourney(deepFreeze({
    ...journey,
    ...patch,
    tags: patch.tags ? [...new Set(patch.tags)] : journey.tags,
    payload: patch.payload ? { ...patch.payload } : journey.payload,
    revision: journey.revision + 1,
    updatedAt: at,
  }));
}

export function archiveSavedJourney(journey: SavedJourney, at: number): SavedJourney {
  if (journey.archivedAt) return journey;
  return deepFreeze({
    ...journey,
    status: "archived" as const,
    archivedAt: at,
    updatedAt: at,
    revision: journey.revision + 1,
  });
}

export function restoreSavedJourney(journey: SavedJourney, at: number): SavedJourney {
  if (!journey.archivedAt) return journey;
  return deepFreeze({
    ...journey,
    status: "planned" as const,
    archivedAt: null,
    updatedAt: at,
    revision: journey.revision + 1,
  });
}

export function duplicateSavedJourney(
  journey: SavedJourney,
  input: { id: string; title?: string; at: number },
): SavedJourney {
  return validateSavedJourney(deepFreeze({
    ...journey,
    id: input.id,
    title: input.title ?? `${journey.title} (copy)`,
    status: "draft" as const,
    revision: 1,
    duplicatedFrom: journey.id,
    createdAt: input.at,
    updatedAt: input.at,
    archivedAt: null,
  }));
}

export function makeJourneyVersion(
  journey: SavedJourney,
  reason: string,
  at: number,
): SavedJourneyVersion {
  return deepFreeze({
    id: newJourneyVersionId(),
    journeyId: journey.id,
    revision: journey.revision,
    title: journey.title,
    summary: journey.summary,
    payload: { ...journey.payload },
    createdAt: at,
    reason,
  });
}

export function makeJourneyNote(
  input: { journeyId: string; authorId: string; body: string; at: number },
): SavedJourneyNote {
  const body = input.body.trim();
  if (!body) throw new IdentityValidationError("note body is required");
  return deepFreeze({
    id: newJourneyNoteId(),
    journeyId: input.journeyId,
    authorId: input.authorId,
    body,
    createdAt: input.at,
  });
}

export function addTags(journey: SavedJourney, tags: readonly string[], at: number): SavedJourney {
  const merged = [...new Set([...journey.tags, ...tags.map((t) => t.trim()).filter(Boolean)])];
  return deepFreeze({ ...journey, tags: merged, updatedAt: at, revision: journey.revision + 1 });
}

export function removeTags(journey: SavedJourney, tags: readonly string[], at: number): SavedJourney {
  const drop = new Set(tags);
  const kept = journey.tags.filter((t) => !drop.has(t));
  if (kept.length === journey.tags.length) return journey;
  return deepFreeze({ ...journey, tags: kept, updatedAt: at, revision: journey.revision + 1 });
}

export function orderVersions(
  versions: readonly SavedJourneyVersion[],
): readonly SavedJourneyVersion[] {
  return Object.freeze([...versions].sort((a, b) => a.revision - b.revision));
}
