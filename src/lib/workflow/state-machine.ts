/** WAR — deterministic state machine execution engine.
 *
 * Owns orchestration only: capability execution is delegated to CTOR,
 * connector execution to IPCF, reasoning to the Agent Runtime (ADR-014).
 */
import { WorkflowTimeoutError } from "./errors";
import { appendHistory } from "./history";
import { transitionInstance } from "./lifecycle";
import { computeBackoffMs, resolveRetryPolicy } from "./policies";
import { computeLayers } from "./validation";
import type { WorkflowEventBus } from "./events";
import type { WorkflowMetrics } from "./metrics";
import type { WorkflowTelemetrySink } from "./telemetry";
import type { WorkflowAgentPort, WorkflowCtorPort, WorkflowIntegrationPort } from "./ports";
import type { CheckpointManager } from "./checkpoint";
import type {
  WorkflowContext, WorkflowDefinition, WorkflowExecution, WorkflowInstance,
  WorkflowStep, WorkflowStepResult, WorkflowStepStatus,
} from "./types";

export interface EngineDeps {
  readonly events: WorkflowEventBus;
  readonly metrics: WorkflowMetrics;
  readonly telemetry: WorkflowTelemetrySink;
  readonly ctor: WorkflowCtorPort;
  readonly agent: WorkflowAgentPort;
  readonly integration: WorkflowIntegrationPort;
  readonly checkpoints: CheckpointManager;
  readonly now: () => number;
  readonly checkpointEveryStep: boolean;
  readonly maxHistoryPerInstance: number;
}

export interface EngineRunResult {
  readonly instance: WorkflowInstance;
  readonly execution: WorkflowExecution;
}

function withStepStatus(inst: WorkflowInstance, stepId: string, status: WorkflowStepStatus, output?: unknown): WorkflowInstance {
  return Object.freeze({
    ...inst,
    state: Object.freeze({
      ...inst.state,
      steps: Object.freeze({ ...inst.state.steps, [stepId]: status }),
      outputs: output === undefined ? inst.state.outputs : Object.freeze({ ...inst.state.outputs, [stepId]: output }),
    }),
  });
}

export class WorkflowStateMachineEngine {
  constructor(private readonly deps: EngineDeps) {}

  private buildContext(inst: WorkflowInstance, attempt: number): WorkflowContext {
    return Object.freeze({
      instanceId: inst.id,
      definitionId: inst.definitionId,
      correlationId: inst.correlationId,
      attempt,
      now: this.deps.now(),
      variables: inst.variables,
      outputs: inst.state.outputs,
    });
  }

