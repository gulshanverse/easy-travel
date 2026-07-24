/** JSR — planning session factories and state transitions. */
import {
  newDraftId, newRevisionId, newStudioSessionId, newSnapshotId, newVersionId,
} from "./ids";
import { StudioConflictError, StudioLifecycleError, StudioValidationError, StudioVersioningError } from "./errors";
import { emptyWorkspaceState, makeWorkspace } from "./workspace";
import { validateSession } from "./validation";
import type {
  PlanningCheckpoint, PlanningDraft, PlanningHistory, PlanningHistoryEntry,
  PlanningMetadata, PlanningRevision, PlanningSession, PlanningSessionStatus,
  PlanningSnapshot, PlanningVersion, StudioParticipant, Workspace,
} from "./types";

export interface MakePlanningSessionInput {
  readonly agentId: string;
  readonly title?: string;
  readonly labels?: readonly string[];
  readonly variables?: Readonly<Record<string, unknown>>;
  readonly participants?: readonly StudioParticipant[];
  readonly ttlMs?: number;
  readonly id?: string;
}

function emptyHistory(): PlanningHistory { return Object.freeze({ entries: Object.freeze([]) }); }
function appendHistory(h: PlanningHistory, entry: Omit<PlanningHistoryEntry, "at"> & { at?: number }): PlanningHistory {
  const e: PlanningHistoryEntry = Object.freeze({
    at: entry.at ?? Date.now(),
    kind: entry.kind,
    revisionId: entry.revisionId,
    details: Object.freeze({ ...(entry.details ?? {}) }),
  });
  return Object.freeze({ entries: Object.freeze([...h.entries, e]) });
}

function meta(title: string, labels: readonly string[], variables: Readonly<Record<string, unknown>>): PlanningMetadata {
  const now = Date.now();
  return Object.freeze({
    title, createdAt: now, updatedAt: now,
    labels: Object.freeze([...labels]),
    variables: Object.freeze({ ...variables }),
  });
}

export function makePlanningSession(input: MakePlanningSessionInput): PlanningSession {
  if (!input.agentId) throw new StudioValidationError("session.agentId required");
  const workspace: Workspace = makeWorkspace();
  const rev0: PlanningRevision = Object.freeze({
    id: newRevisionId(), number: 1,
    workspace, createdAt: Date.now(),
    notes: "initial",
  });
  const session: PlanningSession = Object.freeze({
    id: input.id ?? newStudioSessionId(),
    agentId: input.agentId,
    status: "created",
    revisionNumber: 1,
    currentRevisionId: rev0.id,
    draft: undefined,
    revisions: Object.freeze([rev0]),
    versions: Object.freeze([]),
    checkpoints: Object.freeze([]),
    history: appendHistory(emptyHistory(), { kind: "created", revisionId: rev0.id, details: {} }),
    participants: Object.freeze([...(input.participants ?? [])]),
    lock: undefined,
    metadata: meta(input.title ?? "Untitled Journey", input.labels ?? [], input.variables ?? {}),
    expiresAt: input.ttlMs ? Date.now() + input.ttlMs : undefined,
  });
  validateSession(session);
  return session;
}

const VALID_TRANSITIONS: Readonly<Record<PlanningSessionStatus, readonly PlanningSessionStatus[]>> = Object.freeze({
  created: ["active", "ended", "archived"],
  active: ["editing", "reviewing", "paused", "locked", "ended", "archived"],
  editing: ["active", "reviewing", "paused", "locked", "ended", "archived"],
  reviewing: ["active", "editing", "paused", "ended", "archived"],
  paused: ["active", "editing", "ended", "archived"],
  locked: ["active", "editing", "reviewing", "ended", "archived"],
  archived: [],
  ended: ["archived"],
});

