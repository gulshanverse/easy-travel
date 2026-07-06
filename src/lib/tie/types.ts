/**
 * Travel Intelligence Engine (TIE) — Shared Types.
 * Isomorphic. Client-safe. Import from server or browser.
 */

import type { Database } from "@/integrations/supabase/types";

// ----- DB row aliases (single source of truth) -----
export type TripRow = Database["public"]["Tables"]["trips"]["Row"];
export type TripInsert = Database["public"]["Tables"]["trips"]["Insert"];
export type TripUpdate = Database["public"]["Tables"]["trips"]["Update"];
export type TripDayRow = Database["public"]["Tables"]["trip_days"]["Row"];
export type TripActivityRow = Database["public"]["Tables"]["trip_activities"]["Row"];
export type ItineraryRow = Database["public"]["Tables"]["itineraries"]["Row"];
export type AiRecommendationRow = Database["public"]["Tables"]["ai_recommendations"]["Row"];

export type TripStatus = Database["public"]["Enums"]["trip_status"];
export type TripVisibility = Database["public"]["Enums"]["trip_visibility"];
export type TripPace = Database["public"]["Enums"]["trip_pace"];
export type ActivityType = Database["public"]["Enums"]["activity_type"];

// ----- Journey lifecycle -----
export const JOURNEY_STATES = [
  "draft",
  "planning",
  "ready",
  "booked",
  "traveling",
  "completed",
  "archived",
  "cancelled",
] as const;
export type JourneyState = (typeof JOURNEY_STATES)[number];

/** Allowed transitions between journey states. */
export const JOURNEY_TRANSITIONS: Record<JourneyState, JourneyState[]> = {
  draft: ["planning", "archived", "cancelled"],
  planning: ["ready", "draft", "archived", "cancelled"],
  ready: ["booked", "planning", "cancelled"],
  booked: ["traveling", "ready", "cancelled"],
  traveling: ["completed", "cancelled"],
  completed: ["archived"],
  archived: ["draft"],
  cancelled: ["draft", "archived"],
};

// ----- Timeline -----
export interface TimelineEvent {
  id: string;
  tripId: string;
  dayId: string | null;
  dayIndex: number;
  position: number;
  startsAt: string | null;
  endsAt: string | null;
  durationMin: number | null;
  type: ActivityType;
  title: string;
  costCents: number | null;
  currency: string;
  placeId: string | null;
  bookingItemId: string | null;
  metadata: Record<string, unknown>;
}

export interface TimelineDay {
  id: string;
  dayIndex: number;
  date: string | null;
  title: string | null;
  summary: string | null;
  cityId: string | null;
  events: TimelineEvent[];
  totalCostCents: number;
  totalDurationMin: number;
  conflicts: TimelineConflict[];
}

export interface Timeline {
  tripId: string;
  currency: string;
  days: TimelineDay[];
  unscheduled: TimelineEvent[];
  totals: { cents: number; durationMin: number; eventCount: number };
}

export interface TimelineConflict {
  kind: "overlap" | "travel-gap" | "missing-time" | "out-of-day";
  message: string;
  eventIds: string[];
}

// ----- Budget -----
export interface BudgetCategoryTotal {
  category: string;
  estimatedCents: number;
  actualCents: number;
  percentOfBudget: number;
}

export interface BudgetSummary {
  tripId: string;
  currency: string;
  budgetCents: number | null;
  estimatedCents: number;
  actualCents: number;
  remainingCents: number | null;
  utilizationPct: number | null;
  perDayCents: number;
  perTravelerCents: number;
  categories: BudgetCategoryTotal[];
  warnings: BudgetWarning[];
}

export interface BudgetWarning {
  code: "over-budget" | "near-limit" | "no-budget-set" | "daily-limit-exceeded";
  message: string;
  severity: "info" | "warning" | "critical";
  meta?: Record<string, unknown>;
}

// ----- Destinations -----
export interface DestinationInsight {
  id: string;
  name: string;
  countryCode: string | null;
  cityId: string | null;
  timezone: string | null;
  currency: string | null;
  language: string | null;
  bestSeason: string | null;
  safetyScore: number | null;
  summary: string | null;
  tips: string[];
}

// ----- Recommendations -----
export type RecommendationSubject =
  | "trip"
  | "day"
  | "activity"
  | "place"
  | "hotel"
  | "restaurant"
  | "experience"
  | "flight"
  | "budget"
  | "packing";

export interface Recommendation<TPayload = Record<string, unknown>> {
  id: string;
  agent: string;
  subjectKind: RecommendationSubject;
  subjectId: string | null;
  score: number | null;
  reason: string | null;
  payload: TPayload;
  createdAt: string;
  expiresAt: string | null;
}

// ----- Collaboration -----
export type CollaboratorRole = "owner" | "editor" | "commenter" | "viewer";

export interface Collaborator {
  tripId: string;
  userId: string;
  role: CollaboratorRole;
  addedAt: string;
}

// ----- Version / snapshot -----
export interface JourneyVersion {
  id: string;
  tripId: string;
  version: number;
  source: string;
  isActive: boolean;
  createdAt: string;
  createdBy: string | null;
  summary?: string;
}

export interface JourneyDiff {
  from: number;
  to: number;
  addedActivities: string[];
  removedActivities: string[];
  changedActivities: string[];
  addedDays: number[];
  removedDays: number[];
}

// ----- Export -----
export type ExportFormat = "pdf" | "ics" | "json" | "share-link" | "offline";

export interface ExportResult {
  format: ExportFormat;
  contentType: string;
  filename: string;
  body: string; // base64 for binary, raw for text
  encoding: "utf8" | "base64";
  url?: string;
}

// ----- Result envelope -----
export type TIEResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; cause?: unknown } };

export function ok<T>(data: T): TIEResult<T> {
  return { ok: true, data };
}
export function fail<T = never>(code: string, message: string, cause?: unknown): TIEResult<T> {
  return { ok: false, error: { code, message, cause } };
}
