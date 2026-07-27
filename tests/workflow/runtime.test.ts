import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createWorkflowRuntime, WorkflowFactory, TestClock, InMemoryWorkflowTelemetry,
  WorkflowRuntimeFacade, replayWorkflow, replayMatchesState, nextCronRun, parseCron,
  canTransition, WORKFLOW_LIFECYCLE_STATES, WorkflowTransitionError, WorkflowValidationError,
  WorkflowCycleError, WorkflowPolicyError, BUILTIN_WORKFLOW_IDS, builtinWorkflows,
  WORKFLOW_RUNTIME_ENGINE_CONTRACT, WORKFLOW_RUNTIME_CAPABILITY_MANIFEST,
  ExecutionQueue, InMemoryStatePersistence, computeLayers,
  type WorkflowCtorPort,
} from "@/lib/workflow";

function ctorPort(fail: Set<string> = new Set(), calls: string[] = []): WorkflowCtorPort {
  return {
    async healthy() { return true; },
    async invokeCapability({ capabilityId }) {
      calls.push(capabilityId);
      if (fail.has(capabilityId)) throw new Error(`boom:${capabilityId}`);
      return { capabilityId, ok: true };
    },
  };
}

function rt(opts: Parameters<typeof createWorkflowRuntime>[0] = {}) {
  const clock = new TestClock(1_700_000_000_000);
  const telemetry = new InMemoryWorkflowTelemetry();
  return { clock, telemetry, runtime: createWorkflowRuntime({ clock, telemetry, registerBuiltins: false, ...opts }) };
}

const linear = () => WorkflowFactory.builder({ id: "wf.linear", name: "Linear", version: "1.0.0" })
  .step({ id: "a", name: "A", capabilityId: "cap.a", dependsOn: [] })
  .step({ id: "b", name: "B", capabilityId: "cap.b", dependsOn: ["a"] })
  .build();

describe("definitions & validation", () => {
  it("builds immutable definitions", () => {
    const def = linear();
    expect(Object.isFrozen(def)).toBe(true);
    expect(Object.isFrozen(def.steps[0])).toBe(true);
    expect(() => (def as unknown as { id: string }).id = "x").toThrow();
  });
  it("rejects bad versions, unknown deps and cycles", () => {
    expect(() => WorkflowFactory.definition({ name: "x", version: "1.0", steps: [{ id: "a", name: "A", kind: "noop", dependsOn: [] }] })).toThrow(WorkflowValidationError);
    expect(() => WorkflowFactory.definition({ name: "x", version: "1.0.0", steps: [{ id: "a", name: "A", kind: "noop", dependsOn: ["z"] }] })).toThrow(WorkflowValidationError);
    expect(() => WorkflowFactory.definition({
      name: "x", version: "1.0.0",
      steps: [{ id: "a", name: "A", kind: "noop", dependsOn: ["b"] }, { id: "b", name: "B", kind: "noop", dependsOn: ["a"] }],
    })).toThrow(WorkflowCycleError);
  });
  it("computes parallel layers", () => {
    const def = WorkflowFactory.definition({
      name: "p", version: "1.0.0",
      steps: [
        { id: "a", name: "A", kind: "noop", dependsOn: [] },
        { id: "b", name: "B", kind: "noop", dependsOn: ["a"] },
        { id: "c", name: "C", kind: "noop", dependsOn: ["a"] },
        { id: "d", name: "D", kind: "noop", dependsOn: ["b", "c"] },
      ],
    });
    const layers = computeLayers(def.steps);
    expect(layers.map(l => l.map(s => s.id))).toEqual([["a"], ["b", "c"], ["d"]]);
  });
});

describe("lifecycle", () => {
  it("publishes 12 states and validates transitions", () => {
    expect(WORKFLOW_LIFECYCLE_STATES.length).toBe(12);
    expect(canTransition("running", "completed")).toBe(true);
    expect(canTransition("completed", "running")).toBe(false);
  });
  it("throws on illegal transition", async () => {
    const { runtime } = rt();
    runtime.register(linear());
    const i = runtime.create("wf.linear");
    await runtime.start(i.id);
    expect(() => runtime.pause(i.id)).toThrow(WorkflowTransitionError);
  });
});

