/** WAR — metrics registry (workflow, execution, scheduler, retry, checkpoint, latency). */
export interface WorkflowMetricsSnapshot {
  readonly definitionsRegistered: number;
  readonly instancesCreated: number;
  readonly instancesStarted: number;
  readonly instancesCompleted: number;
  readonly instancesFailed: number;
  readonly instancesCancelled: number;
  readonly instancesPaused: number;
  readonly stepsExecuted: number;
  readonly stepsFailed: number;
  readonly stepsSkipped: number;
  readonly retries: number;
  readonly timeouts: number;
  readonly compensations: number;
  readonly checkpoints: number;
  readonly timersScheduled: number;
  readonly timersFired: number;
  readonly signalsDelivered: number;
  readonly schedulerTicks: number;
  readonly totalExecutionMs: number;
  readonly averageExecutionMs: number;
  readonly maxExecutionMs: number;
}

export class WorkflowMetrics {
  private c: Record<string, number> = {};
  private durations: number[] = [];
  private inc(k: string, n = 1): void { this.c[k] = (this.c[k] ?? 0) + n; }

  definitionRegistered(): void { this.inc("definitionsRegistered"); }
  instanceCreated(): void { this.inc("instancesCreated"); }
  instanceStarted(): void { this.inc("instancesStarted"); }
  instanceCompleted(ms: number): void { this.inc("instancesCompleted"); this.durations.push(ms); }
  instanceFailed(ms: number): void { this.inc("instancesFailed"); this.durations.push(ms); }
  instanceCancelled(): void { this.inc("instancesCancelled"); }
  instancePaused(): void { this.inc("instancesPaused"); }
  stepExecuted(): void { this.inc("stepsExecuted"); }
  stepFailed(): void { this.inc("stepsFailed"); }
  stepSkipped(): void { this.inc("stepsSkipped"); }
  retry(): void { this.inc("retries"); }
  timeout(): void { this.inc("timeouts"); }
  compensation(): void { this.inc("compensations"); }
  checkpoint(): void { this.inc("checkpoints"); }
  timerScheduled(): void { this.inc("timersScheduled"); }
  timerFired(): void { this.inc("timersFired"); }
  signalDelivered(): void { this.inc("signalsDelivered"); }
  schedulerTick(): void { this.inc("schedulerTicks"); }

  snapshot(): WorkflowMetricsSnapshot {
    const total = this.durations.reduce((a, b) => a + b, 0);
    const g = (k: string) => this.c[k] ?? 0;
    return Object.freeze({
      definitionsRegistered: g("definitionsRegistered"),
      instancesCreated: g("instancesCreated"),
      instancesStarted: g("instancesStarted"),
      instancesCompleted: g("instancesCompleted"),
      instancesFailed: g("instancesFailed"),
      instancesCancelled: g("instancesCancelled"),
      instancesPaused: g("instancesPaused"),
      stepsExecuted: g("stepsExecuted"),
      stepsFailed: g("stepsFailed"),
      stepsSkipped: g("stepsSkipped"),
      retries: g("retries"),
      timeouts: g("timeouts"),
      compensations: g("compensations"),
      checkpoints: g("checkpoints"),
      timersScheduled: g("timersScheduled"),
      timersFired: g("timersFired"),
      signalsDelivered: g("signalsDelivered"),
      schedulerTicks: g("schedulerTicks"),
      totalExecutionMs: total,
      averageExecutionMs: this.durations.length ? total / this.durations.length : 0,
      maxExecutionMs: this.durations.length ? Math.max(...this.durations) : 0,
    });
  }
  reset(): void { this.c = {}; this.durations = []; }
}
