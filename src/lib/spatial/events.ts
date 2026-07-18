/** Spatial Intelligence Engine — typed event bus. */
import { newCorrelationId, newEventId } from "./ids";

export type SpatialEventName =
  | "PlaceCreated" | "PlaceUpdated" | "PlaceArchived"
  | "RegionCreated" | "RegionValidated" | "RegionUpdated"
  | "ClusterBuilt" | "CorridorCreated" | "SpatialConstraintAdded"
  | "SpatialRelationshipDetected" | "DistanceCalculated"
  | "SpatialIndexUpdated" | "GeoFenceTriggered" | "SpatialModelArchived"
  | "LifecycleTransitioned";

export interface SpatialEvent<TPayload = unknown> {
  readonly id: string;
  readonly name: SpatialEventName;
  readonly at: number;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly version: number;
  readonly payload: TPayload;
  readonly metadata: Readonly<Record<string, string | number | boolean>>;
}

export type SpatialEventListener = (event: SpatialEvent) => void;

export class SpatialEventBus {
  private listeners = new Set<SpatialEventListener>();
  on(listener: SpatialEventListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
  emit<T>(name: SpatialEventName, payload: T, meta: Partial<Pick<SpatialEvent, "correlationId" | "causationId" | "metadata" | "version">> = {}): SpatialEvent<T> {
    const event: SpatialEvent<T> = Object.freeze({
      id: newEventId(),
      name,
      at: Date.now(),
      correlationId: meta.correlationId ?? newCorrelationId(),
      causationId: meta.causationId,
      version: meta.version ?? 1,
      payload,
      metadata: Object.freeze({ ...(meta.metadata ?? {}) }),
    });
    for (const l of this.listeners) { try { l(event); } catch { /* isolate */ } }
    return event;
  }
  clear(): void { this.listeners.clear(); }
}
