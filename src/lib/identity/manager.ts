/**
 * Identity Platform — IdentityManager.
 * Owns all identity state and applies deterministic, immutable transitions.
 */
import type { IdentityConfig } from "./config";
import {
  IdentityConflictError, IdentityLimitError, IdentityPrivacyError,
  IdentityValidationError, UnknownDeviceSessionError, UnknownFavoriteError,
  UnknownSavedJourneyError, UnknownUserError,
} from "./errors";
import { IdentityEventBus } from "./events";
import {
  deepFreeze, makeConsentRecord, makeDataDeletionRequest, makeDataExportRequest,
  makeDeviceSession, makeEmergencyContact, makeFavorite, makeNotificationSettings,
  makePrivacySettings, makeSavedJourney, makeTravelCompanion, makeUser,
  makeUserPreferences, makeUserProfile, makeUserSettings,
  type MakeFavoriteInput, type MakeSavedJourneyInput, type MakeUserInput,
} from "./factories";
import { dedupeFavorites, sortFavorites } from "./favorites";
import { newHistoryId, newSavedJourneyId } from "./ids";
import {
  addTags, archiveSavedJourney, duplicateSavedJourney, makeJourneyNote,
  makeJourneyVersion, removeTags, restoreSavedJourney, updateSavedJourney,
  type SavedJourneyPatch,
} from "./journeys";
import { IDENTITY_METRIC, IdentityMetrics } from "./metrics";
import {
  evaluateNotification, notificationRules, requiredWorkflows,
  updateNotificationSettings, type NotificationDecision, type NotificationRule,
} from "./notifications";
import { buildPersonalizationProfile } from "./personalization";
import { applyPreferencePatch, type PreferencePatch } from "./preferences";
import type { IdentityPorts } from "./ports";
import {
  canViewProfile, completeDeletionRequest, completeExportRequest, consentLedger,
  hasConsent, personalizationAllowed, updatePrivacySettings,
} from "./privacy";
import { KeyedStore, OwnedStore, SingletonStore } from "./registry";
import { activeSessions, isSessionActive, revokeSession, touchSession } from "./sessions";
import type { IdentityTelemetrySink } from "./telemetry";
import type {
  ConsentKind, ConsentRecord, DataDeletionRequest, DataExportRequest, DeviceSession,
  EmergencyContact, Favorite, IdentityHistoryEntry, IdentitySnapshot, NotificationCategory,
  NotificationSettings, PersonalizationProfile, PrivacySettings, SavedJourney,
  SavedJourneyNote, SavedJourneyVersion, TravelCompanion, User, UserContext,
  UserPreferences, UserProfile, UserSettings, UserStatus,
} from "./types";
import { favoriteKey, validateUser } from "./validation";

export interface IdentityManagerDeps {
  readonly config: IdentityConfig;
  readonly events: IdentityEventBus;
  readonly metrics: IdentityMetrics;
  readonly telemetry: IdentityTelemetrySink;
  readonly ports: IdentityPorts;
  readonly now: () => number;
}

export class IdentityManager {
  readonly users = new KeyedStore<User>();
  readonly profiles = new SingletonStore<UserProfile>();
  readonly preferences = new SingletonStore<UserPreferences>();
  readonly settings = new SingletonStore<UserSettings>();
  readonly notifications = new SingletonStore<NotificationSettings>();
  readonly privacy = new SingletonStore<PrivacySettings>();
  readonly favorites: OwnedStore<Favorite>;
  readonly journeys: OwnedStore<SavedJourney>;
  readonly companions: OwnedStore<TravelCompanion>;
  readonly emergencyContacts: OwnedStore<EmergencyContact>;
  readonly sessions: OwnedStore<DeviceSession>;
  readonly consents: OwnedStore<ConsentRecord>;
  readonly exports: OwnedStore<DataExportRequest>;
  readonly deletions: OwnedStore<DataDeletionRequest>;
  private readonly versions = new Map<string, SavedJourneyVersion[]>();
  private readonly notes = new Map<string, SavedJourneyNote[]>();
  private readonly historyByUser = new Map<string, IdentityHistoryEntry[]>();

