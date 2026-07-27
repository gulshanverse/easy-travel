/** WAR — WorkflowManager: instance lifecycle, signals, timers, recovery, statistics. */
import { WorkflowInstanceNotFoundError, WorkflowPolicyError } from "./errors";
import { makeWorkflowInstance } from "./factories";
import { appendHistory, replayWorkflow, type ReplayResult } from "./history";
import { isTerminal, transitionInstance } from "./lifecycle";
import { WorkflowConcurrencyLimiter, WorkflowRateLimiter } from "./policies";
import { WorkflowRegistry } from "./registry";
import { CheckpointManager, ExecutionRecovery, SnapshotManager } from "./checkpoint";
import { WorkflowStateMachineEngine } from "./state-machine";
import { Scheduler } from "./scheduler";
import type { WorkflowClock } from "./clock";
import type { WorkflowEventBus } from "./events";
import type { WorkflowMetrics } from "./metrics";
import type { WorkflowTelemetrySink } from "./telemetry";
import type { WorkflowAgentPort, WorkflowCtorPort, WorkflowIntegrationPort } from "./ports";
import type { WorkflowRuntimeConfig } from "./config";
import type {
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowInstance,
  WorkflowSnapshot,
  WorkflowStatistics,
  WorkflowVariables,
} from "./types";

export interface WorkflowManagerDeps {
  readonly config: WorkflowRuntimeConfig;
  readonly events: WorkflowEventBus;
  readonly metrics: WorkflowMetrics;
  readonly telemetry: WorkflowTelemetrySink;
  readonly clock: WorkflowClock;
  readonly ctor: WorkflowCtorPort;
  readonly agent: WorkflowAgentPort;
  readonly integration: WorkflowIntegrationPort;
}

export class WorkflowManager {
  readonly registry: WorkflowRegistry;
  readonly checkpoints: CheckpointManager;
  readonly snapshots = new SnapshotManager();
  readonly recovery: ExecutionRecovery;
  readonly scheduler: Scheduler;
  readonly engine: WorkflowStateMachineEngine;
  readonly rateLimiter = new WorkflowRateLimiter();
  readonly concurrency = new WorkflowConcurrencyLimiter();

  private readonly instances = new Map<string, WorkflowInstance>();

  constructor(private readonly deps: WorkflowManagerDeps) {
    this.registry = new WorkflowRegistry(deps.config.maxDefinitions);
    this.checkpoints = new CheckpointManager(deps.config.maxCheckpointsPerInstance);
    this.recovery = new ExecutionRecovery(this.checkpoints);
    this.scheduler = new Scheduler(deps.clock);
    this.engine = new WorkflowStateMachineEngine({
      events: deps.events,
      metrics: deps.metrics,
      telemetry: deps.telemetry,
      ctor: deps.ctor,
      agent: deps.agent,
      integration: deps.integration,
      checkpoints: this.checkpoints,
      now: () => deps.clock.now(),
      checkpointEveryStep: deps.config.checkpointEveryStep,
      maxHistoryPerInstance: deps.config.maxHistoryPerInstance,
    });
    this.scheduler.onDue(async (entry) => {
      const instanceId = entry.payload.instanceId as string | undefined;
      const definitionId = entry.payload.definitionId as string | undefined;
      if (instanceId && this.instances.has(instanceId)) {
        deps.metrics.timerFired();
        deps.events.emit({
          name: "TimerFired",
          instanceId,
          at: deps.clock.now(),
          data: { entryId: entry.id },
        });
        await this.fireTimer(instanceId);
      } else if (definitionId && this.registry.has(definitionId)) {
        deps.events.emit({
          name: "ScheduledEvent",
          definitionId,
          at: deps.clock.now(),
          data: { entryId: entry.id },
        });
        const inst = this.create(
          definitionId,
          (entry.payload.variables as WorkflowVariables) ?? {},
        );
        await this.start(inst.id);
      }
    });
  }