  private async invokeStep(def: WorkflowDefinition, step: WorkflowStep, inst: WorkflowInstance, attempt: number): Promise<unknown> {
    const timeoutMs = step.timeoutMs ?? def.policy.defaultTimeoutMs;
    const ctx = this.buildContext(inst, attempt);
    const input = Object.freeze({ ...(step.input ?? {}), ...inst.variables, __outputs: ctx.outputs });
    const call = (): Promise<unknown> => {
      switch (step.kind) {
        case "capability":
          return this.deps.ctor.invokeCapability({ capabilityId: step.capabilityId!, input, correlationId: inst.correlationId, timeoutMs });
        case "connector":
          return this.deps.integration.invokeConnector({ connectorId: step.connectorId!, capabilityId: step.capabilityId!, input, correlationId: inst.correlationId });
        case "agent":
          return this.deps.agent.reason({ agentId: step.capabilityId ?? "travel-orchestrator", instruction: step.name, correlationId: inst.correlationId, payload: input });
        default:
          return Promise.resolve({ ok: true, step: step.id });
      }
    };
    if (timeoutMs <= 0) return call();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        call(),
        new Promise<never>((_, rej) => { timer = setTimeout(() => rej(new WorkflowTimeoutError(timeoutMs)), timeoutMs); }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /** Runs the instance until it completes, fails, waits or is cancelled. */
  async run(def: WorkflowDefinition, start: WorkflowInstance): Promise<EngineRunResult> {
    const { events, metrics, telemetry, now } = this.deps;
    const t0 = now();
    let inst = start;
    const results: WorkflowStepResult[] = [];

    if (inst.state.status !== "running") {
      inst = transitionInstance(inst, "running", now(), "engine.run");
      inst = appendHistory(inst, { at: now(), kind: "started" }, this.deps.maxHistoryPerInstance);
      metrics.instanceStarted();
      events.emit({ name: "WorkflowStarted", definitionId: def.id, instanceId: inst.id, correlationId: inst.correlationId, at: now() });
    }

    const layers = computeLayers(def.steps);
    const byId = new Map(def.steps.map(s => [s.id, s]));
    let failed: { stepId: string; error: string } | undefined;

    outer:
    for (const layer of layers) {
      const runnable = layer.filter(s => inst.state.steps[s.id] === "pending" || inst.state.steps[s.id] === "waiting");
      if (!runnable.length) continue;

      // Skip steps whose dependencies failed / were skipped, or whose guard is false.
      const pending: WorkflowStep[] = [];
      for (const step of runnable) {
        const depBlocked = step.dependsOn.some(d => {
          const s = inst.state.steps[d];
          return s === "failed" || s === "skipped";
        });
        const guardFalse = step.when ? !step.when(this.buildContext(inst, 0)) : false;
        if (depBlocked || guardFalse) {
          inst = withStepStatus(inst, step.id, "skipped");
          inst = appendHistory(inst, { at: now(), kind: "step-skipped", stepId: step.id }, this.deps.maxHistoryPerInstance);
          metrics.stepSkipped();
          events.emit({ name: "StepSkipped", definitionId: def.id, instanceId: inst.id, data: { stepId: step.id }, at: now() });
          results.push({ id: step.id, status: "skipped", attempts: 0, startedAt: now(), endedAt: now() });
          continue;
        }
        pending.push(step);
      }

      // Waiting steps (timer / signal) suspend the instance.
      const waitStep = pending.find(s => s.kind === "timer" || s.kind === "signal");
      if (waitStep && inst.state.steps[waitStep.id] !== "waiting") {
        inst = withStepStatus(inst, waitStep.id, "waiting");
        inst = appendHistory(inst, { at: now(), kind: "step-waiting", stepId: waitStep.id }, this.deps.maxHistoryPerInstance);
        inst = Object.freeze({
          ...inst,
          waitingOn: Object.freeze({
            stepId: waitStep.id,
            kind: waitStep.kind === "timer" ? ("timer" as const) : ("signal" as const),
            signalName: waitStep.signalName,
            dueAt: waitStep.kind === "timer" ? now() + (waitStep.delayMs ?? 0) : undefined,
          }),
        });
        inst = transitionInstance(inst, "waiting", now(), `wait:${waitStep.id}`);
        events.emit({ name: "StepWaiting", definitionId: def.id, instanceId: inst.id, data: { stepId: waitStep.id }, at: now() });
        break outer;
      }

      const concurrency = Math.max(1, def.policy.maxStepConcurrency);
      for (let i = 0; i < pending.length; i += concurrency) {
        const chunk = pending.slice(i, i + concurrency).filter(s => s.kind !== "timer" && s.kind !== "signal");
        if (!chunk.length) continue;
        const settled = await Promise.all(chunk.map(step => this.runStepWithRetry(def, step, inst)));
        for (const r of settled) {
          results.push(r.result);
          if (r.result.status === "succeeded") {
            inst = withStepStatus(inst, r.result.id, "succeeded", r.result.output);
            inst = appendHistory(inst, { at: r.result.endedAt, kind: "step-succeeded", stepId: r.result.id, data: { output: r.result.output } }, this.deps.maxHistoryPerInstance);
            metrics.stepExecuted();
            events.emit({ name: "StepCompleted", definitionId: def.id, instanceId: inst.id, data: { stepId: r.result.id }, at: r.result.endedAt });
            if (this.deps.checkpointEveryStep) {
              const cp = this.deps.checkpoints.create(inst, now());
              inst = Object.freeze({ ...inst, checkpoints: Object.freeze([...inst.checkpoints, cp]) });
              inst = appendHistory(inst, { at: now(), kind: "checkpoint", stepId: r.result.id, data: { checkpointId: cp.id } }, this.deps.maxHistoryPerInstance);
              metrics.checkpoint();
              events.emit({ name: "CheckpointCreated", definitionId: def.id, instanceId: inst.id, data: { checkpointId: cp.id } , at: now() });
            }
          } else {
            inst = withStepStatus(inst, r.result.id, "failed");
            inst = appendHistory(inst, { at: r.result.endedAt, kind: "step-failed", stepId: r.result.id, data: { error: r.result.error } }, this.deps.maxHistoryPerInstance);
            metrics.stepFailed();
            events.emit({ name: "StepFailed", definitionId: def.id, instanceId: inst.id, data: { stepId: r.result.id, error: r.result.error }, at: r.result.endedAt });
            const step = byId.get(r.result.id)!;
            if (step.required !== false) failed = { stepId: r.result.id, error: r.result.error ?? "step failed" };
          }
        }
        if (failed) break outer;
      }
    }

    if (failed) {
      inst = await this.compensate(def, inst, results);
      inst = transitionInstance(inst, "failed", now(), failed.error);
      inst = Object.freeze({ ...inst, error: failed.error });
      inst = appendHistory(inst, { at: now(), kind: "failed", data: { stepId: failed.stepId, error: failed.error } }, this.deps.maxHistoryPerInstance);
      metrics.instanceFailed(now() - t0);
      events.emit({ name: "WorkflowFailed", definitionId: def.id, instanceId: inst.id, data: { ...failed }, at: now() });
    } else if (inst.state.status === "running") {
      const outstanding = def.steps.some(s => inst.state.steps[s.id] === "pending" || inst.state.steps[s.id] === "waiting");
      if (!outstanding) {
        inst = transitionInstance(inst, "completed", now(), "all steps settled");
        inst = appendHistory(inst, { at: now(), kind: "completed" }, this.deps.maxHistoryPerInstance);
        metrics.instanceCompleted(now() - t0);
        events.emit({ name: "WorkflowCompleted", definitionId: def.id, instanceId: inst.id, at: now() });
      }
    }

    telemetry.record({
      kind: "trace", level: failed ? "error" : "info", message: `workflow:${def.id}`, timestamp: now(),
      attributes: { instanceId: inst.id, status: inst.state.status, steps: results.length, durationMs: now() - t0 },
    });

    const execution: WorkflowExecution = Object.freeze({
      instanceId: inst.id,
      definitionId: def.id,
      status: inst.state.status,
      durationMs: now() - t0,
      steps: Object.freeze(results),
      outputs: inst.state.outputs,
      error: inst.error,
    });
    return { instance: inst, execution };
  }

  private async runStepWithRetry(def: WorkflowDefinition, step: WorkflowStep, inst: WorkflowInstance): Promise<{ result: WorkflowStepResult }> {
    const { events, metrics, now } = this.deps;
    const retry = resolveRetryPolicy(step.retry, def.policy);
    const startedAt = now();
    let attempts = 0;
    let lastError = "unknown error";

    while (attempts < Math.max(1, retry.maxAttempts)) {
      attempts += 1;
      events.emit({ name: "StepStarted", definitionId: def.id, instanceId: inst.id, data: { stepId: step.id, attempt: attempts }, at: now() });
      try {
        const output = await this.invokeStep(def, step, inst, attempts);
        return { result: Object.freeze({ id: step.id, status: "succeeded" as const, attempts, output, startedAt, endedAt: now() }) };
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        if (err instanceof WorkflowTimeoutError) {
          metrics.timeout();
          events.emit({ name: "TimeoutOccurred", definitionId: def.id, instanceId: inst.id, data: { stepId: step.id }, at: now() });
        }
        if (attempts < retry.maxAttempts) {
          metrics.retry();
          events.emit({ name: "WorkflowRetried", definitionId: def.id, instanceId: inst.id, data: { stepId: step.id, attempt: attempts }, at: now() });
          const wait = computeBackoffMs(attempts + 1, retry);
          if (wait > 0) await new Promise(r => setTimeout(r, wait));
        }
      }
    }
    return { result: Object.freeze({ id: step.id, status: "failed" as const, attempts, error: lastError, startedAt, endedAt: now() }) };
  }

  /** Rollback chain — compensates succeeded steps in reverse order. */
  private async compensate(def: WorkflowDefinition, start: WorkflowInstance, results: WorkflowStepResult[]): Promise<WorkflowInstance> {
    const { events, metrics, now } = this.deps;
    const compensable = def.steps
      .filter(s => s.compensation && start.state.steps[s.id] === "succeeded")
      .reverse();
    if (!compensable.length) return start;

    let inst = transitionInstance(start, "compensating", now(), "rollback");
    inst = appendHistory(inst, { at: now(), kind: "compensation-started" }, this.deps.maxHistoryPerInstance);
    events.emit({ name: "CompensationStarted", definitionId: def.id, instanceId: inst.id, at: now() });

    for (const step of compensable) {
      try {
        await this.deps.ctor.invokeCapability({
          capabilityId: step.compensation!.capabilityId,
          input: Object.freeze({ ...(step.compensation!.input ?? {}), compensatedStep: step.id }),
          correlationId: inst.correlationId,
          timeoutMs: def.policy.defaultTimeoutMs,
        });
        inst = withStepStatus(inst, step.id, "compensated");
        inst = appendHistory(inst, { at: now(), kind: "compensation-step", stepId: step.id }, this.deps.maxHistoryPerInstance);
        metrics.compensation();
        results.push({ id: `${step.id}:compensate`, status: "compensated", attempts: 1, startedAt: now(), endedAt: now() });
      } catch (err) {
        inst = appendHistory(inst, {
          at: now(), kind: "compensation-step", stepId: step.id,
          data: { error: err instanceof Error ? err.message : String(err) },
        }, this.deps.maxHistoryPerInstance);
      }
    }
    inst = appendHistory(inst, { at: now(), kind: "compensation-completed" }, this.deps.maxHistoryPerInstance);
    events.emit({ name: "CompensationCompleted", definitionId: def.id, instanceId: inst.id, at: now() });
    return inst;
  }
}
