/**
 * Journey Timeline Engine.
 * Deterministic timeline assembly, dependency resolution, and conflict
 * detection. No wall-clock reads except at boundaries.
 */

import { JourneyTimelineError } from "./errors";
import { createMilestone, createTimeline } from "./factories";
import type { Timeline, TimelineMilestone, TravelWindow } from "./types";

export interface TimelineConflict {
  readonly kind: "overlap" | "missing-dep" | "buffer" | "out-of-window";
  readonly ids: readonly string[];
  readonly message: string;
}

export interface TimelineBuildInput {
  readonly window: TravelWindow;
  readonly milestones: readonly TimelineMilestone[];
  readonly deadlines?: readonly TimelineMilestone[];
}

export class TimelineEngine {
  build(input: TimelineBuildInput): Timeline {
    if (input.window.earliestStart > input.window.latestEnd)
      throw new JourneyTimelineError("window earliestStart > latestEnd");
    // sort ascending
    const ordered = [...input.milestones].sort((a, b) => a.at.localeCompare(b.at));
    const deadlines = [...(input.deadlines ?? [])].sort((a, b) => a.at.localeCompare(b.at));
    return createTimeline({ window: input.window, milestones: ordered, deadlines });
  }

  addMilestone(
    timeline: Timeline,
    m: Omit<TimelineMilestone, "id">,
  ): Timeline {
    const mile = createMilestone(m);
    return this.build({
      window: timeline.window,
      milestones: [...timeline.milestones, mile],
      deadlines: timeline.deadlines,
    });
  }

  conflicts(timeline: Timeline): readonly TimelineConflict[] {
    const conflicts: TimelineConflict[] = [];
    const ids = new Set(timeline.milestones.map((m) => m.id));
    for (const m of timeline.milestones) {
      if (m.at < timeline.window.earliestStart || m.at > timeline.window.latestEnd) {
        conflicts.push({
          kind: "out-of-window",
          ids: [m.id],
          message: `${m.label} outside travel window`,
        });
      }
      for (const dep of m.dependsOn ?? []) {
        if (!ids.has(dep))
          conflicts.push({ kind: "missing-dep", ids: [m.id], message: `missing dependency ${dep}` });
      }
    }
    // overlap detection: two milestones with identical `at` and same phase
    for (let i = 1; i < timeline.milestones.length; i++) {
      const a = timeline.milestones[i - 1];
      const b = timeline.milestones[i];
      if (a.at === b.at && a.phase === b.phase) {
        conflicts.push({ kind: "overlap", ids: [a.id, b.id], message: `${a.label} overlaps ${b.label}` });
      }
    }
    // buffer violation: dependent starts before predecessor.at + bufferMin
    const byId = new Map(timeline.milestones.map((m) => [m.id, m]));
    for (const m of timeline.milestones) {
      for (const dep of m.dependsOn ?? []) {
        const pred = byId.get(dep);
        if (!pred) continue;
        const minStart = new Date(pred.at).getTime() + (pred.bufferMin ?? 0) * 60_000;
        if (new Date(m.at).getTime() < minStart) {
          conflicts.push({
            kind: "buffer",
            ids: [m.id, dep],
            message: `${m.label} starts before buffer of ${pred.label}`,
          });
        }
      }
    }
    return conflicts;
  }

  duration(timeline: Timeline): number {
    return new Date(timeline.window.latestEnd).getTime() - new Date(timeline.window.earliestStart).getTime();
  }

  isWithinWindow(iso: string, window: TravelWindow): boolean {
    return iso >= window.earliestStart && iso <= window.latestEnd;
  }
}
