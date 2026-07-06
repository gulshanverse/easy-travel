/**
 * TIE Client SDK — thin, client-safe wrapper.
 * UI code (routes, components, hooks) MUST use this SDK instead of
 * importing server modules directly.
 */

import {
  advanceTripFn,
  buildTimelineFn,
  budgetSummaryFn,
  cloneTripFn,
  createActivityFn,
  createTripFn,
  dismissRecommendationFn,
  exportTripFn,
  getTripFn,
  inviteCollaboratorFn,
  listRecommendationsFn,
  listTripsFn,
  listVersionsFn,
  moveActivityFn,
  removeActivityFn,
  rollbackVersionFn,
  setBudgetFn,
} from "./tie.functions";
import type { CollaboratorRole, ExportFormat, JourneyState, RecommendationSubject } from "./types";

/** Unified client for the Travel Intelligence Engine. */
export const tieClient = {
  // Journey
  createTrip: (data: Parameters<typeof createTripFn>[0]["data"]) => createTripFn({ data }),
  listTrips: () => listTripsFn(),
  getTrip: (tripId: string) => getTripFn({ data: { tripId } }),
  advanceTrip: (tripId: string, next: JourneyState) => advanceTripFn({ data: { tripId, next } }),
  cloneTrip: (tripId: string) => cloneTripFn({ data: { tripId } }),

  // Timeline
  buildTimeline: (tripId: string) => buildTimelineFn({ data: { tripId } }),
  moveActivity: (activityId: string, dayId: string | null, position: number) =>
    moveActivityFn({ data: { activityId, dayId, position } }),

  // Activity
  createActivity: (data: Parameters<typeof createActivityFn>[0]["data"]) => createActivityFn({ data }),
  removeActivity: (activityId: string) => removeActivityFn({ data: { activityId } }),

  // Budget
  budgetSummary: (tripId: string) => budgetSummaryFn({ data: { tripId } }),
  setBudget: (tripId: string, budgetCents: number | null, currency?: string) =>
    setBudgetFn({ data: { tripId, budgetCents, currency } }),

  // Recommendations
  listRecommendations: (subjectKind?: RecommendationSubject) => listRecommendationsFn({ data: { subjectKind } }),
  dismissRecommendation: (id: string) => dismissRecommendationFn({ data: { id } }),

  // Collaboration
  inviteCollaborator: (tripId: string, userId: string, role: CollaboratorRole = "viewer") =>
    inviteCollaboratorFn({ data: { tripId, userId, role } }),

  // Version
  listVersions: (tripId: string) => listVersionsFn({ data: { tripId } }),
  rollback: (tripId: string, version: number) => rollbackVersionFn({ data: { tripId, version } }),

  // Export
  export: (tripId: string, format: ExportFormat, baseUrl?: string) =>
    exportTripFn({ data: { tripId, format, baseUrl } }),
} as const;

export type TIEClient = typeof tieClient;
