/**
 * TimelineService — assembles the visual timeline for a trip.
 * Also detects overlaps, gaps and ordering issues.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type {
  Timeline,
  TimelineConflict,
  TimelineDay,
  TimelineEvent,
  TripActivityRow,
  TripDayRow,
  TIEResult,
} from "./types";
import { ok, fail } from "./types";
import { emitTIEEvent } from "./events";

type SB = SupabaseClient<Database>;

export class TimelineService {
  constructor(private readonly supabase: SB) {}

  async build(tripId: string): Promise<TIEResult<Timeline>> {
    const [tripRes, daysRes, actsRes] = await Promise.all([
      this.supabase.from("trips").select("currency").eq("id", tripId).maybeSingle(),
      this.supabase
        .from("trip_days")
        .select("*")
        .eq("trip_id", tripId)
        .order("day_index", { ascending: true }),
      this.supabase
        .from("trip_activities")
        .select("*")
        .eq("trip_id", tripId)
        .order("position", { ascending: true }),
    ]);
    if (tripRes.error) return fail("timeline.trip_read_failed", tripRes.error.message);
    if (!tripRes.data) return fail("timeline.trip_not_found", "Trip not found");
    if (daysRes.error) return fail("timeline.days_failed", daysRes.error.message);
    if (actsRes.error) return fail("timeline.activities_failed", actsRes.error.message);

    const currency = tripRes.data.currency ?? "USD";
    const days: TripDayRow[] = daysRes.data ?? [];
    const acts: TripActivityRow[] = actsRes.data ?? [];

    const byDay = new Map<string, TripActivityRow[]>();
    const unscheduled: TripActivityRow[] = [];
    for (const a of acts) {
      if (a.trip_day_id) {
        const list = byDay.get(a.trip_day_id) ?? [];
        list.push(a);
        byDay.set(a.trip_day_id, list);
      } else {
        unscheduled.push(a);
      }
    }

    const timelineDays: TimelineDay[] = days.map((d) => {
      const events = (byDay.get(d.id) ?? []).map((a) => toEvent(a, d));
      const conflicts = detectConflicts(events);
      const totalCostCents = events.reduce((s, e) => s + (e.costCents ?? 0), 0);
      const totalDurationMin = events.reduce((s, e) => s + (e.durationMin ?? 0), 0);
      return {
        id: d.id,
        dayIndex: d.day_index,
        date: d.date,
        title: d.title,
        summary: d.summary,
        cityId: d.city_id,
        events,
        totalCostCents,
        totalDurationMin,
        conflicts,
      };
    });

    const totals = {
      cents: timelineDays.reduce((s, d) => s + d.totalCostCents, 0),
      durationMin: timelineDays.reduce((s, d) => s + d.totalDurationMin, 0),
      eventCount: acts.length,
    };
    return ok({
      tripId,
      currency,
      days: timelineDays,
      unscheduled: unscheduled.map((a) => toEvent(a, null)),
      totals,
    });
  }

  /** Move an activity to a different day and/or position. */
  async moveActivity(
    activityId: string,
    to: { dayId: string | null; position: number },
  ): Promise<TIEResult<TripActivityRow>> {
    const { data, error } = await this.supabase
      .from("trip_activities")
      .update({ trip_day_id: to.dayId, position: to.position })
      .eq("id", activityId)
      .select("*")
      .single();
    if (error) return fail("timeline.move_failed", error.message, error);
    emitTIEEvent({
      name: "ACTIVITY_MOVED",
      tripId: data.trip_id,
      userId: null,
      data: { activityId, to },
    });
    emitTIEEvent({
      name: "TIMELINE_UPDATED",
      tripId: data.trip_id,
      userId: null,
      data: { reason: "activity-moved" },
    });
    return ok(data);
  }

  /** Recompute contiguous positions inside a day (1..n). */
  async reorderDay(
    tripDayId: string,
    orderedActivityIds: string[],
  ): Promise<TIEResult<{ updated: number }>> {
    let updated = 0;
    for (let i = 0; i < orderedActivityIds.length; i++) {
      const { error } = await this.supabase
        .from("trip_activities")
        .update({ position: i + 1, trip_day_id: tripDayId })
        .eq("id", orderedActivityIds[i]);
      if (!error) updated++;
    }
    emitTIEEvent({
      name: "TIMELINE_UPDATED",
      tripId: null,
      userId: null,
      data: { reason: "day-reordered", tripDayId, updated },
    });
    return ok({ updated });
  }
}

function toEvent(a: TripActivityRow, d: TripDayRow | null): TimelineEvent {
  return {
    id: a.id,
    tripId: a.trip_id,
    dayId: a.trip_day_id,
    dayIndex: d?.day_index ?? -1,
    position: a.position,
    startsAt: a.starts_at,
    endsAt: a.ends_at,
    durationMin: a.duration_min,
    type: a.activity_type,
    title: a.title,
    costCents: a.cost_cents,
    currency: a.currency,
    placeId: a.place_id,
    bookingItemId: a.booking_item_id,
    metadata: (a.metadata as Record<string, unknown>) ?? {},
  };
}

function detectConflicts(events: TimelineEvent[]): TimelineConflict[] {
  const conflicts: TimelineConflict[] = [];
  const timed = events
    .filter((e) => e.startsAt && e.endsAt)
    .sort((a, b) => (a.startsAt! < b.startsAt! ? -1 : 1));
  for (let i = 0; i < timed.length - 1; i++) {
    const cur = timed[i];
    const nxt = timed[i + 1];
    if (cur.endsAt! > nxt.startsAt!) {
      conflicts.push({
        kind: "overlap",
        message: `"${cur.title}" overlaps "${nxt.title}"`,
        eventIds: [cur.id, nxt.id],
      });
    }
  }
  const untimed = events.filter((e) => !e.startsAt);
  if (untimed.length && timed.length) {
    conflicts.push({
      kind: "missing-time",
      message: `${untimed.length} activity(s) have no start time`,
      eventIds: untimed.map((e) => e.id),
    });
  }
  return conflicts;
}