  // ---------- definitions ----------
  register(def: WorkflowDefinition): WorkflowDefinition {
    const d = this.registry.register(def);
    this.deps.metrics.definitionRegistered();
    this.deps.events.emit({
      name: "WorkflowRegistered",
      definitionId: d.id,
      at: this.deps.clock.now(),
    });
    return d;
  }

  // ---------- instances ----------
  create(
    definitionId: string,
    variables: WorkflowVariables = {},
    priority?: number,
  ): WorkflowInstance {
    const def = this.registry.get(definitionId);
    const now = this.deps.clock.now();
    if (!this.rateLimiter.allow(def.id, def.policy.rateLimitPerMinute, now)) {
      throw new WorkflowPolicyError(`Rate limit exceeded for workflow ${def.id}`);
    }
    const active = this.list().filter(
      (i) => i.definitionId === def.id && !isTerminal(i.state.status),
    ).length;
    if (active >= def.policy.maxConcurrentInstances) {
      throw new WorkflowPolicyError(`Max concurrent instances reached for ${def.id}`);
    }
    const inst = makeWorkflowInstance({ definition: def, variables, now, priority });
    this.instances.set(inst.id, inst);
    this.deps.metrics.instanceCreated();
    this.deps.events.emit({
      name: "WorkflowCreated",
      definitionId: def.id,
      instanceId: inst.id,
      correlationId: inst.correlationId,
      at: now,
    });
    return inst;
  }

  get(id: string): WorkflowInstance {
    const i = this.instances.get(id);
    if (!i) throw new WorkflowInstanceNotFoundError(id);
    return i;
  }
  find(id: string): WorkflowInstance | undefined {
    return this.instances.get(id);
  }
  list(): readonly WorkflowInstance[] {
    return [...this.instances.values()];
  }
  listByState(status: WorkflowInstance["state"]["status"]): readonly WorkflowInstance[] {
    return this.list().filter((i) => i.state.status === status);
  }

  async start(instanceId: string): Promise<WorkflowExecution> {
    const inst = this.get(instanceId);
    const def = this.registry.get(inst.definitionId);
    this.concurrency.acquire(def.id, def.policy.maxConcurrentInstances);
    try {
      const { instance, execution } = await this.engine.run(def, inst);
      this.persist(instance);
      await this.afterRun(instance);
      return execution;
    } finally {
      this.concurrency.release(def.id);
    }
  }

  schedule(
    definitionId: string,
    options: {
      delayMs?: number;
      intervalMs?: number;
      cron?: string;
      variables?: WorkflowVariables;
    },
  ): string {
    const def = this.registry.get(definitionId);
    const payload = { variables: options.variables ?? {} };
    const s = options.cron
      ? this.scheduler.scheduleCron(def.id, options.cron, payload, def.policy.priority)
      : options.intervalMs
        ? this.scheduler.scheduleRecurring(def.id, options.intervalMs, payload, def.policy.priority)
        : this.scheduler.scheduleDelayed(
            def.id,
            options.delayMs ?? 0,
            payload,
            def.policy.priority,
          );
    this.deps.metrics.timerScheduled();
    this.deps.events.emit({
      name: "WorkflowScheduled",
      definitionId: def.id,
      at: this.deps.clock.now(),
      data: { scheduleId: s.id, dueAt: s.dueAt },
    });
    return s.id;
  }

  pause(instanceId: string): WorkflowInstance {
    const now = this.deps.clock.now();
    let inst = transitionInstance(this.get(instanceId), "paused", now, "manual pause");
    inst = appendHistory(inst, { at: now, kind: "paused" }, this.deps.config.maxHistoryPerInstance);
    this.persist(inst);
    this.deps.metrics.instancePaused();
    this.deps.events.emit({
      name: "WorkflowPaused",
      instanceId,
      definitionId: inst.definitionId,
      at: now,
    });
    return inst;
  }

