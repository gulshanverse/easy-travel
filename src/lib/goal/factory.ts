/**
 * Goal Engine — factory for wiring a GoalManager with default deps.
 */
import { mergeGoalConfig, type GoalConfig } from "./config";
import { GoalEventBus } from "./events";
import { GoalManager } from "./manager";
import { GoalMetrics } from "./metrics";
import { noopGoalTelemetry, type GoalTelemetrySink } from "./telemetry";

export interface GoalFactoryOptions {
  readonly config?: Partial<GoalConfig>;
  readonly telemetry?: GoalTelemetrySink;
  readonly events?: GoalEventBus;
  readonly metrics?: GoalMetrics;
  readonly now?: () => number;
}

export function createGoalManager(options: GoalFactoryOptions = {}): GoalManager {
  return new GoalManager({
    config: mergeGoalConfig(options.config),
    telemetry: options.telemetry ?? noopGoalTelemetry,
    events: options.events ?? new GoalEventBus(),
    metrics: options.metrics ?? new GoalMetrics(),
    now: options.now ?? (() => Date.now()),
  });
}