describe("execution", () => {
  it("executes a workflow through CTOR only", async () => {
    const calls: string[] = [];
    const { runtime } = rt({ ports: { ctor: ctorPort(new Set(), calls) } });
    runtime.register(linear());
    const exec = await runtime.run("wf.linear", { pnr: "123" });
    expect(exec.status).toBe("completed");
    expect(calls).toEqual(["cap.a", "cap.b"]);
    expect(exec.steps.every(s => s.status === "succeeded")).toBe(true);
  });
  it("skips dependents of failed steps and fails the instance", async () => {
    const { runtime } = rt({ ports: { ctor: ctorPort(new Set(["cap.a"])) } });
    runtime.register(WorkflowFactory.builder({ id: "wf.f", name: "F", version: "1.0.0" })
      .withPolicy({ retry: { maxAttempts: 1, initialDelayMs: 0, multiplier: 1, maxDelayMs: 0 } })
      .step({ id: "a", name: "A", capabilityId: "cap.a", dependsOn: [] })
      .step({ id: "b", name: "B", capabilityId: "cap.b", dependsOn: ["a"] })
      .build());
    const exec = await runtime.run("wf.f");
    expect(exec.status).toBe("failed");
    expect(exec.error).toContain("boom");
  });
  it("evaluates conditional transitions", async () => {
    const { runtime } = rt();
    runtime.register(WorkflowFactory.builder({ id: "wf.c", name: "C", version: "1.0.0" })
      .step({ id: "a", name: "A", capabilityId: "cap.a", dependsOn: [] })
      .step({ id: "b", name: "B", capabilityId: "cap.b", dependsOn: ["a"], when: ctx => ctx.variables.go === true })
      .build());
    const exec = await runtime.run("wf.c", { go: false });
    expect(exec.steps.find(s => s.id === "b")?.status).toBe("skipped");
    expect(exec.status).toBe("completed");
  });
  it("runs parallel branches and joins", async () => {
    const calls: string[] = [];
    const { runtime } = rt({ ports: { ctor: ctorPort(new Set(), calls) } });
    runtime.register(WorkflowFactory.builder({ id: "wf.par", name: "Par", version: "1.0.0" })
      .step({ id: "a", name: "A", capabilityId: "cap.a", dependsOn: [] })
      .step({ id: "b", name: "B", capabilityId: "cap.b", dependsOn: [] })
      .step({ id: "j", name: "Join", capabilityId: "cap.j", dependsOn: ["a", "b"] })
      .build());
    const exec = await runtime.run("wf.par");
    expect(exec.status).toBe("completed");
    expect(calls.at(-1)).toBe("cap.j");
  });
});

