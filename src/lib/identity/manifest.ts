/**
 * Identity Platform — Engine Contract & Capability Manifest (ADR-019/022).
 */
export interface EngineContract {
  readonly engine: string;
  readonly version: string;
  readonly ownership: readonly string[];
  readonly responsibilities: readonly string[];
  readonly dependencies: readonly string[];
  readonly consumedEvents: readonly string[];
  readonly publishedEvents: readonly string[];
  readonly publicApis: readonly string[];
  readonly extensionPoints: readonly string[];
  readonly futureHooks: readonly string[];
  readonly integrationContracts: Readonly<Record<string, string>>;
  readonly prohibited: readonly string[];
}

export const IDENTITY_ENGINE_CONTRACT: EngineContract = Object.freeze({
  engine: "identity",
  version: "1.0.0",
  ownership: Object.freeze([
    "identity.users", "identity.profiles", "identity.preferences",
    "identity.travel_profiles", "identity.preference_resolution",
    "identity.preference_confidence", "identity.personalization",
    "identity.statistics", "identity.favorites", "identity.saved_journeys",
    "identity.notifications", "identity.privacy", "identity.sessions",
  ]),
  responsibilities: Object.freeze([
    "Own user identity, preferences and personalization deterministically.",
    "Resolve preferences with priority, fallback and conflict explanation.",
    "Publish an immutable personalization context to downstream engines.",
    "Never select, rank, price or book travel options.",
  ]),
  dependencies: Object.freeze([
    "agent.port", "workflow.port", "studio.port", "memory.port", "kernel.port",
  ]),
  consumedEvents: Object.freeze([
    "AgentContextRequested", "WorkflowCompleted", "StudioSessionOpened", "MemoryStored",
  ]),
  publishedEvents: Object.freeze([
    "UserCreated", "UserUpdated", "UserStatusChanged", "UserDeleted",
    "ProfileUpdated", "PreferencesUpdated", "SettingsUpdated",
    "TravelProfileCreated", "TravelProfileUpdated", "TravelProfileActivated",
    "PreferencesResolved", "PreferenceConflictDetected",
    "FavoriteAdded", "FavoriteRemoved",
    "JourneySaved", "JourneyUpdated", "JourneyArchived", "JourneyRestored",
    "JourneyDuplicated", "JourneyShared",
    "NotificationSettingsUpdated", "PrivacySettingsUpdated", "ConsentRecorded",
    "PersonalizationBuilt", "PersonalizationContextPublished",
    "StatisticsComputed", "SessionStarted", "SessionRevoked",
    "DataExportRequested", "DataDeletionRequested",
  ]),
  publicApis: Object.freeze([
    "IdentityRuntime.createUser", "IdentityRuntime.updateProfile",
    "IdentityRuntime.updatePreferences", "IdentityRuntime.observePreference",
    "IdentityRuntime.adoptProfile", "IdentityRuntime.updateTravelProfile",
    "IdentityRuntime.activateProfile", "IdentityRuntime.resolvePreferences",
    "IdentityRuntime.personalizationContext", "IdentityRuntime.statisticsFor",
    "IdentityRuntime.addFavorite", "IdentityRuntime.saveJourney",
    "IdentityRuntime.shareJourney", "IdentityRuntime.cards",
    "IdentityRuntime.snapshot", "IdentityRuntime.health",
  ]),
  extensionPoints: Object.freeze([
    "identity.profile.template", "identity.preference.resolver",
    "identity.statistics.model", "identity.telemetry.sink",
    "identity.event.listener", "identity.presentation.card",
  ]),
  futureHooks: Object.freeze([
    "identity.persistence.adapter", "identity.federated.identity",
    "identity.loyalty.programs", "identity.enterprise.travel_policy",
    "identity.social.graph",
  ]),
  integrationContracts: Object.freeze({
    agent: "IdentityAgentPort",
    workflow: "IdentityWorkflowPort",
    studio: "IdentityStudioPort",
    memory: "IdentityMemoryPort",
    kernel: "IdentityKernelPort",
  }),
  prohibited: Object.freeze([
    "connector.*", "provider.*", "railway.*", "multimodal.*",
    "http", "fetch", "database", "storage",
  ]),
});

export interface IdentityCapabilityManifest {
  readonly id: "identity";
  readonly version: string;
  readonly capabilities: readonly string[];
  readonly personalizationFeatures: readonly string[];
  readonly privacyFeatures: readonly string[];
  readonly metrics: readonly string[];
  readonly dependencies: readonly string[];
  readonly extensionPoints: readonly string[];
  readonly futureHooks: readonly string[];
}

export const IDENTITY_CAPABILITY_MANIFEST: IdentityCapabilityManifest = Object.freeze({
  id: "identity",
  version: "1.0.0",
  capabilities: Object.freeze([
    "identity.user.crud", "identity.user.lifecycle", "identity.profile.crud",
    "identity.preferences.crud", "identity.preferences.confidence",
    "identity.preferences.resolution", "identity.travel_profiles",
    "identity.personalization.context", "identity.personalization.signals",
    "identity.statistics", "identity.favorites", "identity.saved_journeys",
    "identity.journey.sharing", "identity.notifications", "identity.privacy",
    "identity.consent", "identity.sessions", "identity.export", "identity.deletion",
    "identity.presentation.cards", "identity.snapshot", "identity.history",
  ]),
  personalizationFeatures: Object.freeze([
    "deterministic.signals", "auditable.fingerprint", "source.priority",
    "fallback.chains", "conflict.explanation", "context.versioning", "context.diff",
  ]),
  privacyFeatures: Object.freeze([
    "consent.ledger", "personalization.suppression", "profile.visibility",
    "data.export", "data.deletion", "session.revocation",
  ]),
  metrics: Object.freeze([
    "identity.users.created", "identity.preferences.updated",
    "identity.personalization.builds", "identity.personalization.latency",
    "identity.favorites.added", "identity.journeys.saved",
    "identity.context.published", "identity.statistics.computed",
  ]),
  dependencies: Object.freeze([
    "agent.port", "workflow.port", "studio.port", "memory.port", "kernel.port",
  ]),
  extensionPoints: Object.freeze([
    "identity.profile.template", "identity.preference.resolver",
    "identity.statistics.model", "identity.telemetry.sink",
    "identity.event.listener", "identity.presentation.card",
  ]),
  futureHooks: Object.freeze([
    "identity.persistence.adapter", "identity.federated.identity",
    "identity.loyalty.programs", "identity.enterprise.travel_policy",
    "identity.social.graph",
  ]),
});
