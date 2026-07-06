/**
 * ActivityService — CRUD for trip activities across all activity types.
 * Handles flight / hotel / restaurant / experience / transport / custom.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { ActivityType, TripActivityRow, TIEResult } from "./types";
import { ok, fail } from "./types";
import { emitTIEEvent } from "./events";

type SB = SupabaseClient<Database>;
type ActivityInsert = Database["public"]["Tables"]["trip_activities"]["Insert"];
type ActivityUpdate = Database["public"]["Tables"]["trip_activities"]["Update"];

export interface CreateActivityInput {
  tripId: string;
  tripDayId?: string | null;
  title: string;
  description?: string | null;
  activityType?: ActivityType;
  position?: number;
  startsAt?: string | null;
  endsAt?: string | null;
  durationMin?: number | null;
  costCents?: number | null;
  currency?: string;
  placeId?: string | null;
  bookingItemId?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}

export class ActivityService {
  constructor(private readonly supabase: SB) {}

  async list(tripId: string): Promise<TIEResult<TripActivityRow[]>> {
    const { data, error } = await this.supabase
      .from("trip_activities")
      .select("*")
      .eq("trip_id", tripId)
      .order("position", { ascending: true });
    if (error) return fail("activity.list_failed", error.message);
    return ok(data ?? []);
  }

  async create(input: CreateActivityInput): Promise<TIEResult<TripActivityRow>> {
    const row: ActivityInsert = {
      trip_id: input.tripId,
      trip_day_id: input.tripDayId ?? null,
      title: input.title.trim(),
      description: input.description ?? null,
      activity_type: input.activityType ?? "custom",
      position: input.position ?? (await this.nextPosition(input.tripId, input.tripDayId ?? null)),
      starts_at: input.startsAt ?? null,
      ends_at: input.endsAt ?? null,
      duration_min: input.durationMin ?? null,
      cost_cents: input.costCents ?? null,
      currency: input.currency ?? "USD",
      place_id: input.placeId ?? null,
      booking_item_id: input.bookingItemId ?? null,
      notes: input.notes ?? null,
      metadata: (input.metadata as Database["public"]["Tables"]["trip_activities"]["Insert"]["metadata"]) ?? {},
    };
    const { data, error } = await this.supabase
      .from("trip_activities")
      .insert(row)
      .select("*")
      .single();
    if (error) return fail("activity.create_failed", error.message, error);
    emitTIEEvent({ name: "ACTIVITY_ADDED", tripId: data.trip_id, userId: null, data });
    if (data.booking_item_id) {
      emitTIEEvent({
        name: "BOOKING_LINKED",
        tripId: data.trip_id,
        userId: null,
        data: { activityId: data.id, bookingItemId: data.booking_item_id },
      });
    }
    return ok(data);
  }

  async update(activityId: string, patch: ActivityUpdate): Promise<TIEResult<TripActivityRow>> {
    const { data, error } = await this.supabase
      .from("trip_activities")
      .update(patch)
      .eq("id", activityId)
      .select("*")
      .single();
    if (error) return fail("activity.update_failed", error.message, error);
    emitTIEEvent({ name: "ACTIVITY_UPDATED", tripId: data.trip_id, userId: null, data });
    return ok(data);
  }

  async remove(activityId: string): Promise<TIEResult<{ id: string; tripId: string | null }>> {
    const { data: existing } = await this.supabase
      .from("trip_activities")
      .select("trip_id")
      .eq("id", activityId)
      .maybeSingle();
    const { error } = await this.supabase.from("trip_activities").delete().eq("id", activityId);
    if (error) return fail("activity.remove_failed", error.message, error);
    const tripId = existing?.trip_id ?? null;
    emitTIEEvent({ name: "ACTIVITY_REMOVED", tripId, userId: null, data: { activityId } });
    return ok({ id: activityId, tripId });
  }

  async linkBooking(activityId: string, bookingItemId: string): Promise<TIEResult<TripActivityRow>> {
    const res = await this.update(activityId, { booking_item_id: bookingItemId });
    if (res.ok) {
      emitTIEEvent({
        name: "BOOKING_LINKED",
        tripId: res.data.trip_id,
        userId: null,
        data: { activityId, bookingItemId },
      });
    }
    return res;
  }

  private async nextPosition(tripId: string, dayId: string | null): Promise<number> {
    const q = this.supabase.from("trip_activities").select("position").eq("trip_id", tripId);
    const { data } = dayId
      ? await q.eq("trip_day_id", dayId).order("position", { ascending: false }).limit(1)
      : await q.is("trip_day_id", null).order("position", { ascending: false }).limit(1);
    return (data?.[0]?.position ?? 0) + 1;
  }
}
