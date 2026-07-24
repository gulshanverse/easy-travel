/** JSR — public runtime facade. */
import { createStudioDeps, createStudioManager, type StudioFactoryOptions, type JourneyStudioFactoryDeps } from "./factory";
import { JourneyStudioManager } from "./manager";
import type { StudioEventListener } from "./events";
import type { StudioMetricsSnapshot } from "./metrics";
import { collectStudioHealth, type StudioHealthReport } from "./health";

export class JourneyStudioRuntime {
  readonly deps: JourneyStudioFactoryDeps;
  readonly manager: JourneyStudioManager;
  constructor(options: StudioFactoryOptions = {}) {
    this.deps = createStudioDeps(options);
    this.manager = createStudioManager(this.deps);
  }
  onEvent(l: StudioEventListener): () => void { return this.deps.events.on(l); }
  metricsSnapshot(): StudioMetricsSnapshot { return this.deps.metrics.snapshot(); }
  health(): Promise<StudioHealthReport> { return collectStudioHealth(this.deps); }
  shutdown(): void {
    this.deps.registry.clear();
    this.deps.events.clear();
  }
}

export function createJourneyStudioRuntime(options: StudioFactoryOptions = {}): JourneyStudioRuntime {
  return new JourneyStudioRuntime(options);
}

export const JourneyStudioFacade = JourneyStudioRuntime;
