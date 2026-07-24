/** JSR — Timeline factories and deterministic operations. */
import {
  newTimelineCheckpointId as _unused,
} from "./ids";
import {
  newTimelineEventId, newTimelineGroupId, newTimelineId,
  newTimelineItemId, newTimelineSectionId, newCheckpointId,
} from "./ids";
import { StudioEditingError, StudioValidationError } from "./errors";
import { validateTimeline } from "./validation";
import type {
  Timeline, TimelineCheckpoint, TimelineEvent, TimelineGroup,
  TimelineItem, TimelineSection,
} from "./types";

void _unused;

export function makeEmptyTimeline(): Timeline {
  const t: Timeline = Object.freeze({
    id: newTimelineId(),
    version: 1,
    items: Object.freeze([]),
    sections: Object.freeze([]),
    events: Object.freeze([]),
    checkpoints: Object.freeze([]),
  });
  return t;
}

export interface MakeTimelineItemInput {
  readonly cardId?: string;
  readonly label: string;
  readonly startAt?: number;
  readonly endAt?: number;
  readonly order?: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly id?: string;
}

export function makeTimelineItem(input: MakeTimelineItemInput, defaultOrder: number): TimelineItem {
  return Object.freeze({
    id: input.id ?? newTimelineItemId(),
    cardId: input.cardId,
    label: input.label,
    startAt: input.startAt,
    endAt: input.endAt,
    order: input.order ?? defaultOrder,
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
  });
}

export function makeTimelineGroup(label: string, itemIds: readonly string[]): TimelineGroup {
  return Object.freeze({
    id: newTimelineGroupId(),
    label,
    itemIds: Object.freeze([...itemIds]),
  });
}

export function makeTimelineSection(
  label: string, groups: readonly TimelineGroup[],
  startAt?: number, endAt?: number,
): TimelineSection {
  return Object.freeze({
    id: newTimelineSectionId(),
    label, startAt, endAt,
    groups: Object.freeze([...groups]),
  });
}

function nextOrder(t: Timeline): number {
  if (t.items.length === 0) return 0;
  return Math.max(...t.items.map(i => i.order)) + 1;
}

function withEvent(t: Timeline, e: TimelineEvent): Timeline {
  return Object.freeze({
    ...t,
    version: t.version + 1,
    events: Object.freeze([...t.events, e]),
  });
}

function mkEvent(kind: TimelineEvent["kind"], refItemIds: readonly string[], meta: Record<string, unknown> = {}): TimelineEvent {
  return Object.freeze({
    id: newTimelineEventId(),
    kind, at: Date.now(),
    refItemIds: Object.freeze([...refItemIds]),
    metadata: Object.freeze({ ...meta }),
  });
}

export const TimelineEngine = {
  insert(t: Timeline, item: MakeTimelineItemInput): { timeline: Timeline; item: TimelineItem } {
    const it = makeTimelineItem(item, nextOrder(t));
    const items = Object.freeze([...t.items, it]);
    const next: Timeline = Object.freeze({ ...t, items });
    const withE = withEvent(next, mkEvent("insert", [it.id]));
    validateTimeline(withE);
    return { timeline: withE, item: it };
  },
  delete(t: Timeline, itemId: string): Timeline {
    if (!t.items.find(i => i.id === itemId)) {
      throw new StudioEditingError(`timeline item not found: ${itemId}`);
    }
    const items = Object.freeze(t.items.filter(i => i.id !== itemId));
    const next: Timeline = Object.freeze({ ...t, items });
    return withEvent(next, mkEvent("delete", [itemId]));
  },
  move(t: Timeline, itemId: string, toOrder: number): Timeline {
    const idx = t.items.findIndex(i => i.id === itemId);
    if (idx < 0) throw new StudioEditingError(`timeline item not found: ${itemId}`);
    const other = t.items.filter(i => i.id !== itemId).sort((a, b) => a.order - b.order);
    const clamp = Math.max(0, Math.min(toOrder, other.length));
    const moved = { ...t.items[idx], order: clamp };
    const reflowed: TimelineItem[] = [];
    let cursor = 0;
    for (let i = 0; i <= other.length; i++) {
      if (i === clamp) reflowed.push(Object.freeze({ ...moved, order: cursor++ }));
      if (i < other.length) reflowed.push(Object.freeze({ ...other[i], order: cursor++ }));
    }
    const next: Timeline = Object.freeze({ ...t, items: Object.freeze(reflowed) });
    return withEvent(next, mkEvent("move", [itemId], { toOrder: clamp }));
  },
  reorder(t: Timeline, orderedIds: readonly string[]): Timeline {
    if (orderedIds.length !== t.items.length) {
      throw new StudioEditingError("reorder must include every item id exactly once");
    }
    const map = new Map(t.items.map(i => [i.id, i]));
    const reflowed: TimelineItem[] = [];
    orderedIds.forEach((id, idx) => {
      const it = map.get(id);
      if (!it) throw new StudioEditingError(`unknown item id in reorder: ${id}`);
      reflowed.push(Object.freeze({ ...it, order: idx }));
    });
    if (reflowed.length !== map.size) throw new StudioEditingError("reorder ids must be unique");
    const next: Timeline = Object.freeze({ ...t, items: Object.freeze(reflowed) });
    return withEvent(next, mkEvent("reorder", orderedIds));
  },
  checkpoint(t: Timeline, label: string): { timeline: Timeline; checkpoint: TimelineCheckpoint } {
    if (!label || label.trim().length === 0) throw new StudioValidationError("checkpoint.label required");
    const cp: TimelineCheckpoint = Object.freeze({
      id: newCheckpointId(),
      label, at: Date.now(),
      itemIdsSnapshot: Object.freeze([...t.items].sort((a, b) => a.order - b.order).map(i => i.id)),
    });
    const next: Timeline = Object.freeze({ ...t, checkpoints: Object.freeze([...t.checkpoints, cp]) });
    return { timeline: withEvent(next, mkEvent("checkpoint", cp.itemIdsSnapshot, { checkpointId: cp.id })), checkpoint: cp };
  },
  restoreCheckpoint(t: Timeline, checkpointId: string): Timeline {
    const cp = t.checkpoints.find(c => c.id === checkpointId);
    if (!cp) throw new StudioEditingError(`checkpoint not found: ${checkpointId}`);
    const byId = new Map(t.items.map(i => [i.id, i]));
    const items = cp.itemIdsSnapshot
      .map((id, idx) => {
        const it = byId.get(id);
        return it ? Object.freeze({ ...it, order: idx }) : undefined;
      })
      .filter((v): v is TimelineItem => v !== undefined);
    const next: Timeline = Object.freeze({ ...t, items: Object.freeze(items) });
    return withEvent(next, mkEvent("checkpoint", cp.itemIdsSnapshot, { restoredFrom: checkpointId }));
  },
};
