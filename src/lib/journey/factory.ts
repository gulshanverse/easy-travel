/**
 * JourneyFactory — constructs JourneyManagers from configuration and seed
 * journeys. Keeps DI wiring outside the manager itself.
 */

import type { JourneyConfiguration } from "./config";
import { JourneyEventBus } from "./events";
import { JourneyManager } from "./manager";
import { createInMemoryMetrics, createNoopTelemetry, type JourneyMetrics, type JourneyTelemetry } from "./telemetry";
import { createJourney } from "./factories";
import type { Journey } from "./types";

export interface JourneyFactoryOptions {
  readonly config: JourneyConfiguration;
  readonly bus?: JourneyEventBus;
  readonly metrics?: JourneyMetrics;
  readonly telemetry?: JourneyTelemetry;
}

export class JourneyFactory {
  private readonly bus: JourneyEventBus;
  private readonly metrics: JourneyMetrics;
  private readonly telemetry: JourneyTelemetry;

  constructor(private readonly opts: JourneyFactoryOptions) {
    this.bus = opts.bus ?? new JourneyEventBus();
    this.metrics = opts.metrics ?? createInMemoryMetrics();
    this.telemetry = opts.telemetry ?? createNoopTelemetry();
  }

  get eventBus(): JourneyEventBus { return this.bus; }
  get metricsSink(): JourneyMetrics { return this.metrics; }
  get telemetrySink(): JourneyTelemetry { return this.telemetry; }

  fromJourney(journey: Journey): JourneyManager {
    return new JourneyManager({
      config: this.opts.config,
      initial: journey,
      bus: this.bus,
      metrics: this.metrics,
      telemetry: this.telemetry,
    });
  }

  create(input: Parameters<typeof createJourney>[0]): JourneyManager {
    const journey = createJourney({ ...input, namespace: this.opts.config.namespace });
    return this.fromJourney(journey);
  }
}