  constructor(private readonly deps: IdentityManagerDeps) {
    const c = deps.config;
    this.favorites = new OwnedStore<Favorite>(c.maxFavoritesPerUser, "favorites");
    this.journeys = new OwnedStore<SavedJourney>(c.maxSavedJourneysPerUser, "saved journeys");
    this.companions = new OwnedStore<TravelCompanion>(c.maxCompanionsPerUser, "companions");
    this.emergencyContacts = new OwnedStore<EmergencyContact>(
      c.maxEmergencyContactsPerUser, "emergency contacts",
    );
    this.sessions = new OwnedStore<DeviceSession>(c.maxDeviceSessionsPerUser, "device sessions");
    this.consents = new OwnedStore<ConsentRecord>(1024, "consents");
    this.exports = new OwnedStore<DataExportRequest>(64, "export requests");
    this.deletions = new OwnedStore<DataDeletionRequest>(64, "deletion requests");
  }

  private now(): number { return this.deps.now(); }

  private record(userId: string, action: string, detail: Record<string, unknown> = {}): void {
    const list = this.historyByUser.get(userId) ?? [];
    list.push(deepFreeze({
      id: newHistoryId(), userId, at: this.now(), action, detail: { ...detail },
    }));
    while (list.length > this.deps.config.maxHistoryPerUser) list.shift();
    this.historyByUser.set(userId, list);
  }

  // ---------------------------------------------------------------- users
  createUser(input: MakeUserInput): User {
    if (this.users.size() >= this.deps.config.maxUsersPerProcess) {
      throw new IdentityLimitError("max users per process reached", {
        limit: this.deps.config.maxUsersPerProcess,
      });
    }
    const at = this.now();
    const user = makeUser({ ...input, at: input.at ?? at });
    if (this.users.list().some((u) => u.handle === user.handle)) {
      throw new IdentityConflictError(`handle already taken: ${user.handle}`, { handle: user.handle });
    }
    this.users.set(user);
    this.profiles.set(user.id, makeUserProfile({ userId: user.id, displayName: user.handle, at }));
    this.preferences.set(user.id, makeUserPreferences({ userId: user.id, at }));
    this.settings.set(user.id, makeUserSettings({ userId: user.id, at }));
    this.notifications.set(user.id, makeNotificationSettings({ userId: user.id, at }));
    this.privacy.set(user.id, makePrivacySettings({ userId: user.id, at }));
    this.deps.metrics.inc(IDENTITY_METRIC.usersCreated);
    this.deps.events.emit({ name: "UserCreated", at, userId: user.id, data: { handle: user.handle } });
    this.record(user.id, "user.created", { handle: user.handle });
    return user;
  }

  getUser(id: string): User | undefined { return this.users.get(id); }
  requireUser(id: string): User {
    const u = this.users.get(id);
    if (!u) throw new UnknownUserError(id);
    return u;
  }
  listUsers(): readonly User[] { return this.users.list(); }
  findByHandle(handle: string): User | undefined {
    return this.users.list().find((u) => u.handle === handle.toLowerCase());
  }

  updateUser(id: string, patch: Partial<Pick<User, "email" | "metadata" | "statistics">>): User {
    const current = this.requireUser(id);
    const at = this.now();
    const next = validateUser(deepFreeze({
      ...current,
      ...patch,
      metadata: patch.metadata ? { ...current.metadata, ...patch.metadata } : current.metadata,
      statistics: patch.statistics ? { ...current.statistics, ...patch.statistics } : current.statistics,
      updatedAt: at,
    }));
    this.users.set(next);
    this.deps.events.emit({ name: "UserUpdated", at, userId: id, data: {} });
    this.record(id, "user.updated");
    return next;
  }

