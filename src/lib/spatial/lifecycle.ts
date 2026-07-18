/** Spatial Intelligence Engine — lifecycle state machine + history. */
import { SpatialLifecycleError } from "./errors";
import type { LifecycleState, SpatialHistoryEntry } from "./types";

const TRANSITIONS: Readonly<Record<LifecycleState, readonly LifecycleState[]>> = Object.freeze({
  created: ["validated", "failed", "archived"],
  validated: ["enriched", "clustered", "connected", "ready", "failed", "archived"],
  enriched: ["clustered", "connected", "ready", "failed", "archived"],
  clustered: ["connected", "ready", "failed", "archived"],
  connected: ["ready", "failed", "archived"],
  ready: ["archived", "failed", "enriched"],
  archived: ["ready"],
  failed: ["archived", "validated"],
});

export function canTransition(from: LifecycleState, to: LifecycleState): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: LifecycleState, to: LifecycleState): void {
  if (!canTransition(from, to)) {
    throw new SpatialLifecycleError(`illegal transition ${from} → ${to}`);
  }
}

export class SpatialHistory {
  private readonly log: SpatialHistoryEntry[] = [];
  record(entry: SpatialHistoryEntry): void { this.log.push(Object.freeze({ ...entry })); }
  for(entityId: string): readonly SpatialHistoryEntry[] { return this.log.filter((e) => e.entityId === entityId); }
  all(): readonly SpatialHistoryEntry[] { return [...this.log]; }
  clear(): void { this.log.length = 0; }
}