describe("retry, timeout & compensation", () => {
  it("retries failing steps up to maxAttempts", async () => {
    let n = 0;
    const { runtime } = rt({ ports: { ctor: {
      async healthy() { return true; },
      async invokeCapability() { n += 1; if (n < 3) throw new Error("flaky"); return { ok: true }; },
    } } });
    runtime.register(WorkflowFactory.builder({ id: "wf.r", name: "R", version: "1.0.0" })
      .step({ id: "a", name: "A", capabilityId: "cap.a", dependsOn: [], retry: { maxAttempts: 3, initialDelayMs: 0 } })
      .build());
    const exec = await runtime.run("wf.r");
    expect(exec.status).toBe("completed");
    expect(exec.steps[0].attempts).toBe(3);
    expect(runtime.metricsSnapshot().retries).toBe(2);
  });
  it("times out a hanging step", async () => {
    const { runtime } = rt({ ports: { ctor: {
      async healthy() { return true; },
      async invokeCapability() { return new Promise(() => undefined); },
    } } });
    runtime.register(WorkflowFactory.builder({ id: "wf.t", name: "T", version: "1.0.0" })
      .withPolicy({ retry: { maxAttempts: 1, initialDelayMs: 0, multiplier: 1, maxDelayMs: 0 } })
      .step({ id: "a", name: "A", capabilityId: "cap.a", dependsOn: [], timeoutMs: 10 })
      .build());
    const exec = await runtime.run("wf.t");
    expect(exec.status).toBe("failed");
    expect(runtime.metricsSnapshot().timeouts).toBe(1);
  });
  it("compensates succeeded steps in reverse order", async () => {
    const calls: string[] = [];
    const { runtime } = rt({ ports: { ctor: ctorPort(new Set(["cap.b"]), calls) } });
    runtime.register(WorkflowFactory.builder({ id: "wf.comp", name: "Comp", version: "1.0.0" })
      .withPolicy({ retry: { maxAttempts: 1, initialDelayMs: 0, multiplier: 1, maxDelayMs: 0 } })
      .step({ id: "a", name: "A", capabilityId: "cap.a", dependsOn: [], compensation: { capabilityId: "cap.a.undo" } })
      .step({ id: "b", name: "B", capabilityId: "cap.b", dependsOn: ["a"] })
      .build());
    const exec = await runtime.run("wf.comp");
    expect(exec.status).toBe("failed");
    expect(calls).toContain("cap.a.undo");
    expect(runtime.metricsSnapshot().compensations).toBe(1);
  });
  it("detects dead workflows past their budget", async () => {
    const { runtime, clock } = rt();
    runtime.register(WorkflowFactory.builder({ id: "wf.dead", name: "Dead", version: "1.0.0" })
      .withPolicy({ executionBudgetMs: 1000 })
      .step({ id: "wait", name: "Wait", kind: "signal", signalName: "never", dependsOn: [] })
      .build());
    const i = runtime.create("wf.dead");
    await runtime.start(i.id);
    clock.advance(5000);
    const dead = runtime.detectDeadWorkflows();
    expect(dead.length).toBe(1);
    expect(dead[0].error).toBe("dead_workflow");
  });
});

describe("scheduler, timers & signals", () => {
  it("orders the execution queue deterministically", () => {
    const q = new ExecutionQueue();
    q.push({ id: "x", dueAt: 20, priority: 1, kind: "timer", payload: {} });
    q.push({ id: "y", dueAt: 10, priority: 5, kind: "timer", payload: {} });
    q.push({ id: "z", dueAt: 10, priority: 1, kind: "timer", payload: {} });
    expect(q.popDue(15).map(e => e.id)).toEqual(["z", "y"]);
    expect(q.size()).toBe(1);
  });
  it("parses cron and computes deterministic next runs", () => {
    expect(parseCron("*/15 * * * *").minutes).toEqual([0, 15, 30, 45]);
    const base = Date.UTC(2026, 0, 1, 10, 3);
    const next = nextCronRun("0 * * * *", base);
    expect(new Date(next).toISOString()).toBe("2026-01-01T11:00:00.000Z");
    expect(nextCronRun("0 * * * *", base)).toBe(next);
  });
  it("runs delayed schedules on clock advance", async () => {
    const { runtime, clock } = rt();
    runtime.register(linear());
    runtime.schedule("wf.linear", { delayMs: 5_000 });
    expect(runtime.instances().length).toBe(0);
    clock.advance(5_000);
    await runtime.tick();
    expect(runtime.instances().length).toBe(1);
  });
  it("resumes timer waits", async () => {
    const { runtime, clock } = rt();
    runtime.register(WorkflowFactory.builder({ id: "wf.timer", name: "Timer", version: "1.0.0" })
      .step({ id: "w", name: "Wait", kind: "timer", delayMs: 1000, dependsOn: [] })
      .step({ id: "a", name: "A", capabilityId: "cap.a", dependsOn: ["w"] })
      .build());
    const i = runtime.create("wf.timer");
    await runtime.start(i.id);
    expect(runtime.instance(i.id).state.status).toBe("waiting");
    clock.advance(1000);
    await runtime.tick();
    expect(runtime.instance(i.id).state.status).toBe("completed");
    expect(runtime.metricsSnapshot().timersFired).toBe(1);
  });
  it("continues on external signals", async () => {
    const { runtime } = rt();
    runtime.register(WorkflowFactory.builder({ id: "wf.sig", name: "Sig", version: "1.0.0" })
      .step({ id: "s", name: "Await", kind: "signal", signalName: "pnr.changed", dependsOn: [] })
      .step({ id: "a", name: "A", capabilityId: "cap.a", dependsOn: ["s"] })
      .build());
    const i = runtime.create("wf.sig");
    await runtime.start(i.id);
    expect(runtime.instance(i.id).state.status).toBe("waiting");
    expect(await runtime.signal(i.id, "other")).toBeUndefined();
    const exec = await runtime.signal(i.id, "pnr.changed", { pnr: "1" });
    expect(exec?.status).toBe("completed");
  });
  it("recurring schedules re-arm", async () => {
    const { runtime, clock } = rt();
    runtime.register(linear());
    runtime.schedule("wf.linear", { intervalMs: 1000 });
    for (let k = 0; k < 3; k += 1) { clock.advance(1000); await runtime.tick(); }
    expect(runtime.instances().length).toBe(3);
  });
});

