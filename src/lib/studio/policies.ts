/** JSR — governance policies (presentation-layer only). */
export interface StudioPolicies {
  readonly allowGuestObservers: boolean;
  readonly requireOwnerForArchive: boolean;
  readonly lockRequiredForEdit: boolean;
  readonly maxLockDurationMs: number;
}
export const DEFAULT_STUDIO_POLICIES: StudioPolicies = Object.freeze({
  allowGuestObservers: true,
  requireOwnerForArchive: true,
  lockRequiredForEdit: false,
  maxLockDurationMs: 1000 * 60 * 10,
});
export function mergeStudioPolicies(p?: Partial<StudioPolicies>): StudioPolicies {
  return Object.freeze({ ...DEFAULT_STUDIO_POLICIES, ...(p ?? {}) });
}
