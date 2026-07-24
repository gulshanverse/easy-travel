/** JSR — validation helpers. */
import { StudioValidationError } from "./errors";
import type { Card, PlanningSession, Timeline, Workspace } from "./types";

export function assertNonEmpty(s: string | undefined, field: string): string {
  if (typeof s !== "string" || s.trim().length === 0) {
    throw new StudioValidationError(`${field} must be a non-empty string`);
  }
  return s;
}
export function assertSemver(v: string, field = "version"): void {
  if (!/^\d+\.\d+\.\d+$/.test(v)) throw new StudioValidationError(`${field} must be semver x.y.z`);
}
export function assertUniqueIds(ids: readonly string[], field: string): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) throw new StudioValidationError(`${field} contains duplicate id: ${id}`);
    seen.add(id);
  }
}
export function validateCard(c: Card): void {
  assertNonEmpty(c.id, "card.id");
  assertNonEmpty(c.title, "card.title");
}
export function validateTimeline(t: Timeline): void {
  assertUniqueIds(t.items.map(i => i.id), "timeline.items");
  const orders = new Set<number>();
  for (const i of t.items) {
    if (!Number.isFinite(i.order)) throw new StudioValidationError("timeline.item.order must be finite");
    if (orders.has(i.order)) throw new StudioValidationError(`timeline.items contains duplicate order: ${i.order}`);
    orders.add(i.order);
    if (i.startAt !== undefined && i.endAt !== undefined && i.endAt < i.startAt) {
      throw new StudioValidationError(`timeline.item ${i.id} endAt < startAt`);
    }
  }
}
export function validateWorkspace(w: Workspace): void {
  assertUniqueIds(w.cards.map(c => c.id), "workspace.cards");
  for (const c of w.cards) validateCard(c);
  validateTimeline(w.timeline);
}
export function validateSession(s: PlanningSession): void {
  assertNonEmpty(s.id, "session.id");
  assertNonEmpty(s.agentId, "session.agentId");
  assertUniqueIds(s.revisions.map(r => r.id), "session.revisions");
  assertUniqueIds(s.participants.map(p => p.id), "session.participants");
  const owners = s.participants.filter(p => p.role === "owner").length;
  if (s.participants.length > 0 && owners < 1) {
    throw new StudioValidationError("session must have at least one owner when participants exist");
  }
}
