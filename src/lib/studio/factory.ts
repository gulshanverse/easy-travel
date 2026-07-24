/** JSR — factory. */
import { StudioEventBus } from "./events";
import { StudioMetrics } from "./metrics";
import { JourneyStudioRegistry } from "./registry";
import { JourneyStudioManager } from "./manager";
import { PresentationEngine } from "./presentation";
import { noopStudioAgentPort, type StudioAgentPort } from "./ports";
import { noopStudioTelemetry, type StudioTelemetrySink } from "./telemetry";
import { mergeStudioConfig, type StudioConfig } from "./config";
import { mergeStudioPolicies, type StudioPolicies } from "./policies";

export interface StudioFactoryOptions {
  readonly config?: Partial<StudioConfig>;
  readonly policies?: Partial<StudioPolicies>;
  readonly agent?: StudioAgentPort;
  readonly telemetry?: StudioTelemetrySink;
  readonly now?: () => number;
}

export interface JourneyStudioFactoryDeps {
  readonly config: StudioConfig;
  readonly policies: StudioPolicies;
  readonly registry: JourneyStudioRegistry;
  readonly events: StudioEventBus;
  readonly metrics: StudioMetrics;
  readonly telemetry: StudioTelemetrySink;
  readonly agent: StudioAgentPort;
  readonly presentation: PresentationEngine;
}

export function createStudioDeps(options: StudioFactoryOptions = {}): JourneyStudioFactoryDeps {
  return {
    config: mergeStudioConfig(options.config),
    policies: mergeStudioPolicies(options.policies),
    registry: new JourneyStudioRegistry(),
    events: new StudioEventBus(),
    metrics: new StudioMetrics(),
    telemetry: options.telemetry ?? noopStudioTelemetry,
    agent: options.agent ?? noopStudioAgentPort,
    presentation: new PresentationEngine(),
  };
}

export function createStudioManager(deps: JourneyStudioFactoryDeps): JourneyStudioManager {
  return new JourneyStudioManager(deps);
}
