/** JSR — deterministic edit operations at the session level.
 * Every edit produces a new revision (immutability + versioning).
 */
import { StudioConflictError, StudioPermissionError } from "./errors";
import { CollaborationEngine } from "./collaboration";
import { SessionEngine } from "./session";
import { WorkspaceEngine } from "./workspace";
import { TimelineEngine } from "./timeline";
import type { Card, PlanningSession, Workspace } from "./types";
import type { StudioPolicies } from "./policies";
import type { StudioConfig } from "./config";
import type { MakeTimelineItemInput } from "./timeline";

export interface EditContext {
  readonly userId?: string;
  readonly expectedRevisionNumber?: number;
  readonly notes?: string;
  readonly config: StudioConfig;
  readonly policies: StudioPolicies;
}

function ensureEditable(s: PlanningSession, ctx: EditContext): void {
  if (s.status === "archived" || s.status === "ended") {
    throw new StudioConflictError(`session ${s.status} is not editable`);
  }
  if (ctx.expectedRevisionNumber !== undefined && SessionEngine.detectConflict(s, ctx.expectedRevisionNumber)) {
    throw new StudioConflictError(`revision conflict: expected ${ctx.expectedRevisionNumber} got ${s.revisionNumber}`);
  }
  if (ctx.policies.lockRequiredForEdit) {
    if (!CollaborationEngine.isLocked(s)) throw new StudioPermissionError("session lock required for edit");
    if (ctx.userId && s.lock && s.lock.userId !== ctx.userId) {
      throw new StudioPermissionError("session locked by another user");
    }
  }
  if (ctx.userId && s.participants.length > 0) {
    CollaborationEngine.assertRole(s, ctx.userId, ["owner", "editor"]);
  }
}

function commit(s: PlanningSession, workspace: Workspace, ctx: EditContext, notes: string): PlanningSession {
  return SessionEngine.createRevision(s, workspace, ctx.notes ?? notes, ctx.userId, ctx.config.maxRevisionsPerSession);
}

export const EditingEngine = {
  insertCard(s: PlanningSession, card: Card, ctx: EditContext, opts?: { addToTimeline?: boolean; label?: string }): PlanningSession {
    ensureEditable(s, ctx);
    const ws = SessionEngine.currentWorkspace(s);
    const next = WorkspaceEngine.insertCard({ workspace: ws, history: { entries: [] } }, card, opts);
    return commit(s, next.workspace, ctx, `insert card ${card.id}`);
  },
  deleteCard(s: PlanningSession, cardId: string, ctx: EditContext): PlanningSession {
    ensureEditable(s, ctx);
    const ws = SessionEngine.currentWorkspace(s);
    const next = WorkspaceEngine.removeCard({ workspace: ws, history: { entries: [] } }, cardId);
    return commit(s, next.workspace, ctx, `delete card ${cardId}`);
  },
  moveCard(s: PlanningSession, cardId: string, toIndex: number, ctx: EditContext): PlanningSession {
    ensureEditable(s, ctx);
    const ws = SessionEngine.currentWorkspace(s);
    const next = WorkspaceEngine.moveCard({ workspace: ws, history: { entries: [] } }, cardId, toIndex);
    return commit(s, next.workspace, ctx, `move card ${cardId}`);
  },
  mergeCards(s: PlanningSession, targetId: string, sourceId: string, ctx: EditContext): PlanningSession {
    ensureEditable(s, ctx);
    const ws = SessionEngine.currentWorkspace(s);
    const next = WorkspaceEngine.mergeCards({ workspace: ws, history: { entries: [] } }, targetId, sourceId);
    return commit(s, next.workspace, ctx, `merge cards ${sourceId}->${targetId}`);
  },
  splitCard(s: PlanningSession, cardId: string, produce: (base: Card) => readonly Card[], ctx: EditContext): PlanningSession {
    ensureEditable(s, ctx);
    const ws = SessionEngine.currentWorkspace(s);
    const next = WorkspaceEngine.splitCard({ workspace: ws, history: { entries: [] } }, cardId, produce);
    return commit(s, next.workspace, ctx, `split card ${cardId}`);
  },
  insertTimelineItem(s: PlanningSession, item: MakeTimelineItemInput, ctx: EditContext): PlanningSession {
    ensureEditable(s, ctx);
    const ws = SessionEngine.currentWorkspace(s);
    const { timeline } = TimelineEngine.insert(ws.timeline, item);
    const next = WorkspaceEngine.applyTimeline({ workspace: ws, history: { entries: [] } }, timeline, "timeline.insert");
    return commit(s, next.workspace, ctx, `timeline insert`);
  },
  reorderTimeline(s: PlanningSession, orderedIds: readonly string[], ctx: EditContext): PlanningSession {
    ensureEditable(s, ctx);
    const ws = SessionEngine.currentWorkspace(s);
    const timeline = TimelineEngine.reorder(ws.timeline, orderedIds);
    const next = WorkspaceEngine.applyTimeline({ workspace: ws, history: { entries: [] } }, timeline, "timeline.reorder");
    return commit(s, next.workspace, ctx, `timeline reorder`);
  },
  rollbackToRevision(s: PlanningSession, revisionId: string, ctx: EditContext): PlanningSession {
    ensureEditable(s, ctx);
    return SessionEngine.restoreRevision(s, revisionId);
  },
  promoteDraft(s: PlanningSession, ctx: EditContext): PlanningSession {
    ensureEditable(s, ctx);
    return SessionEngine.promoteDraft(s, ctx.notes, ctx.config.maxRevisionsPerSession);
  },
};
