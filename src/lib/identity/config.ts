/**
 * Identity Platform — configuration & defaults.
 */
export interface IdentityConfig {
  readonly maxUsersPerProcess: number;
  readonly maxFavoritesPerUser: number;
  readonly maxSavedJourneysPerUser: number;
  readonly maxVersionsPerJourney: number;
  readonly maxNotesPerJourney: number;
  readonly maxTagsPerJourney: number;
  readonly maxCompanionsPerUser: number;
  readonly maxEmergencyContactsPerUser: number;
  readonly maxDeviceSessionsPerUser: number;
  readonly maxHistoryPerUser: number;
  readonly deviceSessionTtlMs: number;
  readonly personalization: {
    readonly transportWeight: number;
    readonly budgetWeight: number;
    readonly favoriteWeight: number;
    readonly localeWeight: number;
    readonly accessibilityWeight: number;
  };
}

export const DEFAULT_IDENTITY_CONFIG: IdentityConfig = Object.freeze({
  maxUsersPerProcess: 10_000,
  maxFavoritesPerUser: 512,
  maxSavedJourneysPerUser: 256,
  maxVersionsPerJourney: 64,
  maxNotesPerJourney: 128,
  maxTagsPerJourney: 32,
  maxCompanionsPerUser: 32,
  maxEmergencyContactsPerUser: 8,
  maxDeviceSessionsPerUser: 16,
  maxHistoryPerUser: 512,
  deviceSessionTtlMs: 1000 * 60 * 60 * 24 * 30,
  personalization: Object.freeze({
    transportWeight: 0.3,
    budgetWeight: 0.25,
    favoriteWeight: 0.2,
    localeWeight: 0.15,
    accessibilityWeight: 0.1,
  }),
});

export function mergeIdentityConfig(partial?: Partial<IdentityConfig>): IdentityConfig {
  if (!partial) return DEFAULT_IDENTITY_CONFIG;
  return Object.freeze({
    ...DEFAULT_IDENTITY_CONFIG,
    ...partial,
    personalization: Object.freeze({
      ...DEFAULT_IDENTITY_CONFIG.personalization,
      ...(partial.personalization ?? {}),
    }),
  });
}
