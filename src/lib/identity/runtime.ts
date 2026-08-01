/**
 * Identity Platform — IdentityRuntime facade.
 * The ONLY sanctioned entry point outside this package.
 */
import { mergeIdentityConfig, type IdentityConfig } from "./config";
import {
  makeConfidencePreference, mergePreferenceSets, observePreference,
  type ConfidencePreference,
} from "./confidence";
import {
  buildPersonalizationContext, makeContextHistoryEntry,
  type PersonalizationContext, type PersonalizationContextHistoryEntry,
} from "./context";
import { IdentityEventBus, type IdentityEventListener } from "./events";
import { UnknownUserError } from "./errors";
import type { MakeFavoriteInput, MakeSavedJourneyInput, MakeUserInput } from "./factories";
import { collectIdentityHealth, type IdentityHealthReport } from "./health";
import { IdentityManager } from "./manager";
import { IdentityMetrics, type IdentityMetricsSnapshot } from "./metrics";
import type { PreferencePatch } from "./preferences";
import type { IdentityPorts } from "./ports";
import { buildIdentityCards, type IdentityCard } from "./presentation";
import {
  adoptTravelProfile, applyTravelProfilePatch, builtInTravelProfiles,
  resolveProfileBundle, travelProfileSnapshot,
  type TravelProfile, type TravelProfilePatch, type TravelProfileSnapshot,
  type TravelProfileType,
} from "./profiles";
import {
  defaultPreferenceResolutionEngine, PreferenceResolutionEngine,
  type PreferenceResolution,
} from "./resolution";
import { computeTravelStatistics, type TravelStatistics } from "./statistics";
import { noopIdentityTelemetry, type IdentityTelemetrySink } from "./telemetry";
import type {
  Favorite, IdentitySnapshot, PersonalizationProfile, SavedJourney,
  User, UserContext, UserPreferences,
} from "./types";

export interface IdentityRuntimeOptions {
  readonly config?: Partial<IdentityConfig>;
  readonly telemetry?: IdentityTelemetrySink;
  readonly ports?: IdentityPorts;
  readonly now?: () => number;
}

export class IdentityRuntime {
  readonly events = new IdentityEventBus();
  readonly metrics = new IdentityMetrics();
  readonly manager: IdentityManager;
  readonly config: IdentityConfig;
  readonly resolver: PreferenceResolutionEngine = defaultPreferenceResolutionEngine;
  private readonly ports: IdentityPorts;
  private readonly clock: () => number;
  private readonly travelProfiles = new Map<string, TravelProfile>();
  private readonly observed = new Map<string, ConfidencePreference[]>();
  private readonly contexts = new Map<string, PersonalizationContext>();
  private readonly contextHistory = new Map<string, PersonalizationContextHistoryEntry[]>();

  constructor(options: IdentityRuntimeOptions = {}) {
    this.config = mergeIdentityConfig(options.config);
    this.ports = options.ports ?? {};
    this.clock = options.now ?? (() => Date.now());
    this.manager = new IdentityManager({
      config: this.config,
      events: this.events,
      metrics: this.metrics,
      telemetry: options.telemetry ?? noopIdentityTelemetry,
      ports: this.ports,
      now: this.clock,
    });
  }

  on(listener: IdentityEventListener): () => void { return this.events.on(listener); }

  // ------------------------------------------------------------ delegation
  createUser(input: MakeUserInput): User { return this.manager.createUser(input); }
  getUser(id: string): User | undefined { return this.manager.getUser(id); }
  listUsers(): readonly User[] { return this.manager.listUsers(); }
  getProfile(userId: string) { return this.manager.getProfile(userId); }
  getPreferences(userId: string): UserPreferences { return this.manager.getPreferences(userId); }
  updatePreferences(userId: string, patch: PreferencePatch): UserPreferences {
    return this.manager.updatePreferences(userId, patch);
  }
  addFavorite(input: MakeFavoriteInput): Favorite { return this.manager.addFavorite(input); }
  listFavorites(userId: string): readonly Favorite[] { return this.manager.listFavorites(userId); }
  saveJourney(input: MakeSavedJourneyInput): SavedJourney { return this.manager.saveJourney(input); }
  listJourneys(userId: string): readonly SavedJourney[] { return this.manager.listJourneys(userId); }
  personalizationFor(userId: string): PersonalizationProfile {
    return this.manager.personalizationFor(userId);
  }
  userContext(userId: string): UserContext { return this.manager.userContext(userId); }

