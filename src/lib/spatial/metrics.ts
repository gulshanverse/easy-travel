/** Spatial Intelligence Engine — in-memory metrics. */
export interface SpatialMetricsSnapshot {
  readonly places: number;
  readonly regions: number;
  readonly clusters: number;
  readonly corridors: number;
  readonly relationshipsDetected: number;
  readonly distancesComputed: number;
  readonly constraintViolations: number;
  readonly indexUpdates: number;
  readonly lifecycleTransitions: number;
}

export class SpatialMetrics {
  private m: {
    places: number; regions: number; clusters: number; corridors: number;
    relationshipsDetected: number; distancesComputed: number;
    constraintViolations: number; indexUpdates: number; lifecycleTransitions: number;
  } = {
    places: 0, regions: 0, clusters: 0, corridors: 0,
    relationshipsDetected: 0, distancesComputed: 0,
    constraintViolations: 0, indexUpdates: 0, lifecycleTransitions: 0,
  };
  incPlaces(n = 1): void { this.m.places += n; }
  incRegions(n = 1): void { this.m.regions += n; }
  incClusters(n = 1): void { this.m.clusters += n; }
  incCorridors(n = 1): void { this.m.corridors += n; }
  incRelationships(n = 1): void { this.m.relationshipsDetected += n; }
  incDistances(n = 1): void { this.m.distancesComputed += n; }
  incViolations(n = 1): void { this.m.constraintViolations += n; }
  incIndex(n = 1): void { this.m.indexUpdates += n; }
  incLifecycle(n = 1): void { this.m.lifecycleTransitions += n; }
  snapshot(): SpatialMetricsSnapshot { return Object.freeze({ ...this.m }); }
  reset(): void {
    this.m = {
      places: 0, regions: 0, clusters: 0, corridors: 0,
      relationshipsDetected: 0, distancesComputed: 0,
      constraintViolations: 0, indexUpdates: 0, lifecycleTransitions: 0,
    };
  }
}
