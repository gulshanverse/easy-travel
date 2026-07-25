/** IPCF — polling runtime + scheduler. In-memory, no timers by default. */
import { IntegrationNotFoundError, IntegrationValidationError } from "./errors";
import type { PollingJob } from "./types";

export class PollingRegistry {
  private readonly jobs = new Map<string, PollingJob>();
  register(job: PollingJob): void { this.jobs.set(job.id, job); }
  get(id: string): PollingJob | undefined { return this.jobs.get(id); }
  require(id: string): PollingJob {
    const j = this.jobs.get(id);
    if (!j) throw new IntegrationNotFoundError("polling job", id);
    return j;
  }
  update(job: PollingJob): void {
    if (!this.jobs.has(job.id)) throw new IntegrationNotFoundError("polling job", job.id);
    this.jobs.set(job.id, job);
  }
  remove(id: string): boolean { return this.jobs.delete(id); }
  list(): readonly PollingJob[] { return [...this.jobs.values()]; }
  clear(): void { this.jobs.clear(); }
  size(): number { return this.jobs.size; }
}

export class PollingScheduler {
  constructor(
    private readonly registry: PollingRegistry,
    private readonly minIntervalMs = 250,
  ) {}

  /** Deterministic due-set at a given tick — no wall clock scheduling. */
  due(now = Date.now()): readonly PollingJob[] {
    return this.registry.list().filter(j => j.enabled && j.nextRunAt <= now);
  }
  /** Record a run — advances nextRunAt and increments counter. */
  markRun(id: string, now = Date.now()): PollingJob {
    const j = this.registry.require(id);
    if (j.intervalMs < this.minIntervalMs) {
      throw new IntegrationValidationError(`interval ${j.intervalMs}ms < min ${this.minIntervalMs}ms`);
    }
    const next: PollingJob = Object.freeze({ ...j, lastRunAt: now, nextRunAt: now + j.intervalMs, runs: j.runs + 1 });
    this.registry.update(next);
    return next;
  }
  enable(id: string): PollingJob {
    const j = this.registry.require(id);
    const next: PollingJob = Object.freeze({ ...j, enabled: true });
    this.registry.update(next);
    return next;
  }
  disable(id: string): PollingJob {
    const j = this.registry.require(id);
    const next: PollingJob = Object.freeze({ ...j, enabled: false });
    this.registry.update(next);
    return next;
  }
}