  // -------------------------------------------------------- travel profiles
  builtInProfiles(): readonly TravelProfile[] { return builtInTravelProfiles(0); }

  adoptProfile(userId: string, type: TravelProfileType): TravelProfile {
    if (!this.manager.getUser(userId)) throw new UnknownUserError(userId);
    const profile = adoptTravelProfile(type, userId, this.clock());
    this.travelProfiles.set(profile.id, profile);
    this.events.emit({ name: "TravelProfileCreated", at: this.clock(), userId, data: { type, id: profile.id } });
    return profile;
  }

  updateTravelProfile(id: string, patch: TravelProfilePatch): TravelProfile {
    const current = this.requireTravelProfile(id);
    const next = applyTravelProfilePatch(current, patch, this.clock());
    this.travelProfiles.set(id, next);
    this.events.emit({
      name: "TravelProfileUpdated", at: this.clock(),
      userId: next.userId ?? undefined, data: { id, revision: next.revision },
    });
    return next;
  }

  activateProfile(id: string, active: boolean): TravelProfile {
    return this.updateTravelProfile(id, { active });
  }

  requireTravelProfile(id: string): TravelProfile {
    const p = this.travelProfiles.get(id);
    if (!p) throw new UnknownUserError(id);
    return p;
  }

  profilesFor(userId: string): readonly TravelProfile[] {
    return Object.freeze([...this.travelProfiles.values()]
      .filter((p) => p.userId === userId)
      .sort((a, b) => (a.createdAt - b.createdAt) || a.id.localeCompare(b.id)));
  }

  travelProfileSnapshot(id: string): TravelProfileSnapshot {
    return travelProfileSnapshot(this.requireTravelProfile(id), this.clock());
  }

  // ------------------------------------------------- preferences & learning
  observe(userId: string, input: { key: string; value: string | number | boolean; observations: number; total: number }): ConfidencePreference {
    const p = observePreference({ ...input, at: this.clock() });
    const list = this.observed.get(userId) ?? [];
    this.observed.set(userId, [...mergePreferenceSets(list, [p])]);
    return p;
  }

  /** Explicit + inherited (profiles) + observed candidates, deterministic order. */
  candidatePreferences(userId: string): readonly ConfidencePreference[] {
    const prefs = this.manager.getPreferences(userId);
    const at = prefs.updatedAt;
    const explicit: ConfidencePreference[] = [
      makeConfidencePreference({ key: "preferredBudget", value: prefs.preferredBudget, source: "explicit", at, reason: "user setting" }),
      makeConfidencePreference({ key: "preferredSeat", value: prefs.preferredSeat, source: "explicit", at, reason: "user setting" }),
      makeConfidencePreference({ key: "preferredCoach", value: prefs.preferredCoach, source: "explicit", at, reason: "user setting" }),
      makeConfidencePreference({ key: "preferredCabin", value: prefs.preferredCabin, source: "explicit", at, reason: "user setting" }),
    ];
    if (prefs.preferredTransport[0]) {
      explicit.push(makeConfidencePreference({
        key: "preferredTransport", value: prefs.preferredTransport[0],
        source: "explicit", at, reason: "highest-ranked transport mode",
      }));
    }
    const inherited = resolveProfileBundle(this.profilesFor(userId)) as readonly ConfidencePreference[];
    const observed = this.observed.get(userId) ?? [];
    return Object.freeze([...inherited, ...observed, ...explicit]
      .sort((a, b) => a.key.localeCompare(b.key) || a.source.localeCompare(b.source)));
  }

