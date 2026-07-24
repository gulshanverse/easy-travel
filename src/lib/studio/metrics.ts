/** JSR — metrics. */
export interface StudioMetricsSnapshot {
  readonly sessions: { created: number; ended: number; archived: number; expired: number };
  readonly workspaces: { created: number; updated: number };
  readonly cards: { added: number; removed: number; merged: number; split: number };
  readonly timeline: { updates: number; checkpoints: number; restored: number };
  readonly revisions: { created: number; restored: number };
  readonly drafts: { created: number; promoted: number; discarded: number };
  readonly presentations: { applied: number; failed: number };
  readonly conflicts: { detected: number };
}

export class StudioMetrics {
  private s = { created: 0, ended: 0, archived: 0, expired: 0 };
  private w = { created: 0, updated: 0 };
  private c = { added: 0, removed: 0, merged: 0, split: 0 };
  private tl = { updates: 0, checkpoints: 0, restored: 0 };
  private r = { created: 0, restored: 0 };
  private d = { created: 0, promoted: 0, discarded: 0 };
  private p = { applied: 0, failed: 0 };
  private cf = { detected: 0 };

  sessionCreated() { this.s.created++; }
  sessionEnded() { this.s.ended++; }
  sessionArchived() { this.s.archived++; }
  sessionExpired() { this.s.expired++; }
  workspaceCreated() { this.w.created++; }
  workspaceUpdated() { this.w.updated++; }
  cardAdded() { this.c.added++; }
  cardRemoved() { this.c.removed++; }
  cardsMerged() { this.c.merged++; }
  cardSplit() { this.c.split++; }
  timelineUpdated() { this.tl.updates++; }
  timelineCheckpoint() { this.tl.checkpoints++; }
  timelineRestored() { this.tl.restored++; }
  revisionCreated() { this.r.created++; }
  revisionRestored() { this.r.restored++; }
  draftCreated() { this.d.created++; }
  draftPromoted() { this.d.promoted++; }
  draftDiscarded() { this.d.discarded++; }
  presentationApplied() { this.p.applied++; }
  presentationFailed() { this.p.failed++; }
  conflictDetected() { this.cf.detected++; }

  snapshot(): StudioMetricsSnapshot {
    return Object.freeze({
      sessions: { ...this.s }, workspaces: { ...this.w },
      cards: { ...this.c }, timeline: { ...this.tl },
      revisions: { ...this.r }, drafts: { ...this.d },
      presentations: { ...this.p }, conflicts: { ...this.cf },
    });
  }
}
