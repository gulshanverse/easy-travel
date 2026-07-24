/** JSR — Workspace factories and deterministic edits. */
import { newWorkspaceId } from "./ids";
import { StudioConflictError, StudioEditingError, StudioValidationError } from "./errors";
import { TimelineEngine, makeEmptyTimeline } from "./timeline";
import { validateWorkspace } from "./validation";
import type {
  Card, Workspace, WorkspaceContext, WorkspaceHistory,
  WorkspaceHistoryEntry, WorkspaceLayout, WorkspaceSelection,
  WorkspaceState, WorkspaceStatus,
} from "./types";

export interface MakeWorkspaceInput {
  readonly context?: Partial<WorkspaceContext>;
  readonly layout?: Partial<WorkspaceLayout>;
  readonly labels?: readonly string[];
  readonly id?: string;
}

export function makeWorkspace(input: MakeWorkspaceInput = {}): Workspace {
  const now = Date.now();
  const w: Workspace = Object.freeze({
    id: input.id ?? newWorkspaceId(),
    status: "empty",
    cards: Object.freeze([]),
    timeline: makeEmptyTimeline(),
    selection: Object.freeze({
      selectedCardIds: Object.freeze([]),
      selectedItemIds: Object.freeze([]),
      focusCardId: undefined,
    }) as WorkspaceSelection,
    layout: Object.freeze({
      mode: input.layout?.mode ?? "board",
      columns: input.layout?.columns ?? 3,
    }) as WorkspaceLayout,
    context: Object.freeze({
      userId: input.context?.userId,
      locale: input.context?.locale,
      timezone: input.context?.timezone,
      variables: Object.freeze({ ...(input.context?.variables ?? {}) }),
    }) as WorkspaceContext,
    metadata: Object.freeze({
      createdAt: now, updatedAt: now,
      labels: Object.freeze([...(input.labels ?? [])]),
    }),
  });
  return w;
}

export function emptyWorkspaceHistory(): WorkspaceHistory {
  return Object.freeze({ entries: Object.freeze([]) });
}

function touch(w: Workspace, patch: Partial<Workspace>, cards?: readonly Card[]): Workspace {
  const nextCards = cards ?? patch.cards ?? w.cards;
  const status: WorkspaceStatus = (patch.status ?? (nextCards.length === 0 ? "empty" : "populated")) as WorkspaceStatus;
  return Object.freeze({
    ...w, ...patch,
    cards: nextCards,
    status,
    metadata: Object.freeze({ ...w.metadata, updatedAt: Date.now() }),
  }) as Workspace;
}

function record(h: WorkspaceHistory, action: string, details: Record<string, unknown> = {}): WorkspaceHistory {
  const entry: WorkspaceHistoryEntry = Object.freeze({ at: Date.now(), action, details: Object.freeze({ ...details }) });
  return Object.freeze({ entries: Object.freeze([...h.entries, entry]) });
}

