/** WAR — scheduler runtime: execution queue, timers, cron, delayed & recurring execution. */
import { newScheduleId } from "./ids";
import { WorkflowSchedulerError } from "./errors";
import type { WorkflowClock } from "./clock";
import type { WorkflowSchedule } from "./types";

export interface QueueEntry {
  readonly id: string;
  readonly dueAt: number;
  readonly priority: number;
  readonly seq: number;
  readonly kind: "timer" | "delay" | "interval" | "cron";
  readonly payload: Readonly<Record<string, unknown>>;
  readonly intervalMs?: number;
  readonly cron?: string;
}

/** Deterministic priority queue: dueAt → priority (lower first) → insertion order. */
export class ExecutionQueue {
  private items: QueueEntry[] = [];
  private seq = 0;

  push(e: Omit<QueueEntry, "seq">): QueueEntry {
    const entry: QueueEntry = Object.freeze({ ...e, seq: this.seq++ });
    this.items.push(entry);
    this.items.sort((a, b) =>
      a.dueAt - b.dueAt || a.priority - b.priority || a.seq - b.seq);
    return entry;
  }
  popDue(now: number): readonly QueueEntry[] {
    const due: QueueEntry[] = [];
    while (this.items.length && this.items[0].dueAt <= now) due.push(this.items.shift()!);
    return due;
  }
  remove(id: string): boolean {
    const before = this.items.length;
    this.items = this.items.filter(i => i.id !== id);
    return this.items.length < before;
  }
  peek(): QueueEntry | undefined { return this.items[0]; }
  size(): number { return this.items.length; }
  list(): readonly QueueEntry[] { return [...this.items]; }
  clear(): void { this.items = []; }
}

// ---------- Cron (5 fields: min hour dom mon dow) ----------
export interface CronExpression {
  readonly minutes: readonly number[];
  readonly hours: readonly number[];
  readonly daysOfMonth: readonly number[];
  readonly months: readonly number[];
  readonly daysOfWeek: readonly number[];
}

function parseField(field: string, min: number, max: number): readonly number[] {
  const out = new Set<number>();
  for (const part of field.split(",")) {
    const [rangePart, stepPart] = part.split("/");
    const step = stepPart ? Number(stepPart) : 1;
    if (!Number.isInteger(step) || step < 1) throw new WorkflowSchedulerError(`Invalid cron step: ${part}`);
    let lo = min, hi = max;
    if (rangePart !== "*") {
      const bounds = rangePart.split("-").map(Number);
      if (bounds.some(n => !Number.isInteger(n))) throw new WorkflowSchedulerError(`Invalid cron field: ${part}`);
      lo = bounds[0];
      hi = bounds.length > 1 ? bounds[1] : bounds[0];
    }
    if (lo < min || hi > max || lo > hi) throw new WorkflowSchedulerError(`Cron field out of range: ${part}`);
    for (let v = lo; v <= hi; v += step) out.add(v);
  }
  return Object.freeze([...out].sort((a, b) => a - b));
}

export function parseCron(expr: string): CronExpression {
  const f = expr.trim().split(/\s+/);
  if (f.length !== 5) throw new WorkflowSchedulerError(`Cron expression must have 5 fields: ${expr}`);
  return Object.freeze({
    minutes: parseField(f[0], 0, 59),
    hours: parseField(f[1], 0, 23),
    daysOfMonth: parseField(f[2], 1, 31),
    months: parseField(f[3], 1, 12),
    daysOfWeek: parseField(f[4], 0, 6),
  });
}

const MINUTE = 60_000;

/** Next UTC occurrence strictly after `fromMs`. Pure, no OS cron. */
export function nextCronRun(expr: string, fromMs: number): number {
  const c = parseCron(expr);
  let t = Math.floor(fromMs / MINUTE) * MINUTE + MINUTE;
  const limit = t + 366 * 24 * 60 * MINUTE;
  while (t <= limit) {
    const d = new Date(t);
    if (
      c.minutes.includes(d.getUTCMinutes()) &&
      c.hours.includes(d.getUTCHours()) &&
      c.months.includes(d.getUTCMonth() + 1) &&
      c.daysOfMonth.includes(d.getUTCDate()) &&
      c.daysOfWeek.includes(d.getUTCDay())
    ) return t;
    t += MINUTE;
  }
  throw new WorkflowSchedulerError(`Cron expression never fires within a year: ${expr}`);
}