  setUserStatus(id: string, status: UserStatus): User {
    const current = this.requireUser(id);
    if (current.status === "deleted" && status !== "deleted") {
      throw new IdentityValidationError("deleted users cannot be reactivated", { id });
    }
    const at = this.now();
    const next = deepFreeze({ ...current, status, updatedAt: at });
    this.users.set(next);
    this.deps.events.emit({ name: "UserStatusChanged", at, userId: id, data: { status } });
    this.record(id, "user.status", { status });
    return next;
  }

  deleteUser(id: string): void {
    this.requireUser(id);
    const at = this.now();
    this.users.delete(id);
    this.profiles.delete(id); this.preferences.delete(id); this.settings.delete(id);
    this.notifications.delete(id); this.privacy.delete(id);
    for (const j of this.journeys.forUser(id)) {
      this.versions.delete(j.id); this.notes.delete(j.id);
    }
    this.favorites.deleteForUser(id); this.journeys.deleteForUser(id);
    this.companions.deleteForUser(id); this.emergencyContacts.deleteForUser(id);
    this.sessions.deleteForUser(id); this.consents.deleteForUser(id);
    this.exports.deleteForUser(id); this.deletions.deleteForUser(id);
    this.historyByUser.delete(id);
    this.deps.events.emit({ name: "UserDeleted", at, userId: id, data: {} });
  }

  // -------------------------------------------------------------- profile
  getProfile(userId: string): UserProfile {
    const p = this.profiles.get(userId);
    if (!p) throw new UnknownUserError(userId);
    return p;
  }
  updateProfile(
    userId: string,
    patch: Partial<Omit<UserProfile, "id" | "userId" | "createdAt">>,
  ): UserProfile {
    const current = this.getProfile(userId);
    const at = this.now();
    const next = deepFreeze({ ...current, ...patch, updatedAt: at });
    this.profiles.set(userId, next);
    this.deps.metrics.inc(IDENTITY_METRIC.profileUpdates);
    this.deps.events.emit({ name: "ProfileUpdated", at, userId, data: { fields: Object.keys(patch) } });
    this.record(userId, "profile.updated", { fields: Object.keys(patch) });
    return next;
  }

  // ---------------------------------------------------------- preferences
  getPreferences(userId: string): UserPreferences {
    const p = this.preferences.get(userId);
    if (!p) throw new UnknownUserError(userId);
    return p;
  }
  updatePreferences(userId: string, patch: PreferencePatch): UserPreferences {
    const current = this.getPreferences(userId);
    const at = this.now();
    const next = applyPreferencePatch(current, patch, at);
    this.preferences.set(userId, next);
    const user = this.users.get(userId);
    if (user) {
      this.users.set(deepFreeze({
        ...user,
        statistics: { ...user.statistics, preferenceUpdates: user.statistics.preferenceUpdates + 1 },
        updatedAt: at,
      }));
    }
    this.deps.metrics.inc(IDENTITY_METRIC.preferenceUpdates);
    this.deps.events.emit({
      name: "PreferencesUpdated", at, userId,
      data: { revision: next.revision, fields: Object.keys(patch) },
    });
    this.record(userId, "preferences.updated", { revision: next.revision });
    return next;
  }

  getSettings(userId: string): UserSettings {
    const s = this.settings.get(userId);
    if (!s) throw new UnknownUserError(userId);
    return s;
  }
  updateSettings(
    userId: string,
    patch: Partial<Omit<UserSettings, "id" | "userId">>,
  ): UserSettings {
    const current = this.getSettings(userId);
    const at = this.now();
    const next = deepFreeze({ ...current, ...patch, updatedAt: at });
    this.settings.set(userId, next);
    this.deps.events.emit({ name: "SettingsUpdated", at, userId, data: {} });
    return next;
  }