export const WorkspaceEngine = {
  insertCard(state: WorkspaceState, card: Card, opts?: { addToTimeline?: boolean; label?: string }): WorkspaceState {
    if (state.workspace.cards.some(c => c.id === card.id)) {
      throw new StudioConflictError(`card already exists: ${card.id}`);
    }
    const cards = Object.freeze([...state.workspace.cards, card]);
    let ws = touch(state.workspace, {}, cards);
    if (opts?.addToTimeline) {
      const { timeline } = TimelineEngine.insert(ws.timeline, { cardId: card.id, label: opts.label ?? card.title });
      ws = touch(ws, { timeline }, cards);
    }
    validateWorkspace(ws);
    return { workspace: ws, history: record(state.history, "insertCard", { cardId: card.id }) };
  },
  removeCard(state: WorkspaceState, cardId: string): WorkspaceState {
    if (!state.workspace.cards.some(c => c.id === cardId)) {
      throw new StudioEditingError(`card not found: ${cardId}`);
    }
    const cards = Object.freeze(state.workspace.cards.filter(c => c.id !== cardId));
    let timeline = state.workspace.timeline;
    for (const it of state.workspace.timeline.items.filter(i => i.cardId === cardId)) {
      timeline = TimelineEngine.delete(timeline, it.id);
    }
    const ws = touch(state.workspace, { timeline }, cards);
    return { workspace: ws, history: record(state.history, "removeCard", { cardId }) };
  },
  moveCard(state: WorkspaceState, cardId: string, toIndex: number): WorkspaceState {
    const idx = state.workspace.cards.findIndex(c => c.id === cardId);
    if (idx < 0) throw new StudioEditingError(`card not found: ${cardId}`);
    const arr = [...state.workspace.cards];
    const [c] = arr.splice(idx, 1);
    arr.splice(Math.max(0, Math.min(toIndex, arr.length)), 0, c);
    const ws = touch(state.workspace, {}, Object.freeze(arr));
    return { workspace: ws, history: record(state.history, "moveCard", { cardId, toIndex }) };
  },
  mergeCards(state: WorkspaceState, targetId: string, sourceId: string): WorkspaceState {
    if (targetId === sourceId) throw new StudioEditingError("cannot merge card into itself");
    const t = state.workspace.cards.find(c => c.id === targetId);
    const s = state.workspace.cards.find(c => c.id === sourceId);
    if (!t || !s) throw new StudioEditingError("merge requires both target and source cards");
    const mergedTags = Array.from(new Set([...t.tags, ...s.tags]));
    const merged: Card = Object.freeze({
      ...t,
      tags: Object.freeze(mergedTags),
      data: Object.freeze({ ...s.data, ...t.data, merged: [t.id, s.id] }),
    });
    const cards = Object.freeze(state.workspace.cards
      .filter(c => c.id !== sourceId)
      .map(c => (c.id === targetId ? merged : c)));
    let timeline = state.workspace.timeline;
    for (const it of state.workspace.timeline.items.filter(i => i.cardId === sourceId)) {
      timeline = TimelineEngine.delete(timeline, it.id);
    }
    const ws = touch(state.workspace, { timeline }, cards);
    return { workspace: ws, history: record(state.history, "mergeCards", { targetId, sourceId }) };
  },
  splitCard(state: WorkspaceState, cardId: string, produce: (base: Card) => readonly Card[]): WorkspaceState {
    const base = state.workspace.cards.find(c => c.id === cardId);
    if (!base) throw new StudioEditingError(`card not found: ${cardId}`);
    const parts = produce(base);
    if (parts.length < 2) throw new StudioEditingError("splitCard must produce at least 2 cards");
    const ids = new Set(parts.map(p => p.id));
    if (ids.size !== parts.length) throw new StudioValidationError("split parts must have unique ids");
    const cards = Object.freeze([
      ...state.workspace.cards.filter(c => c.id !== cardId),
      ...parts,
    ]);
    const ws = touch(state.workspace, {}, cards);
    return { workspace: ws, history: record(state.history, "splitCard", { cardId, into: parts.map(p => p.id) }) };
  },
  select(state: WorkspaceState, selection: Partial<WorkspaceSelection>): WorkspaceState {
    const sel: WorkspaceSelection = Object.freeze({
      selectedCardIds: Object.freeze([...(selection.selectedCardIds ?? state.workspace.selection.selectedCardIds)]),
      selectedItemIds: Object.freeze([...(selection.selectedItemIds ?? state.workspace.selection.selectedItemIds)]),
      focusCardId: selection.focusCardId ?? state.workspace.selection.focusCardId,
    });
    const ws = touch(state.workspace, { selection: sel });
    return { workspace: ws, history: record(state.history, "select", {}) };
  },
  setStatus(state: WorkspaceState, status: WorkspaceStatus): WorkspaceState {
    const ws = touch(state.workspace, { status });
    return { workspace: ws, history: record(state.history, "setStatus", { status }) };
  },
  applyTimeline(state: WorkspaceState, timeline: Workspace["timeline"], action = "timeline"): WorkspaceState {
    const ws = touch(state.workspace, { timeline });
    return { workspace: ws, history: record(state.history, action, { version: timeline.version }) };
  },
};

export function emptyWorkspaceState(input: MakeWorkspaceInput = {}): WorkspaceState {
  return { workspace: makeWorkspace(input), history: emptyWorkspaceHistory() };
}