describe("pause, cancel, checkpoints & recovery", () => {
  it("pauses and resumes a waiting workflow", async () => {
    const { runtime } = rt();
    runtime.register(WorkflowFactory.builder({ id: "wf.p", name: "P", version: "1.0.0" })
      .step({ id: "s", name: "Await", kind: "signal", signalName: "go", dependsOn: [] })
      .build());
    const i = runtime.create("wf.p");
    await runtime.start(i.id);
    expect(runtime.pause(i.id).state.status).toBe("paused");
    await runtime.resume(i.id);
    expect(runtime.instance(i.id).state.status).toBe("waiting");
  });
  it("cancels and archives", async () => {
    const { runtime } = rt();
    runtime.register(WorkflowFactory.builder({ id: "wf.x", name: "X", version: "1.0.0" })
      .step({ id: "s", name: "Await", kind: "signal", signalName: "go", dependsOn: [] })
      .build());
    const i = runtime.create("wf.x");
    await runtime.start(i.id);
    expect(runtime.cancel(i.id, "user").state.status).toBe("cancelled");
    expect(runtime.archive(i.id).state.status).toBe("archived");
  });
  it("creates checkpoints and recovers state", async () => {
    const { runtime } = rt();
    runtime.register(linear());
    const exec = await runtime.run("wf.linear");
    const inst = runtime.instance(exec.instanceId);
    expect(inst.checkpoints.length).toBe(2);
    expect(runtime.recover(inst.id).state.steps.b).toBe("succeeded");
    const snap = await runtime.snapshot(inst.id);
    expect(snap.state.status).toBe("completed");
  });
  it("in-memory persistence port stores snapshots", async () => {
    const p = new InMemoryStatePersistence();
    await p.save("k", { a: 1 });
    expect(await p.load("k")).toEqual({ a: 1 });
    expect(await p.keys()).toEqual(["k"]);
    await p.remove("k");
    expect(p.size).toBe(0);
  });
});

describe("replay determinism", () => {
  it("replays history to the same terminal state", async () => {
    const { runtime } = rt();
    runtime.register(linear());
    const exec = await runtime.run("wf.linear");
    const inst = runtime.instance(exec.instanceId);
    const replay = runtime.replay(inst.id);
    expect(replay.status).toBe("completed");
    expect(replayMatchesState(replay, inst.state)).toBe(true);
    const again = replayWorkflow(runtime.definitions()[0], inst.history);
    expect(again).toEqual(replay);
  });
  it("two identical runs produce identical history shapes", async () => {
    const shape = async () => {
      const { runtime } = rt();
      runtime.register(linear());
      const e = await runtime.run("wf.linear");
      return runtime.instance(e.instanceId).history.map(h => `${h.seq}:${h.kind}:${h.stepId ?? ""}`);
    };
    expect(await shape()).toEqual(await shape());
  });
});

