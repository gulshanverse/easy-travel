/**
 * TravelIntelligenceService — the orchestration layer.
 * Composes JourneyService, TimelineService, BudgetService, ActivityService,
 * RecommendationService, CollaborationService, VersionService, ExportService.
 *
 * This layer never contains UI. It coordinates high-level workflows:
 *  - createJourneyFromPrompt (AI Core -> Journey -> Version snapshot)
 *  - refreshRecommendations
 *  - fullTripSnapshot
 *  - stateAdvance
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { JourneyService, type CreateTripInput } from "./journey.server";
import { TimelineService } from "./timeline.server";
import { ActivityService } from "./activity.server";
import { BudgetService, type CurrencyConverter } from "./budget.server";
import { DestinationIntelligence } from "./destination.server";
import { RecommendationService } from "./recommendation.server";
import { CollaborationService } from "./collaboration.server";
import { VersionService } from "./version.server";
import { ExportService } from "./export.server";
import type { JourneyState, TIEResult } from "./types";
import { ok, fail } from "./types";

type SB = SupabaseClient<Database>;

export interface TIEContext {
  supabase: SB;
  userId: string;
  fx?: CurrencyConverter;
}

export class TravelIntelligenceService {
  readonly journey: JourneyService;
  readonly timeline: TimelineService;
  readonly activities: ActivityService;
  readonly budget: BudgetService;
  readonly destinations: DestinationIntelligence;
  readonly recommendations: RecommendationService;
  readonly collaboration: CollaborationService;
  readonly versions: VersionService;
  readonly exports: ExportService;

  constructor(private readonly ctx: TIEContext) {
    this.journey = new JourneyService(ctx.supabase, ctx.userId);
    this.timeline = new TimelineService(ctx.supabase);
    this.activities = new ActivityService(ctx.supabase);
    this.budget = new BudgetService(ctx.supabase, ctx.fx);
    this.destinations = new DestinationIntelligence(ctx.supabase);
    this.recommendations = new RecommendationService(ctx.supabase);
    this.collaboration = new CollaborationService(ctx.supabase);
    this.versions = new VersionService(ctx.supabase);
    this.exports = new ExportService(ctx.supabase);
  }

  /** Full trip aggregate used by dashboards, exports, and AI context builders. */
  async fullTripSnapshot(tripId: string) {
    const [trip, timeline, budget, versions, collaborators] = await Promise.all([
      this.journey.get(tripId),
      this.timeline.build(tripId),
      this.budget.summarize(tripId),
      this.versions.list(tripId),
      this.collaboration.list(tripId),
    ]);
    if (!trip.ok) return trip;
    return ok({
      trip: trip.data,
      timeline: timeline.ok ? timeline.data : null,
      budget: budget.ok ? budget.data : null,
      versions: versions.ok ? versions.data : [],
      collaborators: collaborators.ok ? collaborators.data : [],
    });
  }

  /**
   * Create a new journey shell, then take an initial snapshot so the
   * version history begins at v1 (empty state is a valid rollback target).
   */
  async createJourney(input: CreateTripInput): Promise<TIEResult<{ tripId: string; version: number }>> {
    const trip = await this.journey.create(input);
    if (!trip.ok) return trip;
    const snap = await this.versions.snapshot(trip.data.id, "create", this.ctx.userId);
    if (!snap.ok) return snap;
    return ok({ tripId: trip.data.id, version: snap.data.version });
  }

  /** Attempt a lifecycle transition with automatic snapshot on major states. */
  async advance(tripId: string, next: JourneyState): Promise<TIEResult<{ state: JourneyState; version?: number }>> {
    const trans = await this.journey.transition(tripId, next);
    if (!trans.ok) return trans;
    if (["ready", "booked", "completed"].includes(next)) {
      const snap = await this.versions.snapshot(tripId, `state:${next}`, this.ctx.userId);
      if (snap.ok) return ok({ state: next, version: snap.data.version });
    }
    return ok({ state: next });
  }

  async ensureOwnership(tripId: string): Promise<TIEResult<true>> {
    const { data, error } = await this.ctx.supabase
      .from("trips")
      .select("user_id")
      .eq("id", tripId)
      .maybeSingle();
    if (error) return fail("tie.ownership_read_failed", error.message);
    if (!data) return fail("tie.trip_not_found", "Trip not found");
    if (data.user_id !== this.ctx.userId) return fail("tie.forbidden", "You are not the trip owner");
    return ok(true);
  }
}

export function createTIE(ctx: TIEContext): TravelIntelligenceService {
  return new TravelIntelligenceService(ctx);
}