  resolvePreferences(
    userId: string,
    options: { keys?: readonly string[]; availability?: (key: string, value: string | number | boolean) => boolean } = {},
  ): readonly PreferenceResolution[] {
    const candidates = this.candidatePreferences(userId);
    const resolutions = this.resolver.resolveAll({
      candidates,
      keys: options.keys,
      availability: options.availability,
    });
    const conflicts = resolutions.reduce((n, r) => n + r.conflicts.length, 0);
    if (conflicts > 0) {
      this.events.emit({ name: "PreferenceConflictDetected", at: this.clock(), userId, data: { conflicts } });
    }
    this.events.emit({ name: "PreferencesResolved", at: this.clock(), userId, data: { keys: resolutions.length } });
    return resolutions;
  }

  // ------------------------------------------------------------ statistics
  statisticsFor(userId: string): TravelStatistics {
    const stats = computeTravelStatistics({
      userId,
      journeys: this.manager.listJourneys(userId),
      favorites: this.manager.listFavorites(userId),
      at: this.clock(),
    });
    this.events.emit({ name: "StatisticsComputed", at: this.clock(), userId, data: { score: stats.travelScore } });
    return stats;
  }

  // --------------------------------------------------- personalization ctx
  personalizationContext(userId: string): PersonalizationContext {
    const previous = this.contexts.get(userId);
    const signals = this.manager.personalizationFor(userId);
    const context = buildPersonalizationContext({
      userId,
      at: this.clock(),
      version: (previous?.version ?? 0) + 1,
      preferences: this.manager.getPreferences(userId),
      confidencePreferences: this.candidatePreferences(userId),
      resolutions: this.resolvePreferences(userId),
      statistics: this.statisticsFor(userId),
      signals,
      activeProfiles: this.profilesFor(userId).filter((p) => p.active).map((p) => p.type),
    });
    this.contexts.set(userId, context);
    const history = this.contextHistory.get(userId) ?? [];
    history.push(makeContextHistoryEntry({
      userId, at: context.builtAt, version: context.version,
      fingerprint: context.fingerprint, reason: "context rebuilt",
    }));
    this.contextHistory.set(userId, history);
    return context;
  }

  contextHistoryFor(userId: string): readonly PersonalizationContextHistoryEntry[] {
    return Object.freeze([...(this.contextHistory.get(userId) ?? [])]);
  }

  async publishPersonalizationContext(userId: string): Promise<PersonalizationContext> {
    const context = this.personalizationContext(userId);
    await this.ports.agent?.publishUserContext(userId, context as unknown as Record<string, unknown>);
    this.events.emit({ name: "PersonalizationContextPublished", at: this.clock(), userId, data: { version: context.version } });
    return context;
  }

  // ---------------------------------------------------------- presentation
  cards(userId: string): readonly IdentityCard[] {
    return buildIdentityCards({
      profile: this.manager.getProfile(userId),
      preferences: this.manager.getPreferences(userId),
      travelProfiles: this.profilesFor(userId),
      statistics: this.statisticsFor(userId),
      favorites: this.manager.listFavorites(userId),
      journeys: this.manager.listJourneys(userId),
      context: this.personalizationContext(userId),
    });
  }

  async publishCards(userId: string): Promise<readonly IdentityCard[]> {
    const cards = this.cards(userId);
    await this.ports.studio?.publishCards(userId, cards as unknown as Record<string, unknown>[]);
    return cards;
  }

  // --------------------------------------------------------------- runtime
  snapshot(): IdentitySnapshot { return this.manager.snapshot(); }
  metricsSnapshot(): IdentityMetricsSnapshot { return this.metrics.snapshot(); }
  health(): Promise<IdentityHealthReport> {
    return collectIdentityHealth(this.manager, this.ports, this.travelProfiles.size);
  }
  clear(): void {
    this.manager.clear();
    this.travelProfiles.clear();
    this.observed.clear();
    this.contexts.clear();
    this.contextHistory.clear();
  }
}

export function createIdentityRuntime(options?: IdentityRuntimeOptions): IdentityRuntime {
  return new IdentityRuntime(options);
}