  async resume(instanceId: string): Promise<WorkflowExecution> {
    const now = this.deps.clock.now();
    let inst = this.get(instanceId);
    const def = this.registry.get(inst.definitionId);
    inst = transitionInstance(inst, inst.waitingOn ? "waiting" : "running", now, "manual resume");
    inst = appendHistory(
      inst,
      { at: now, kind: "resumed" },
      this.deps.config.maxHistoryPerInstance,
    );
    this.persist(inst);
    this.deps.events.emit({ name: "WorkflowResumed", instanceId, definitionId: def.id, at: now });
    if (inst.waitingOn) {
      return Object.freeze({
        instanceId,
        definitionId: def.id,
        status: inst.state.status,
        durationMs: 0,
        steps: Object.freeze([]),
        outputs: inst.state.outputs,
      });
    }
    const { instance, execution } = await this.engine.run(def, inst);
    this.persist(instance);
    await this.afterRun(instance);
    return execution;
  }

  cancel(instanceId: string, reason = "cancelled"): WorkflowInstance {
    const now = this.deps.clock.now();
    let inst = transitionInstance(this.get(instanceId), "cancelled", now, reason);
    inst = appendHistory(
      inst,
      { at: now, kind: "cancelled", data: { reason } },
      this.deps.config.maxHistoryPerInstance,
    );
    this.persist(inst);
    this.deps.metrics.instanceCancelled();
    this.deps.events.emit({
      name: "WorkflowCancelled",
      instanceId,
      definitionId: inst.definitionId,
      at: now,
      data: { reason },
    });
    return inst;
  }

  archive(instanceId: string): WorkflowInstance {
    const now = this.deps.clock.now();
    let inst = transitionInstance(this.get(instanceId), "archived", now, "archive");
    inst = appendHistory(
      inst,
      { at: now, kind: "archived" },
      this.deps.config.maxHistoryPerInstance,
    );
    this.persist(inst);
    this.deps.events.emit({
      name: "WorkflowArchived",
      instanceId,
      definitionId: inst.definitionId,
      at: now,
    });
    return inst;
  }

  /** Delivers an external signal (connector / agent / internal event) to a waiting instance. */
  async signal(
    instanceId: string,
    signalName: string,
    payload: Readonly<Record<string, unknown>> = {},
  ): Promise<WorkflowExecution | undefined> {
    const now = this.deps.clock.now();
    let inst = this.get(instanceId);
    if (
      !inst.waitingOn ||
      inst.waitingOn.kind !== "signal" ||
      inst.waitingOn.signalName !== signalName
    )
      return undefined;
    const def = this.registry.get(inst.definitionId);
    const stepId = inst.waitingOn.stepId;
    inst = this.settleWait(inst, stepId, { signal: signalName, ...payload }, now, "signal");
    this.deps.metrics.signalDelivered();
    this.deps.events.emit({
      name: "SignalReceived",
      instanceId,
      definitionId: def.id,
      at: now,
      data: { signalName, stepId },
    });
    const { instance, execution } = await this.engine.run(def, inst);
    this.persist(instance);
    await this.afterRun(instance);
    return execution;
  }

  /** Fires a due timer wait for an instance. */
  async fireTimer(instanceId: string): Promise<WorkflowExecution | undefined> {
    const now = this.deps.clock.now();
    let inst = this.get(instanceId);
    if (!inst.waitingOn || inst.waitingOn.kind !== "timer") return undefined;
    const def = this.registry.get(inst.definitionId);
    const stepId = inst.waitingOn.stepId;
    inst = this.settleWait(inst, stepId, { firedAt: now }, now, "timer");
    const { instance, execution } = await this.engine.run(def, inst);
    this.persist(instance);
    await this.afterRun(instance);
    return execution;
  }

