/**
 * VersionService — immutable itinerary snapshots, rollback, diff.
 * Every AI generation or significant mutation should call `snapshot()`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { JourneyDiff, JourneyVersion, TIEResult } from "./types";
import { ok, fail } from "./types";
import { emitTIEEvent } from "./events";

type SB = SupabaseClient<Database>;

interface SnapshotBody {
  trip: unknown;
  days: unknown[];
  activities: unknown[];
}

export class VersionService {
  constructor(private readonly supabase: SB) {}

  async snapshot(tripId: string, source: string, actorId?: string | null, aiConversationId?: string | null): Promise<TIEResult<JourneyVersion>> {
    const [trip, days, acts, last] = await Promise.all([
      this.supabase.from("trips").select("*").eq("id", tripId).maybeSingle(),
      this.supabase.from("trip_days").select("*").eq("trip_id", tripId),
      this.supabase.from("trip_activities").select("*").eq("trip_id", tripId),
      this.supabase.from("itineraries").select("version").eq("trip_id", tripId).order("version", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (trip.error || !trip.data) return fail("version.trip_missing", trip.error?.message ?? "Trip not found");

    const body: SnapshotBody = {
      trip: trip.data,
      days: days.data ?? [],
      activities: acts.data ?? [],
    };
    const version = (last.data?.version ?? 0) + 1;

    // De-activate previous active snapshot, insert new active one.
    await this.supabase.from("itineraries").update({ is_active: false }).eq("trip_id", tripId).eq("is_active", true);
    const { data, error } = await this.supabase
      .from("itineraries")
      .insert({
        trip_id: tripId,
        version,
        source,
        is_active: true,
        created_by: actorId ?? null,
        ai_conversation_id: aiConversationId ?? null,
        snapshot: body as unknown as Database["public"]["Tables"]["itineraries"]["Insert"]["snapshot"],
      })
      .select("*")
      .single();
    if (error) return fail("version.snapshot_failed", error.message, error);
    const v: JourneyVersion = {
      id: data.id,
      tripId: data.trip_id,
      version: data.version,
      source: data.source,
      isActive: data.is_active,
      createdAt: data.created_at,
      createdBy: data.created_by,
    };
    emitTIEEvent({ name: "VERSION_CREATED", tripId, userId: actorId ?? null, data: v });
    return ok(v);
  }

  async list(tripId: string): Promise<TIEResult<JourneyVersion[]>> {
    const { data, error } = await this.supabase
      .from("itineraries")
      .select("id, trip_id, version, source, is_active, created_at, created_by")
      .eq("trip_id", tripId)
      .order("version", { ascending: false });
    if (error) return fail("version.list_failed", error.message);
    return ok(
      (data ?? []).map((r) => ({
        id: r.id,
        tripId: r.trip_id,
        version: r.version,
        source: r.source,
        isActive: r.is_active,
        createdAt: r.created_at,
        createdBy: r.created_by,
      })),
    );
  }

  async diff(tripId: string, from: number, to: number): Promise<TIEResult<JourneyDiff>> {
    const { data, error } = await this.supabase
      .from("itineraries")
      .select("version, snapshot")
      .eq("trip_id", tripId)
      .in("version", [from, to]);
    if (error || !data || data.length !== 2) return fail("version.diff_failed", error?.message ?? "Versions not found");
    const a = data.find((r) => r.version === from)!.snapshot as unknown as SnapshotBody;
    const b = data.find((r) => r.version === to)!.snapshot as unknown as SnapshotBody;
    const aAct = new Map((a.activities as { id: string }[]).map((x) => [x.id, x]));
    const bAct = new Map((b.activities as { id: string }[]).map((x) => [x.id, x]));
    const added: string[] = [];
    const removed: string[] = [];
    const changed: string[] = [];
    for (const [id, v] of bAct) {
      if (!aAct.has(id)) added.push(id);
      else if (JSON.stringify(v) !== JSON.stringify(aAct.get(id))) changed.push(id);
    }
    for (const id of aAct.keys()) if (!bAct.has(id)) removed.push(id);
    const aDays = new Set((a.days as { day_index: number }[]).map((d) => d.day_index));
    const bDays = new Set((b.days as { day_index: number }[]).map((d) => d.day_index));
    const addedDays = [...bDays].filter((d) => !aDays.has(d));
    const removedDays = [...aDays].filter((d) => !bDays.has(d));
    return ok({ from, to, addedActivities: added, removedActivities: removed, changedActivities: changed, addedDays, removedDays });
  }

  async rollback(tripId: string, version: number, actorId?: string | null): Promise<TIEResult<{ appliedVersion: number }>> {
    const { data, error } = await this.supabase
      .from("itineraries")
      .select("snapshot, version")
      .eq("trip_id", tripId)
      .eq("version", version)
      .maybeSingle();
    if (error || !data) return fail("version.rollback_missing", error?.message ?? "Version not found");
    const body = data.snapshot as unknown as SnapshotBody;

    // Simple restore: replace trip_days + trip_activities with snapshot content.
    // Trip row (title, dates, budget) is left as-is; caller can decide.
    await this.supabase.from("trip_activities").delete().eq("trip_id", tripId);
    await this.supabase.from("trip_days").delete().eq("trip_id", tripId);
    if ((body.days as unknown[]).length) {
      await this.supabase.from("trip_days").insert(body.days as Database["public"]["Tables"]["trip_days"]["Insert"][]);
    }
    if ((body.activities as unknown[]).length) {
      await this.supabase.from("trip_activities").insert(body.activities as Database["public"]["Tables"]["trip_activities"]["Insert"][]);
    }

    await this.snapshot(tripId, `rollback:v${version}`, actorId ?? null);
    emitTIEEvent({ name: "VERSION_ROLLED_BACK", tripId, userId: actorId ?? null, data: { version } });
    return ok({ appliedVersion: version });
  }
}
