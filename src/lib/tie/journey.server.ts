/**
 * JourneyService — trip lifecycle, state machine, cloning, templates.
 * Operates under an authenticated Supabase client (RLS as the user).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  JOURNEY_TRANSITIONS,
  type JourneyState,
  type TripInsert,
  type TripRow,
  type TripUpdate,
  type TIEResult,
  ok,
  fail,
} from "./types";
import { emitTIEEvent } from "./events";

type SB = SupabaseClient<Database>;

export interface CreateTripInput {
  title: string;
  summary?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  currency?: string;
  budgetTotalCents?: number | null;
  primaryDestinationId?: string | null;
  originCityId?: string | null;
  travelerCount?: number;
  pace?: TripInsert["pace"];
  visibility?: TripInsert["visibility"];
  tags?: string[];
}

export class JourneyService {
  constructor(private readonly supabase: SB, private readonly userId: string) {}

  async create(input: CreateTripInput): Promise<TIEResult<TripRow>> {
    const row: TripInsert = {
      user_id: this.userId,
      title: input.title.trim(),
      summary: input.summary ?? null,
      start_date: input.startDate ?? null,
      end_date: input.endDate ?? null,
      currency: input.currency ?? "USD",
      budget_total_cents: input.budgetTotalCents ?? null,
      primary_destination_id: input.primaryDestinationId ?? null,
      origin_city_id: input.originCityId ?? null,
      traveler_count: input.travelerCount ?? 1,
      pace: input.pace ?? "balanced",
      visibility: input.visibility ?? "private",
      tags: input.tags ?? [],
      status: "draft",
    };
    const { data, error } = await this.supabase.from("trips").insert(row).select("*").single();
    if (error) return fail("journey.create_failed", error.message, error);
    emitTIEEvent({ name: "TRIP_CREATED", tripId: data.id, userId: this.userId, data });
    return ok(data);
  }

  async get(tripId: string): Promise<TIEResult<TripRow>> {
    const { data, error } = await this.supabase
      .from("trips")
      .select("*")
      .eq("id", tripId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) return fail("journey.read_failed", error.message, error);
    if (!data) return fail("journey.not_found", "Trip not found");
    return ok(data);
  }

  async list(): Promise<TIEResult<TripRow[]>> {
    const { data, error } = await this.supabase
      .from("trips")
      .select("*")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false });
    if (error) return fail("journey.list_failed", error.message, error);
    return ok(data ?? []);
  }

  async update(tripId: string, patch: TripUpdate): Promise<TIEResult<TripRow>> {
    // Never allow status transitions via update; use transition().
    const safe: TripUpdate = { ...patch };
    delete safe.status;
    delete safe.user_id;
    const { data, error } = await this.supabase
      .from("trips")
      .update(safe)
      .eq("id", tripId)
      .select("*")
      .single();
    if (error) return fail("journey.update_failed", error.message, error);
    emitTIEEvent({ name: "TRIP_UPDATED", tripId, userId: this.userId, data });
    return ok(data);
  }

  async transition(tripId: string, next: JourneyState): Promise<TIEResult<TripRow>> {
    const current = await this.get(tripId);
    if (!current.ok) return current;
    const from = current.data.status as JourneyState;
    if (from === next) return ok(current.data);
    const allowed = JOURNEY_TRANSITIONS[from] ?? [];
    if (!allowed.includes(next)) {
      return fail(
        "journey.invalid_transition",
        `Cannot transition trip from '${from}' to '${next}'. Allowed: ${allowed.join(", ") || "none"}`,
      );
    }
    const { data, error } = await this.supabase
      .from("trips")
      .update({ status: next })
      .eq("id", tripId)
      .select("*")
      .single();
    if (error) return fail("journey.transition_failed", error.message, error);
    emitTIEEvent({
      name: "TRIP_STATE_CHANGED",
      tripId,
      userId: this.userId,
      data: { from, to: next },
    });
    return ok(data);
  }

  async softDelete(tripId: string): Promise<TIEResult<{ id: string }>> {
    const { error } = await this.supabase
      .from("trips")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", tripId);
    if (error) return fail("journey.delete_failed", error.message, error);
    emitTIEEvent({ name: "TRIP_DELETED", tripId, userId: this.userId });
    return ok({ id: tripId });
  }

  /** Deep clone a trip (days + activities). New trip starts in 'draft'. */
  async clone(tripId: string, overrides?: Partial<CreateTripInput>): Promise<TIEResult<TripRow>> {
    const src = await this.get(tripId);
    if (!src.ok) return src;
    const created = await this.create({
      title: overrides?.title ?? `${src.data.title} (Copy)`,
      summary: overrides?.summary ?? src.data.summary,
      currency: src.data.currency,
      budgetTotalCents: src.data.budget_total_cents,
      primaryDestinationId: src.data.primary_destination_id,
      originCityId: src.data.origin_city_id,
      travelerCount: src.data.traveler_count,
      pace: src.data.pace,
      visibility: "private",
      tags: src.data.tags,
      ...overrides,
    });
    if (!created.ok) return created;

    const { data: days } = await this.supabase
      .from("trip_days")
      .select("*")
      .eq("trip_id", tripId)
      .order("day_index", { ascending: true });
    const { data: acts } = await this.supabase
      .from("trip_activities")
      .select("*")
      .eq("trip_id", tripId);

    const dayIdMap = new Map<string, string>();
    if (days?.length) {
      for (const d of days) {
        const { data: newDay, error } = await this.supabase
          .from("trip_days")
          .insert({
            trip_id: created.data.id,
            day_index: d.day_index,
            title: d.title,
            summary: d.summary,
            city_id: d.city_id,
            date: null, // dates realign when user sets start_date
          })
          .select("id")
          .single();
        if (error || !newDay) continue;
        dayIdMap.set(d.id, newDay.id);
      }
    }
    if (acts?.length) {
      const rows = acts.map((a) => ({
        trip_id: created.data.id,
        trip_day_id: a.trip_day_id ? dayIdMap.get(a.trip_day_id) ?? null : null,
        title: a.title,
        description: a.description,
        activity_type: a.activity_type,
        position: a.position,
        starts_at: null,
        ends_at: null,
        duration_min: a.duration_min,
        cost_cents: a.cost_cents,
        currency: a.currency,
        place_id: a.place_id,
        notes: a.notes,
        metadata: a.metadata,
      }));
      await this.supabase.from("trip_activities").insert(rows);
    }
    return created;
  }
}