  /** Instances exceeding their execution budget are dead and force-failed. */
  detectDeadWorkflows(): readonly WorkflowInstance[] {
    const now = this.deps.clock.now();
    const dead: WorkflowInstance[] = [];
    for (const inst of this.list()) {
      if (isTerminal(inst.state.status)) continue;
      const def = this.registry.find(inst.definitionId);
      const budget = Math.min(
        def?.policy.executionBudgetMs ?? Infinity,
        this.deps.config.deadWorkflowAfterMs,
      );
      if (now - (inst.startedAt ?? inst.createdAt) > budget) {
        let d = transitionInstance(inst, "failed", now, "dead_workflow");
        d = appendHistory(
          d,
          { at: now, kind: "failed", data: { reason: "dead_workflow" } },
          this.deps.config.maxHistoryPerInstance,
        );
        d = Object.freeze({ ...d, error: "dead_workflow" });
        this.persist(d);
        this.deps.metrics.instanceFailed(now - (d.startedAt ?? d.createdAt));
        this.deps.events.emit({
          name: "WorkflowFailed",
          instanceId: d.id,
          definitionId: d.definitionId,
          at: now,
          data: { reason: "dead_workflow" },
        });
        dead.push(d);
      }
    }
    return dead;
  }

  async tick(now?: number): Promise<number> {
    this.deps.metrics.schedulerTick();
    return this.scheduler.tick(now);
  }

  replay(instanceId: string): ReplayResult {
    const inst = this.get(instanceId);
    return replayWorkflow(this.registry.get(inst.definitionId), inst.history);
  }
  async snapshot(instanceId: string): Promise<WorkflowSnapshot> {
    return this.snapshots.capture(this.get(instanceId), this.deps.clock.now());
  }
  recover(instanceId: string): WorkflowInstance {
    const inst = this.recovery.recover(this.find(instanceId), this.deps.clock.now());
    this.persist(inst);
    return inst;
  }

  statistics(): WorkflowStatistics {
    const byState: Record<string, number> = {};
    let historyRecords = 0;
    for (const i of this.instances.values()) {
      byState[i.state.status] = (byState[i.state.status] ?? 0) + 1;
      historyRecords += i.history.length;
    }
    return Object.freeze({
      definitions: this.registry.size(),
      instances: this.instances.size,
      byState: Object.freeze(byState),
      checkpoints: this.checkpoints.count(),
      historyRecords,
    });
  }

  clear(): void {
    this.instances.clear();
    this.registry.clear();
    this.checkpoints.clear();
    this.snapshots.clear();
    this.scheduler.clear();
    this.rateLimiter.clear();
    this.concurrency.clear();
  }

  // ---------- internals ----------
  private settleWait(
    inst: WorkflowInstance,
    stepId: string,
    output: Readonly<Record<string, unknown>>,
    now: number,
    kind: "timer" | "signal",
  ): WorkflowInstance {
    let next: WorkflowInstance = Object.freeze({
      ...inst,
      state: Object.freeze({
        ...inst.state,
        steps: Object.freeze({ ...inst.state.steps, [stepId]: "succeeded" as const }),
        outputs: Object.freeze({ ...inst.state.outputs, [stepId]: output }),
      }),
      waitingOn: undefined,
    });
    next = appendHistory(
      next,
      { at: now, kind: kind === "timer" ? "timer" : "signal", stepId },
      this.deps.config.maxHistoryPerInstance,
    );
    next = appendHistory(
      next,
      { at: now, kind: "step-succeeded", stepId, data: { output } },
      this.deps.config.maxHistoryPerInstance,
    );
    next = transitionInstance(next, "running", now, `${kind}:${stepId}`);
    this.persist(next);
    return next;
  }

  private persist(inst: WorkflowInstance): void {
    this.instances.set(inst.id, inst);
  }

  /** Registers a scheduler timer when the engine suspended on a timer wait. */
  private async afterRun(inst: WorkflowInstance): Promise<void> {
    if (inst.waitingOn?.kind === "timer") {
      this.scheduler.timers.at(
        inst.waitingOn.dueAt ?? this.deps.clock.now(),
        { instanceId: inst.id },
        inst.priority,
      );
      this.deps.metrics.timerScheduled();
    }
  }
}
