/**
 * Journey Runtime — Configuration & Policies.
 * Immutable configuration objects consumed by the runtime facade. Environment
 * bindings live in the composition root — this file must be side-effect free.
 */

import { JourneyConfigurationError } from "./errors";

export interface JourneyPolicies {
  readonly maxJourneysPerProcess: number;
  readonly maxStagesPerJourney: number;
  readonly maxConstraintsPerJourney: number;
  readonly maxIntentHistory: number;
  readonly maxSnapshotsPerJourney: number;
  readonly allowDynamicCreation: boolean;
  readonly requireOwnership: boolean;
  readonly strictValidation: boolean;
}

export const DEFAULT_JOURNEY_POLICIES: JourneyPolicies = Object.freeze({
  maxJourneysPerProcess: 1024,
  maxStagesPerJourney: 64,
  maxConstraintsPerJourney: 64,
  maxIntentHistory: 32,
  maxSnapshotsPerJourney: 64,
  allowDynamicCreation: true,
  requireOwnership: true,
  strictValidation: true,
});

export interface JourneyContextBudget {
  readonly maxMemoryItems: number;
  readonly maxGraphExpansions: number;
  readonly assemblyTimeoutMs: number;
}

export const DEFAULT_CONTEXT_BUDGET: JourneyContextBudget = Object.freeze({
  maxMemoryItems: 64,
  maxGraphExpansions: 128,
  assemblyTimeoutMs: 2_000,
});

export interface JourneyConfiguration {
  readonly namespace: string;
  readonly policies: JourneyPolicies;
  readonly context: JourneyContextBudget;
  readonly telemetry: { readonly enabled: boolean; readonly sampleRate: number };
}

export function defineJourneyConfig(
  partial: Partial<JourneyConfiguration> & { namespace: string },
): JourneyConfiguration {
  if (!partial.namespace || !/^[a-z0-9][a-z0-9._-]{1,63}$/i.test(partial.namespace)) {
    throw new JourneyConfigurationError("namespace must be 2-64 chars [a-z0-9._-]", {
      namespace: partial.namespace,
    });
  }
  const cfg: JourneyConfiguration = {
    namespace: partial.namespace,
    policies: { ...DEFAULT_JOURNEY_POLICIES, ...partial.policies },
    context: { ...DEFAULT_CONTEXT_BUDGET, ...partial.context },
    telemetry: {
      enabled: partial.telemetry?.enabled ?? true,
      sampleRate: partial.telemetry?.sampleRate ?? 1,
    },
  };
  if (cfg.telemetry.sampleRate < 0 || cfg.telemetry.sampleRate > 1) {
    throw new JourneyConfigurationError("telemetry.sampleRate must be in [0,1]");
  }
  if (cfg.policies.maxJourneysPerProcess <= 0) {
    throw new JourneyConfigurationError("maxJourneysPerProcess must be > 0");
  }
  return Object.freeze(cfg);
}
