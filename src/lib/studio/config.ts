/** JSR — configuration. */
export interface StudioConfig {
  readonly maxCardsPerWorkspace: number;
  readonly maxTimelineItems: number;
  readonly maxRevisionsPerSession: number;
  readonly maxCheckpointsPerSession: number;
  readonly maxParticipantsPerSession: number;
  readonly defaultSessionTtlMs: number;
  readonly historyLimit: number;
}
export const DEFAULT_STUDIO_CONFIG: StudioConfig = Object.freeze({
  maxCardsPerWorkspace: 500,
  maxTimelineItems: 2000,
  maxRevisionsPerSession: 200,
  maxCheckpointsPerSession: 100,
  maxParticipantsPerSession: 32,
  defaultSessionTtlMs: 1000 * 60 * 60 * 24,
  historyLimit: 1024,
});
export function mergeStudioConfig(p?: Partial<StudioConfig>): StudioConfig {
  return Object.freeze({ ...DEFAULT_STUDIO_CONFIG, ...(p ?? {}) });
}