  // ------------------------------------------------------------ favorites
  addFavorite(input: MakeFavoriteInput): Favorite {
    this.requireUser(input.userId);
    const at = this.now();
    const fav = makeFavorite({ ...input, at: input.at ?? at });
    const key = favoriteKey(fav);
    const existing = this.favorites.forUser(fav.userId).find((f) => favoriteKey(f) === key);
    if (existing) return existing;
    this.favorites.add(fav);
    this.syncFavoriteCount(fav.userId, at);
    this.deps.metrics.inc(IDENTITY_METRIC.favoritesAdded);
    this.deps.events.emit({
      name: "FavoriteAdded", at, userId: fav.userId, data: { id: fav.id, kind: fav.kind, key },
    });
    this.record(fav.userId, "favorite.added", { kind: fav.kind, key });
    return fav;
  }

  removeFavorite(id: string): Favorite {
    const fav = this.favorites.get(id);
    if (!fav) throw new UnknownFavoriteError(id);
    const at = this.now();
    this.favorites.delete(id);
    this.syncFavoriteCount(fav.userId, at);
    this.deps.metrics.inc(IDENTITY_METRIC.favoritesRemoved);
    this.deps.events.emit({ name: "FavoriteRemoved", at, userId: fav.userId, data: { id, kind: fav.kind } });
    this.record(fav.userId, "favorite.removed", { kind: fav.kind });
    return fav;
  }

  listFavorites(userId: string): readonly Favorite[] {
    return sortFavorites(dedupeFavorites(this.favorites.forUser(userId)));
  }

  private syncFavoriteCount(userId: string, at: number): void {
    const user = this.users.get(userId);
    if (!user) return;
    this.users.set(deepFreeze({
      ...user,
      statistics: { ...user.statistics, favoritesCount: this.favorites.countForUser(userId) },
      updatedAt: at,
    }));
  }

  // -------------------------------------------------------- saved journeys
  saveJourney(input: MakeSavedJourneyInput): SavedJourney {
    this.requireUser(input.userId);
    const at = this.now();
    const journey = makeSavedJourney({ ...input, at: input.at ?? at });
    this.journeys.add(journey);
    this.pushVersion(journey, "created", at);
    const user = this.requireUser(input.userId);
    this.users.set(deepFreeze({
      ...user,
      statistics: { ...user.statistics, journeysSaved: user.statistics.journeysSaved + 1 },
      updatedAt: at,
    }));
    this.deps.metrics.inc(IDENTITY_METRIC.journeySaves);
    this.deps.events.emit({
      name: "JourneySaved", at, userId: journey.userId, data: { id: journey.id, title: journey.title },
    });
    this.record(journey.userId, "journey.saved", { id: journey.id });
    return journey;
  }

  requireJourney(id: string): SavedJourney {
    const j = this.journeys.get(id);
    if (!j) throw new UnknownSavedJourneyError(id);
    return j;
  }
  listJourneys(userId: string, includeArchived = true): readonly SavedJourney[] {
    const all = [...this.journeys.forUser(userId)].sort((a, b) => a.createdAt - b.createdAt);
    return Object.freeze(includeArchived ? all : all.filter((j) => j.status !== "archived"));
  }

  updateJourney(id: string, patch: SavedJourneyPatch): SavedJourney {
    const current = this.requireJourney(id);
    const at = this.now();
    const next = updateSavedJourney(current, patch, at);
    this.journeys.replace(next);
    this.pushVersion(next, "updated", at);
    if (patch.status === "completed" && current.status !== "completed") {
      const user = this.requireUser(next.userId);
      this.users.set(deepFreeze({
        ...user,
        statistics: { ...user.statistics, journeysCompleted: user.statistics.journeysCompleted + 1 },
        updatedAt: at,
      }));
    }
    this.deps.metrics.inc(IDENTITY_METRIC.journeyUpdates);
    this.deps.events.emit({
      name: "JourneyUpdated", at, userId: next.userId, data: { id, revision: next.revision },
    });
    this.record(next.userId, "journey.updated", { id, revision: next.revision });
    return next;
  }