export class CronScheduler {
  next(expr: string, fromMs: number): number { return nextCronRun(expr, fromMs); }
  validate(expr: string): boolean { try { parseCron(expr); return true; } catch { return false; } }
}

export type SchedulerHandler = (entry: QueueEntry, now: number) => void | Promise<void>;

export class TimerManager {
  constructor(private readonly queue: ExecutionQueue, private readonly clock: WorkflowClock) {}
  after(delayMs: number, payload: Readonly<Record<string, unknown>>, priority = 5): QueueEntry {
    return this.queue.push({
      id: newScheduleId(), dueAt: this.clock.now() + Math.max(0, delayMs),
      priority, kind: "timer", payload,
    });
  }
  at(dueAt: number, payload: Readonly<Record<string, unknown>>, priority = 5): QueueEntry {
    return this.queue.push({ id: newScheduleId(), dueAt, priority, kind: "timer", payload });
  }
  cancel(id: string): boolean { return this.queue.remove(id); }
  pending(): number { return this.queue.size(); }
}

export class Scheduler {
  readonly queue = new ExecutionQueue();
  readonly timers: TimerManager;
  readonly cron = new CronScheduler();
  private handler: SchedulerHandler = () => undefined;
  private readonly schedules = new Map<string, WorkflowSchedule>();
  private ticks = 0;

  constructor(private readonly clock: WorkflowClock) {
    this.timers = new TimerManager(this.queue, clock);
  }

  onDue(handler: SchedulerHandler): void { this.handler = handler; }

  /** Delayed one-shot execution. */
  scheduleDelayed(definitionId: string, delayMs: number, payload: Readonly<Record<string, unknown>> = {}, priority = 5): WorkflowSchedule {
    const dueAt = this.clock.now() + Math.max(0, delayMs);
    const entry = this.queue.push({ id: newScheduleId(), dueAt, priority, kind: "delay", payload: { ...payload, definitionId } });
    return this.remember({ id: entry.id, definitionId, kind: "delay", dueAt, payload });
  }
  /** Recurring execution. */
  scheduleRecurring(definitionId: string, intervalMs: number, payload: Readonly<Record<string, unknown>> = {}, priority = 5): WorkflowSchedule {
    if (intervalMs <= 0) throw new WorkflowSchedulerError("intervalMs must be > 0");
    const dueAt = this.clock.now() + intervalMs;
    const entry = this.queue.push({ id: newScheduleId(), dueAt, priority, kind: "interval", intervalMs, payload: { ...payload, definitionId } });
    return this.remember({ id: entry.id, definitionId, kind: "interval", dueAt, intervalMs, payload });
  }
  /** Cron-based execution (pure, clock-driven). */
  scheduleCron(definitionId: string, cron: string, payload: Readonly<Record<string, unknown>> = {}, priority = 5): WorkflowSchedule {
    const dueAt = this.cron.next(cron, this.clock.now());
    const entry = this.queue.push({ id: newScheduleId(), dueAt, priority, kind: "cron", cron, payload: { ...payload, definitionId } });
    return this.remember({ id: entry.id, definitionId, kind: "cron", dueAt, cron, payload });
  }

  cancel(id: string): boolean { this.schedules.delete(id); return this.queue.remove(id); }
  list(): readonly WorkflowSchedule[] { return [...this.schedules.values()].sort((a, b) => a.dueAt - b.dueAt); }
  pending(): number { return this.queue.size(); }
  tickCount(): number { return this.ticks; }

  /** Runs all entries due at `now` (defaults to clock time). Deterministic ordering. */
  async tick(now = this.clock.now()): Promise<number> {
    this.ticks += 1;
    const due = this.queue.popDue(now);
    for (const entry of due) {
      if (entry.kind === "interval" && entry.intervalMs) {
        this.queue.push({ ...entry, id: entry.id, dueAt: now + entry.intervalMs });
      } else if (entry.kind === "cron" && entry.cron) {
        this.queue.push({ ...entry, id: entry.id, dueAt: this.cron.next(entry.cron, now) });
      } else {
        this.schedules.delete(entry.id);
      }
      await this.handler(entry, now);
    }
    return due.length;
  }

  clear(): void { this.queue.clear(); this.schedules.clear(); }

  private remember(s: WorkflowSchedule): WorkflowSchedule {
    const frozen = Object.freeze({ ...s });
    this.schedules.set(frozen.id, frozen);
    return frozen;
  }
}
