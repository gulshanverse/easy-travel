/**
 * Identity Platform — in-memory metrics registry.
 */
export interface IdentityMetricsSnapshot {
  readonly counters: Readonly<Record<string, number>>;
  readonly histograms: Readonly<Record<string, { count: number; sum: number; min: number; max: number }>>;
}

export class IdentityMetrics {
  private readonly counters = new Map<string, number>();
  private readonly hist = new Map<string, { count: number; sum: number; min: number; max: number }>();

  inc(name: string, by = 1): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + by);
  }
  observe(name: string, value: number): void {
    const h = this.hist.get(name);
    if (!h) this.hist.set(name, { count: 1, sum: value, min: value, max: value });
    else { h.count++; h.sum += value; if (value < h.min) h.min = value; if (value > h.max) h.max = value; }
  }
  counter(name: string): number { return this.counters.get(name) ?? 0; }
  snapshot(): IdentityMetricsSnapshot {
    return {
      counters: Object.fromEntries(this.counters),
      histograms: Object.fromEntries(Array.from(this.hist.entries()).map(([k, v]) => [k, { ...v }])),
    };
  }
  reset(): void { this.counters.clear(); this.hist.clear(); }
}

export const IDENTITY_METRIC = Object.freeze({
  usersCreated: "identity.users.created",
  profileUpdates: "identity.profile.updates",
  preferenceUpdates: "identity.preferences.updates",
  preferenceUsage: "identity.preferences.usage",
  journeySaves: "identity.journeys.saved",
  journeyUpdates: "identity.journeys.updated",
  journeyArchives: "identity.journeys.archived",
  journeyDuplicates: "identity.journeys.duplicated",
  favoritesAdded: "identity.favorites.added",
  favoritesRemoved: "identity.favorites.removed",
  notificationRules: "identity.notifications.rules",
  privacyUpdates: "identity.privacy.updates",
  consentsRecorded: "identity.privacy.consents",
  sessionsStarted: "identity.sessions.started",
  sessionsRevoked: "identity.sessions.revoked",
  personalizationBuilds: "identity.personalization.builds",
  personalizationLatency: "identity.personalization.latency_ms",
});