  archiveJourney(id: string): SavedJourney {
    const current = this.requireJourney(id);
    const at = this.now();
    const next = archiveSavedJourney(current, at);
    this.journeys.replace(next);
    this.deps.metrics.inc(IDENTITY_METRIC.journeyArchives);
    this.deps.events.emit({ name: "JourneyArchived", at, userId: next.userId, data: { id } });
    this.record(next.userId, "journey.archived", { id });
    return next;
  }

  restoreJourney(id: string): SavedJourney {
    const next = restoreSavedJourney(this.requireJourney(id), this.now());
    this.journeys.replace(next);
    return next;
  }

  duplicateJourney(id: string, title?: string): SavedJourney {
    const source = this.requireJourney(id);
    const at = this.now();
    const copy = duplicateSavedJourney(source, { id: newSavedJourneyId(), title, at });
    this.journeys.add(copy);
    this.pushVersion(copy, "duplicated", at);
    this.deps.metrics.inc(IDENTITY_METRIC.journeyDuplicates);
    this.deps.events.emit({
      name: "JourneyDuplicated", at, userId: copy.userId, data: { id: copy.id, from: source.id },
    });
    this.record(copy.userId, "journey.duplicated", { id: copy.id, from: source.id });
    return copy;
  }

  addJourneyTags(id: string, tags: readonly string[]): SavedJourney {
    const current = this.requireJourney(id);
    if (current.tags.length + tags.length > this.deps.config.maxTagsPerJourney) {
      throw new IdentityLimitError("tag limit reached", { id, limit: this.deps.config.maxTagsPerJourney });
    }
    const next = addTags(current, tags, this.now());
    this.journeys.replace(next);
    return next;
  }
  removeJourneyTags(id: string, tags: readonly string[]): SavedJourney {
    const next = removeTags(this.requireJourney(id), tags, this.now());
    this.journeys.replace(next);
    return next;
  }

  addJourneyNote(journeyId: string, authorId: string, body: string): SavedJourneyNote {
    const journey = this.requireJourney(journeyId);
    const at = this.now();
    const list = this.notes.get(journeyId) ?? [];
    if (list.length >= this.deps.config.maxNotesPerJourney) {
      throw new IdentityLimitError("note limit reached", { journeyId });
    }
    const note = makeJourneyNote({ journeyId, authorId, body, at });
    list.push(note);
    this.notes.set(journeyId, list);
    this.deps.events.emit({
      name: "JourneyNoteAdded", at, userId: journey.userId, data: { journeyId, noteId: note.id },
    });
    return note;
  }
  journeyNotes(journeyId: string): readonly SavedJourneyNote[] {
    return Object.freeze([...(this.notes.get(journeyId) ?? [])]);
  }

  private pushVersion(journey: SavedJourney, reason: string, at: number): SavedJourneyVersion {
    const list = this.versions.get(journey.id) ?? [];
    const version = makeJourneyVersion(journey, reason, at);
    list.push(version);
    while (list.length > this.deps.config.maxVersionsPerJourney) list.shift();
    this.versions.set(journey.id, list);
    this.deps.events.emit({
      name: "JourneyVersionCreated", at, userId: journey.userId,
      data: { journeyId: journey.id, revision: version.revision, reason },
    });
    return version;
  }
  journeyVersions(journeyId: string): readonly SavedJourneyVersion[] {
    return Object.freeze([...(this.versions.get(journeyId) ?? [])]);
  }
  journeyHistory(journeyId: string): readonly IdentityHistoryEntry[] {
    const journey = this.requireJourney(journeyId);
    return Object.freeze(
      (this.historyByUser.get(journey.userId) ?? []).filter((h) => h.detail.id === journeyId),
    );
  }

