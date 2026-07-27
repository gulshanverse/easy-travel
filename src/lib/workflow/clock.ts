/** WAR — clock abstraction (deterministic testing clock, no OS cron). */
export interface WorkflowClock {
  now(): number;
  /** Registers a callback fired whenever time advances (test clock only). */
  onAdvance?(cb: (now: number) => void): () => void;
}

export class SystemClock implements WorkflowClock {
  now(): number {
    return Date.now();
  }
}

export class TestClock implements WorkflowClock {
  private current: number;
  private readonly listeners: Array<(now: number) => void> = [];
  constructor(startMs = 0) {
    this.current = startMs;
  }
  now(): number {
    return this.current;
  }
  set(ms: number): void {
    this.current = ms;
    this.notify();
  }
  advance(ms: number): number {
    this.current += Math.max(0, ms);
    this.notify();
    return this.current;
  }
  onAdvance(cb: (now: number) => void): () => void {
    this.listeners.push(cb);
    return () => {
      const i = this.listeners.indexOf(cb);
      if (i >= 0) this.listeners.splice(i, 1);
    };
  }
  private notify(): void {
    for (const l of [...this.listeners]) l(this.current);
  }
}