export function canTransitionSession(from: PlanningSessionStatus, to: PlanningSessionStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
export function transitionSession(s: PlanningSession, to: PlanningSessionStatus): PlanningSession {
  if (!canTransitionSession(s.status, to)) {
    throw new StudioLifecycleError(`invalid transition: ${s.status} -> ${to}`);
  }
  return Object.freeze({ ...s, status: to,
    history: appendHistory(s.history, { kind: "status", details: { from: s.status, to } }),
  });
}

// ---------- Revisions / versions / checkpoints / drafts ----------
export const SessionEngine = {
  createRevision(s: PlanningSession, workspace: Workspace, notes?: string, createdBy?: string, max?: number): PlanningSession {
    if (max && s.revisions.length >= max) throw new StudioVersioningError("revision limit reached");
    const next: PlanningRevision = Object.freeze({
      id: newRevisionId(),
      number: s.revisionNumber + 1,
      workspace, createdAt: Date.now(), createdBy,
      parentRevisionId: s.currentRevisionId, notes,
    });
    return Object.freeze({
      ...s,
      revisions: Object.freeze([...s.revisions, next]),
      revisionNumber: next.number,
      currentRevisionId: next.id,
      history: appendHistory(s.history, { kind: "revision.created", revisionId: next.id, details: { number: next.number } }),
    });
  },
  restoreRevision(s: PlanningSession, revisionId: string): PlanningSession {
    const rev = s.revisions.find(r => r.id === revisionId);
    if (!rev) throw new StudioVersioningError(`revision not found: ${revisionId}`);
    const restored: PlanningRevision = Object.freeze({
      id: newRevisionId(),
      number: s.revisionNumber + 1,
      workspace: rev.workspace,
      createdAt: Date.now(),
      parentRevisionId: s.currentRevisionId,
      notes: `restored from ${rev.id}`,
    });
    return Object.freeze({
      ...s,
      revisions: Object.freeze([...s.revisions, restored]),
      revisionNumber: restored.number,
      currentRevisionId: restored.id,
      history: appendHistory(s.history, { kind: "revision.restored", revisionId: restored.id, details: { from: revisionId } }),
    });
  },
  promoteVersion(s: PlanningSession, label: string): PlanningSession {
    if (!label) throw new StudioValidationError("version.label required");
    const v: PlanningVersion = Object.freeze({
      id: newVersionId(), label, revisionId: s.currentRevisionId, createdAt: Date.now(),
    });
    return Object.freeze({
      ...s,
      versions: Object.freeze([...s.versions, v]),
      history: appendHistory(s.history, { kind: "version.promoted", details: { label, versionId: v.id } }),
    });
  },
  addCheckpoint(s: PlanningSession, label: string, max?: number): PlanningSession {
    if (!label) throw new StudioValidationError("checkpoint.label required");
    if (max && s.checkpoints.length >= max) throw new StudioVersioningError("checkpoint limit reached");
    const cp: PlanningCheckpoint = Object.freeze({
      id: newRevisionId().replace("rev_", "chk_"),
      label, revisionId: s.currentRevisionId, createdAt: Date.now(),
    });
    return Object.freeze({
      ...s,
      checkpoints: Object.freeze([...s.checkpoints, cp]),
      history: appendHistory(s.history, { kind: "checkpoint.added", details: { label, checkpointId: cp.id } }),
    });
  },
  startDraft(s: PlanningSession, workspace: Workspace, notes?: string): PlanningSession {
    if (s.draft) throw new StudioConflictError("session already has an active draft");
    const draft: PlanningDraft = Object.freeze({ id: newDraftId(), workspace, createdAt: Date.now(), notes });
    return Object.freeze({ ...s, draft,
      history: appendHistory(s.history, { kind: "draft.created", details: { draftId: draft.id } }),
    });
  },
  discardDraft(s: PlanningSession): PlanningSession {
    if (!s.draft) return s;
    return Object.freeze({ ...s, draft: undefined,
      history: appendHistory(s.history, { kind: "draft.discarded", details: { draftId: s.draft.id } }),
    });
  },
  promoteDraft(s: PlanningSession, notes?: string, max?: number): PlanningSession {
    if (!s.draft) throw new StudioVersioningError("no active draft to promote");
    const promoted = SessionEngine.createRevision(s, s.draft.workspace, notes ?? `promoted draft ${s.draft.id}`, undefined, max);
    return Object.freeze({ ...promoted, draft: undefined });
  },
  currentWorkspace(s: PlanningSession): Workspace {
    const rev = s.revisions.find(r => r.id === s.currentRevisionId);
    if (!rev) throw new StudioVersioningError("current revision missing");
    return rev.workspace;
  },
  snapshot(s: PlanningSession): PlanningSnapshot {
    return Object.freeze({
      id: newSnapshotId(),
      capturedAt: Date.now(),
      workspace: SessionEngine.currentWorkspace(s),
    });
  },
  detectConflict(s: PlanningSession, expectedRevisionNumber: number): boolean {
    return s.revisionNumber !== expectedRevisionNumber;
  },
};

export function emptySessionWorkspaceState() { return emptyWorkspaceState(); }