  // -------------------------------------------------------- notifications
  getNotificationSettings(userId: string): NotificationSettings {
    const s = this.notifications.get(userId);
    if (!s) throw new UnknownUserError(userId);
    return s;
  }
  updateNotificationSettings(
    userId: string,
    patch: Partial<Omit<NotificationSettings, "userId">>,
  ): NotificationSettings {
    const current = this.getNotificationSettings(userId);
    const at = this.now();
    const next = updateNotificationSettings(current, patch, at);
    this.notifications.set(userId, next);
    this.deps.metrics.inc(IDENTITY_METRIC.notificationRules, requiredWorkflows(next).length);
    this.deps.events.emit({ name: "NotificationSettingsUpdated", at, userId, data: {} });
    this.record(userId, "notifications.updated", { fields: Object.keys(patch) });
    return next;
  }
  notificationRules(userId: string): readonly NotificationRule[] {
    return notificationRules(this.getNotificationSettings(userId));
  }
  evaluateNotification(
    userId: string,
    input: { category: NotificationCategory; hour?: number },
  ): NotificationDecision {
    const decision = evaluateNotification(this.getNotificationSettings(userId), input);
    this.deps.events.emit({
      name: "NotificationRuleEvaluated", at: this.now(), userId,
      data: { category: input.category, allowed: decision.allowed, reason: decision.reason },
    });
    return decision;
  }
  /** Requests monitoring workflows for enabled alert rules through the workflow port. */
  async syncNotificationWorkflows(userId: string): Promise<readonly string[]> {
    const port = this.deps.ports.workflow;
    const defs = requiredWorkflows(this.getNotificationSettings(userId));
    if (!port) return defs;
    const ids: string[] = [];
    for (const definitionId of defs) {
      const id = await port.ensureWorkflow({ userId, definitionId });
      if (id) ids.push(id);
    }
    return Object.freeze(ids);
  }

  // -------------------------------------------------------------- privacy
  getPrivacySettings(userId: string): PrivacySettings {
    const s = this.privacy.get(userId);
    if (!s) throw new UnknownUserError(userId);
    return s;
  }
  updatePrivacySettings(
    userId: string,
    patch: Partial<Omit<PrivacySettings, "userId">>,
  ): PrivacySettings {
    const current = this.getPrivacySettings(userId);
    const at = this.now();
    const next = updatePrivacySettings(current, patch, at);
    this.privacy.set(userId, next);
    this.deps.metrics.inc(IDENTITY_METRIC.privacyUpdates);
    this.deps.events.emit({ name: "PrivacySettingsUpdated", at, userId, data: {} });
    this.record(userId, "privacy.updated", { fields: Object.keys(patch) });
    return next;
  }
  recordConsent(
    userId: string,
    input: { kind: ConsentKind; granted: boolean; version?: string; source?: string },
  ): ConsentRecord {
    this.requireUser(userId);
    const at = this.now();
    const consent = makeConsentRecord({ userId, ...input, at });
    this.consents.add(consent);
    this.deps.metrics.inc(IDENTITY_METRIC.consentsRecorded);
    this.deps.events.emit({
      name: "ConsentRecorded", at, userId, data: { kind: input.kind, granted: input.granted },
    });
    this.record(userId, "consent.recorded", { kind: input.kind, granted: input.granted });
    return consent;
  }
  listConsents(userId: string): readonly ConsentRecord[] {
    return Object.freeze([...this.consents.forUser(userId)].sort((a, b) => a.at - b.at));
  }
  consentLedger(userId: string) { return consentLedger(this.listConsents(userId)); }
  hasConsent(userId: string, kind: ConsentKind): boolean {
    return hasConsent(this.listConsents(userId), kind);
  }
  canViewProfile(userId: string, viewer: { isSelf: boolean; isCompanion: boolean }): boolean {
    return canViewProfile(this.getPrivacySettings(userId), viewer);
  }
  requestDataExport(userId: string, scopes?: readonly string[]): DataExportRequest {
    this.requireUser(userId);
    const at = this.now();
    const request = makeDataExportRequest({ userId, scopes, at });
    this.exports.add(request);
    this.deps.events.emit({ name: "DataExportRequested", at, userId, data: { id: request.id } });
    return request;
  }
  /** Produces export *metadata only* — never the raw payload. */
  completeDataExport(requestId: string): DataExportRequest {
    const request = this.exports.get(requestId);
    if (!request) throw new IdentityValidationError(`Unknown export request: ${requestId}`);
    const userId = request.userId;
    const next = completeExportRequest(request, {
      profile: this.profiles.get(userId) ? 1 : 0,
      preferences: this.preferences.get(userId) ? 1 : 0,
      favorites: this.favorites.countForUser(userId),
      savedJourneys: this.journeys.countForUser(userId),
      consents: this.consents.countForUser(userId),
      deviceSessions: this.sessions.countForUser(userId),
    }, this.now());
    this.exports.replace(next);
    return next;
  }
  requestDataDeletion(userId: string, reason?: string): DataDeletionRequest {
    this.requireUser(userId);
    const at = this.now();
    const request = makeDataDeletionRequest({ userId, reason, at });
    this.deletions.add(request);
    this.deps.events.emit({ name: "DataDeletionRequested", at, userId, data: { id: request.id } });
    return request;
  }
  fulfilDataDeletion(requestId: string): DataDeletionRequest {
    const request = this.deletions.get(requestId);
    if (!request) throw new IdentityValidationError(`Unknown deletion request: ${requestId}`);
    const next = completeDeletionRequest(request, this.now());
    this.setUserStatus(request.userId, "deleted");
    this.deletions.replace(next);
    return next;
  }

