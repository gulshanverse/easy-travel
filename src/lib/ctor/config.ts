/** CTOR — configuration. */
export interface CTORConfig {
  readonly defaultTimeoutMs: number;
  readonly defaultRetries: number;
  readonly defaultBackoffMs: number;
  readonly defaultBackoffFactor: number;
  readonly maxConcurrency: number;
  readonly maxWorkflowSteps: number;
  readonly maxCapabilities: number;
  readonly maxTools: number;
  readonly maxHistory: number;
}
export const DEFAULT_CTOR_CONFIG: CTORConfig = Object.freeze({
  defaultTimeoutMs: 30_000,
  defaultRetries: 0,
  defaultBackoffMs: 100,
  defaultBackoffFactor: 2,
  maxConcurrency: 32,
  maxWorkflowSteps: 512,
  maxCapabilities: 1024,
  maxTools: 2048,
  maxHistory: 256,
});
export function mergeCTORConfig(patch: Partial<CTORConfig> = {}): CTORConfig {
  return Object.freeze({ ...DEFAULT_CTOR_CONFIG, ...patch });
}
export function defineCTORConfig(patch: Partial<CTORConfig> = {}): CTORConfig {
  return mergeCTORConfig(patch);
}