describe("automation policies", () => {
  it("enforces max concurrent instances", async () => {
    const { runtime } = rt();
    runtime.register(WorkflowFactory.builder({ id: "wf.lim", name: "Lim", version: "1.0.0" })
      .withPolicy({ maxConcurrentInstances: 1 })
      .step({ id: "s", name: "Await", kind: "signal", signalName: "go", dependsOn: [] })
      .build());
    const i = runtime.create("wf.lim");
    await runtime.start(i.id);
    expect(() => runtime.create("wf.lim")).toThrow(WorkflowPolicyError);
  });
  it("enforces rate limits", () => {
    const { runtime } = rt();
    runtime.register(WorkflowFactory.builder({ id: "wf.rate", name: "Rate", version: "1.0.0" })
      .withPolicy({ rateLimitPerMinute: 2 })
      .step({ id: "a", name: "A", capabilityId: "cap.a", dependsOn: [] })
      .build());
    runtime.create("wf.rate"); runtime.create("wf.rate");
    expect(() => runtime.create("wf.rate")).toThrow(WorkflowPolicyError);
  });
});

describe("built-in workflows", () => {
  it("registers six deterministic travel workflows", async () => {
    const clock = new TestClock(0);
    const runtime = createWorkflowRuntime({ clock });
    expect(runtime.definitions().length).toBe(BUILTIN_WORKFLOW_IDS.length);
    expect(builtinWorkflows().map(d => d.id).sort()).toEqual([...BUILTIN_WORKFLOW_IDS].sort());
    const exec = await runtime.run("builtin.monitor-pnr", { pnr: "1234567890" });
    expect(exec.status).toBe("completed");
    expect(exec.steps.length).toBe(3);
  });
  it("delay watch waits for its signal", async () => {
    const runtime = createWorkflowRuntime({ clock: new TestClock(0) });
    const i = runtime.create("builtin.train-delay-watch", { trainNumber: "12951" });
    await runtime.start(i.id);
    expect(runtime.instance(i.id).state.status).toBe("waiting");
    const exec = await runtime.signal(i.id, "train.delay", { minutes: 40 });
    expect(exec?.status).toBe("completed");
  });
});

describe("observability & health", () => {
  it("reports metrics, telemetry, statistics and health", async () => {
    const { runtime, telemetry } = rt();
    runtime.register(linear());
    await runtime.run("wf.linear");
    const m = runtime.metricsSnapshot();
    expect(m.instancesCompleted).toBe(1);
    expect(m.stepsExecuted).toBe(2);
    expect(m.checkpoints).toBe(2);
    expect(telemetry.byKind("trace").length).toBeGreaterThan(0);
    expect(runtime.statistics().definitions).toBe(1);
    const h = await runtime.health();
    expect(h.status).toBe("healthy");
  });
  it("emits the typed event catalogue", async () => {
    const { runtime } = rt();
    const seen: string[] = [];
    runtime.onEvent(e => seen.push(e.name));
    runtime.register(linear());
    await runtime.run("wf.linear");
    for (const n of ["WorkflowRegistered", "WorkflowCreated", "WorkflowStarted", "StepStarted", "StepCompleted", "CheckpointCreated", "WorkflowCompleted"]) {
      expect(seen).toContain(n);
    }
  });
});