  // ------------------------------------------------------- device sessions
  startSession(input: {
    userId: string; device?: DeviceSession["device"]; label?: string;
    locale?: string | null; timezone?: string | null; ttlMs?: number;
  }): DeviceSession {
    this.requireUser(input.userId);
    const at = this.now();
    const session = makeDeviceSession({
      ...input, at, ttlMs: input.ttlMs ?? this.deps.config.deviceSessionTtlMs,
    });
    this.sessions.add(session);
    this.deps.metrics.inc(IDENTITY_METRIC.sessionsStarted);
    this.deps.events.emit({
      name: "DeviceSessionStarted", at, userId: input.userId, data: { id: session.id },
    });
    return session;
  }
  touchSession(id: string): DeviceSession {
    const session = this.sessions.get(id);
    if (!session) throw new UnknownDeviceSessionError(id);
    const next = touchSession(session, this.now(), this.deps.config.deviceSessionTtlMs);
    this.sessions.replace(next);
    this.deps.events.emit({
      name: "DeviceSessionTouched", at: next.lastSeenAt, userId: next.userId, data: { id },
    });
    return next;
  }
  revokeSession(id: string): DeviceSession {
    const session = this.sessions.get(id);
    if (!session) throw new UnknownDeviceSessionError(id);
    const next = revokeSession(session, this.now());
    this.sessions.replace(next);
    this.deps.metrics.inc(IDENTITY_METRIC.sessionsRevoked);
    this.deps.events.emit({ name: "DeviceSessionRevoked", at: this.now(), userId: next.userId, data: { id } });
    return next;
  }
  listSessions(userId: string, onlyActive = false): readonly DeviceSession[] {
    const all = this.sessions.forUser(userId);
    return onlyActive ? activeSessions(all, this.now()) : Object.freeze([...all]);
  }
  isSessionActive(id: string): boolean {
    const s = this.sessions.get(id);
    return s ? isSessionActive(s, this.now()) : false;
  }

