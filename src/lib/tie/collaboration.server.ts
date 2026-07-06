/**
 * CollaborationService — invite members, assign roles, list collaborators.
 * Uses trip_companions as the join table.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { Collaborator, CollaboratorRole, TIEResult } from "./types";
import { ok, fail } from "./types";
import { emitTIEEvent } from "./events";

type SB = SupabaseClient<Database>;

const ROLE_ORDER: CollaboratorRole[] = ["viewer", "commenter", "editor", "owner"];

export class CollaborationService {
  constructor(private readonly supabase: SB) {}

  async list(tripId: string): Promise<TIEResult<Collaborator[]>> {
    const { data, error } = await this.supabase
      .from("trip_companions")
      .select("trip_id, companion_id, role, added_at")
      .eq("trip_id", tripId);
    if (error) return fail("collab.list_failed", error.message);
    return ok(
      (data ?? []).map((r) => ({
        tripId: r.trip_id,
        userId: r.companion_id,
        role: (r.role as CollaboratorRole) ?? "viewer",
        addedAt: r.added_at,
      })),
    );
  }

  async invite(tripId: string, userId: string, role: CollaboratorRole = "viewer"): Promise<TIEResult<Collaborator>> {
    const { data, error } = await this.supabase
      .from("trip_companions")
      .upsert(
        { trip_id: tripId, companion_id: userId, role },
        { onConflict: "trip_id,companion_id" },
      )
      .select("*")
      .single();
    if (error) return fail("collab.invite_failed", error.message, error);
    emitTIEEvent({ name: "COLLABORATOR_ADDED", tripId, userId, data: { role } });
    return ok({
      tripId: data.trip_id,
      userId: data.companion_id,
      role: (data.role as CollaboratorRole) ?? "viewer",
      addedAt: data.added_at,
    });
  }

  async setRole(tripId: string, userId: string, role: CollaboratorRole): Promise<TIEResult<{ role: CollaboratorRole }>> {
    const { error } = await this.supabase
      .from("trip_companions")
      .update({ role })
      .eq("trip_id", tripId)
      .eq("companion_id", userId);
    if (error) return fail("collab.role_failed", error.message);
    emitTIEEvent({ name: "COLLABORATOR_ROLE_CHANGED", tripId, userId, data: { role } });
    return ok({ role });
  }

  async remove(tripId: string, userId: string): Promise<TIEResult<{ userId: string }>> {
    const { error } = await this.supabase
      .from("trip_companions")
      .delete()
      .eq("trip_id", tripId)
      .eq("companion_id", userId);
    if (error) return fail("collab.remove_failed", error.message);
    emitTIEEvent({ name: "COLLABORATOR_REMOVED", tripId, userId });
    return ok({ userId });
  }

  hasAtLeast(role: CollaboratorRole, required: CollaboratorRole): boolean {
    return ROLE_ORDER.indexOf(role) >= ROLE_ORDER.indexOf(required);
  }
}