describe("concurrency & stress", () => {
  it("runs 200 workflows in parallel", async () => {
    const { runtime } = rt();
    runtime.register(WorkflowFactory.builder({ id: "wf.s", name: "S", version: "1.0.0" })
      .withPolicy({ maxConcurrentInstances: 100_000, rateLimitPerMinute: 1_000_000 })
      .step({ id: "a", name: "A", capabilityId: "cap.a", dependsOn: [] })
      .build());
    const t0 = Date.now();
    const execs = await Promise.all(Array.from({ length: 200 }, () => runtime.run("wf.s")));
    expect(execs.every(e => e.status === "completed")).toBe(true);
    expect(Date.now() - t0).toBeLessThan(5_000);
  });
  it("creates 10,000 concurrent workflow instances", async () => {
    const { runtime } = rt({ config: { checkpointEveryStep: false } });
    runtime.register(WorkflowFactory.builder({ id: "wf.big", name: "Big", version: "1.0.0" })
      .withPolicy({ maxConcurrentInstances: 100_000, rateLimitPerMinute: 1_000_000 })
      .step({ id: "s", name: "Await", kind: "signal", signalName: "go", dependsOn: [] })
      .build());
    const t0 = Date.now();
    const ids: string[] = [];
    for (let k = 0; k < 10_000; k += 1) ids.push(runtime.create("wf.big").id);
    await Promise.all(ids.map(id => runtime.start(id)));
    expect(runtime.instances().length).toBe(10_000);
    expect(runtime.statistics().byState.waiting).toBe(10_000);
    expect(Date.now() - t0).toBeLessThan(20_000);
  }, 40_000);
});

describe("architecture fitness", () => {
  const dir = join(process.cwd(), "src/lib/workflow");
  const files = readdirSync(dir).filter(f => f.endsWith(".ts"));

  it("imports no domain engine, connector or external SDK", () => {
    const forbidden = [
      "@/lib/memory", "@/lib/prompt", "@/lib/graph", "@/lib/journey", "@/lib/decision",
      "@/lib/trust", "@/lib/goal", "@/lib/spatial", "@/lib/studio", "@/lib/railway",
      "@/lib/provider", "@/lib/runtime", "@/lib/capabilities", "@/lib/tios", "@/lib/tie",
      "@supabase", "@tanstack", "react",
    ];
    for (const f of files) {
      const src = readFileSync(join(dir, f), "utf8");
      for (const bad of forbidden) {
        expect(src.includes(`from "${bad}`)).toBe(false);
      }
    }
  });
  it("does no network or timer-daemon IO", () => {
    for (const f of files) {
      const src = readFileSync(join(dir, f), "utf8");
      expect(/\bfetch\(/.test(src)).toBe(false);
      expect(src.includes("setInterval(")).toBe(false);
    }
  });
  it("publishes a stable engine contract and capability manifest", () => {
    expect(Object.isFrozen(WORKFLOW_RUNTIME_ENGINE_CONTRACT)).toBe(true);
    expect(WORKFLOW_RUNTIME_ENGINE_CONTRACT.adr).toEqual(["ADR-013", "ADR-014", "ADR-015"]);
    expect(WORKFLOW_RUNTIME_ENGINE_CONTRACT.dependencies.frozenEngines).toEqual(["agent.runtime", "ctor.runtime", "integration.runtime"]);
    expect(WORKFLOW_RUNTIME_ENGINE_CONTRACT.ownership.doesNotOwn).toContain("capability-execution");
    expect(WORKFLOW_RUNTIME_CAPABILITY_MANIFEST.capabilities.length).toBeGreaterThanOrEqual(15);
    expect(WORKFLOW_RUNTIME_CAPABILITY_MANIFEST.builtinWorkflows.length).toBe(6);
  });
  it("exposes the facade alias", () => {
    expect(WorkflowRuntimeFacade).toBe(createWorkflowRuntime({ registerBuiltins: false }).constructor);
  });
  it("publishes the ADRs", () => {
    const adrDir = join(process.cwd(), "docs/adr");
    const names = readdirSync(adrDir);
    for (const n of ["ADR-013", "ADR-014", "ADR-015"]) {
      expect(names.some(f => f.startsWith(n))).toBe(true);
    }
  });
});