  // -------------------------------------------------- companions/contacts
  addCompanion(input: Parameters<typeof makeTravelCompanion>[0]): TravelCompanion {
    this.requireUser(input.userId);
    const companion = makeTravelCompanion({ ...input, at: this.now() });
    this.companions.add(companion);
    this.deps.events.emit({
      name: "CompanionAdded", at: companion.createdAt, userId: input.userId, data: { id: companion.id },
    });
    return companion;
  }
  listCompanions(userId: string): readonly TravelCompanion[] {
    return Object.freeze([...this.companions.forUser(userId)]);
  }
  addEmergencyContact(input: Parameters<typeof makeEmergencyContact>[0]): EmergencyContact {
    this.requireUser(input.userId);
    const contact = makeEmergencyContact({ ...input, at: this.now() });
    this.emergencyContacts.add(contact);
    this.deps.events.emit({
      name: "EmergencyContactAdded", at: contact.createdAt, userId: input.userId, data: { id: contact.id },
    });
    return contact;
  }
  listEmergencyContacts(userId: string): readonly EmergencyContact[] {
    return Object.freeze(
      [...this.emergencyContacts.forUser(userId)].sort((a, b) => a.priority - b.priority),
    );
  }

  // ------------------------------------------------------- personalization
  personalizationFor(userId: string): PersonalizationProfile {
    const t0 = this.now();
    const profile = buildPersonalizationProfile({
      userId,
      preferences: this.getPreferences(userId),
      favorites: this.listFavorites(userId),
      journeys: this.listJourneys(userId),
      privacy: this.getPrivacySettings(userId),
      consents: this.listConsents(userId),
      config: this.deps.config,
      at: t0,
    });
    this.deps.metrics.inc(IDENTITY_METRIC.personalizationBuilds);
    this.deps.metrics.observe(IDENTITY_METRIC.personalizationLatency, Math.max(0, this.now() - t0));
    this.deps.events.emit({
      name: "PersonalizationBuilt", at: t0, userId,
      data: { fingerprint: profile.fingerprint, suppressed: profile.suppressed },
    });
    return profile;
  }

  userContext(userId: string): UserContext {
    const user = this.requireUser(userId);
    const prefs = this.getPreferences(userId);
    const privacy = this.getPrivacySettings(userId);
    this.deps.metrics.inc(IDENTITY_METRIC.preferenceUsage);
    return deepFreeze({
      userId,
      locale: prefs.preferredLanguage,
      currency: prefs.preferredCurrency,
      timezone: prefs.preferredTimezone,
      status: user.status,
      personalization: this.personalizationFor(userId),
      favoriteCount: this.favorites.countForUser(userId),
      savedJourneyCount: this.journeys.countForUser(userId),
      notificationChannels: prefs.preferredNotificationChannels,
      privacy,
    });
  }

  /** Publishes the user context to the Agent Runtime through its port. */
  async publishUserContext(userId: string): Promise<UserContext> {
    const context = this.userContext(userId);
    if (!personalizationAllowed(context.privacy, this.listConsents(userId))) {
      if (context.privacy.allowPersonalization === false && context.personalization.suppressed === false) {
        throw new IdentityPrivacyError("personalization suppressed", { userId });
      }
    }
    await this.deps.ports.agent?.publishUserContext(userId, context as unknown as Record<string, unknown>);
    await this.deps.ports.memory?.remember({
      userId,
      namespace: "identity.context",
      key: context.personalization.fingerprint,
      value: { locale: context.locale, currency: context.currency, timezone: context.timezone },
      importance: 0.6,
    });
    return context;
  }

  // ------------------------------------------------------------- auditing
  history(userId: string): readonly IdentityHistoryEntry[] {
    return Object.freeze([...(this.historyByUser.get(userId) ?? [])]);
  }

  snapshot(): IdentitySnapshot {
    return deepFreeze({
      at: this.now(),
      users: this.users.size(),
      favorites: this.favorites.size(),
      savedJourneys: this.journeys.size(),
      deviceSessions: this.sessions.size(),
      consents: this.consents.size(),
    });
  }

  clear(): void {
    this.users.clear(); this.profiles.clear(); this.preferences.clear();
    this.settings.clear(); this.notifications.clear(); this.privacy.clear();
    this.favorites.clear(); this.journeys.clear(); this.companions.clear();
    this.emergencyContacts.clear(); this.sessions.clear(); this.consents.clear();
    this.exports.clear(); this.deletions.clear();
    this.versions.clear(); this.notes.clear(); this.historyByUser.clear();
  }
}
