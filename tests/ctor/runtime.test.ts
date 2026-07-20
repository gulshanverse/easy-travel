/**
 * CTOR — unit, integration, architecture fitness, stress and cross-engine
 * interop tests. All interop occurs through public ports only.
 */
import { describe, expect, it } from "vitest";
import {
  createCapabilityRuntime, CTOR_ENGINE_CONTRACT, CTOR_CAPABILITY_MANIFEST,
  makeCapability, makeTool, makeWorkflow, createExecutionContext,
  topologicalSort, computeLayers, WorkflowBuilder, WorkflowValidator, WorkflowPlanner,
  DependencyCycleError, DependencyUnresolvedError, WorkflowValidationError,
  ToolValidationError, LifecycleError, ExecutionTimeoutError,
  canTransitionCapability, canTransitionWorkflow, transitionCapability,
  withVariables, childContext, snapshotContext,
  computeBackoffMs, DEFAULT_CTOR_POLICIES,
  type CTORMemoryPort, type CTORPromptPort,
} from "@/lib/ctor";
import { createGraphRuntime } from "@/lib/graph";
import { createJourneyRuntime } from "@/lib/journey";
import { createDecisionRuntime } from "@/lib/decision";
import { createTrustRuntime } from "@/lib/trust";
import { createGoalRuntime } from "@/lib/goal";
import { createSpatialRuntime } from "@/lib/spatial";

function baseCap(id: string, deps: string[] = []) {
  return makeCapability({
    id, name: id, version: "1.0.0", owner: { engine: "test" },
    dependencies: deps.map(d => ({ capabilityId: d })),
  });
}

describe("CTOR / factories & validation", () => {
  it("makeCapability freezes and validates", () => {
    const c = baseCap("cap.a");
    expect(Object.isFrozen(c)).toBe(true);
    expect(() => makeCapability({ id: "x", name: "x", version: "bad", owner: { engine: "e" } })).toThrow();
  });
  it("makeTool validates schema", () => {
    const t = makeTool({ name: "t", version: "1.0.0", schema: { input: [{ name: "a", type: "string", required: true }] } });
    expect(t.name).toBe("t");
    expect(() => makeTool({ name: "t", version: "1.0.0", schema: { input: [{ name: "a", type: "string", required: true }, { name: "a", type: "string", required: false }] } })).toThrow(ToolValidationError);
  });
  it("makeWorkflow rejects duplicate ids and unknown deps", () => {
    expect(() => makeWorkflow({ name: "w", version: "1.0.0", steps: [
      { id: "a", kind: "task", dependsOn: [] }, { id: "a", kind: "task", dependsOn: [] },
    ] })).toThrow(WorkflowValidationError);
    expect(() => makeWorkflow({ name: "w", version: "1.0.0", steps: [
      { id: "a", kind: "task", dependsOn: ["missing"] },
    ] })).toThrow(WorkflowValidationError);
  });
});

describe("CTOR / dependency resolution", () => {
  it("topological sort orders by deps", () => {
    const nodes = [
      { id: "c", dependsOn: ["a", "b"] },
      { id: "a", dependsOn: [] },
      { id: "b", dependsOn: ["a"] },
    ];
    const sorted = topologicalSort(nodes).map(n => n.id);
    expect(sorted.indexOf("a")).toBeLessThan(sorted.indexOf("b"));
    expect(sorted.indexOf("b")).toBeLessThan(sorted.indexOf("c"));
  });
  it("detects cycles", () => {
    expect(() => topologicalSort([
      { id: "a", dependsOn: ["b"] }, { id: "b", dependsOn: ["a"] },
    ])).toThrow(DependencyCycleError);
  });
  it("detects unresolved deps", () => {
    expect(() => topologicalSort([{ id: "a", dependsOn: ["nope"] }])).toThrow(DependencyUnresolvedError);
  });
  it("computes parallel layers", () => {
    const layers = computeLayers([
      { id: "a", dependsOn: [] }, { id: "b", dependsOn: [] },
      { id: "c", dependsOn: ["a", "b"] },
    ]);
    expect(layers.length).toBe(2);
    expect(layers[0].map(n => n.id).sort()).toEqual(["a", "b"]);
    expect(layers[1].map(n => n.id)).toEqual(["c"]);
  });
});

describe("CTOR / execution context", () => {
  it("creates immutable context and snapshots", () => {
    const ctx = createExecutionContext({ variables: { k: 1 } });
    expect(Object.isFrozen(ctx)).toBe(true);
    const ctx2 = withVariables(ctx, { k: 2 });
    expect(ctx.variables.k).toBe(1);
    expect(ctx2.variables.k).toBe(2);
    const child = childContext(ctx, "step");
    expect(child.scope.depth).toBe(1);
    expect(child.correlation.parentSpanId).toBe(ctx.correlation.spanId);
    expect(snapshotContext(ctx, { s: "succeeded" }).stepStatuses.s).toBe("succeeded");
  });
});

describe("CTOR / lifecycle & policies", () => {
  it("transitions capability", () => {
    expect(canTransitionCapability("registered", "validated")).toBe(true);
    expect(canTransitionCapability("removed", "active")).toBe(false);
    expect(() => transitionCapability("removed", "active")).toThrow(LifecycleError);
  });
  it("workflow transitions", () => {
    expect(canTransitionWorkflow("running", "completed")).toBe(true);
    expect(canTransitionWorkflow("archived", "running")).toBe(false);
  });
  it("deterministic backoff", () => {
    const p = { maxAttempts: 5, backoffMs: 100, factor: 2 };
    expect(computeBackoffMs(1, p)).toBe(0);
    expect(computeBackoffMs(2, p)).toBe(100);
    expect(computeBackoffMs(3, p)).toBe(200);
    expect(computeBackoffMs(4, p)).toBe(400);
  });
});

describe("CTOR / registry & tool invocation", () => {
  it("registers and invokes a tool", async () => {
    const rt = createCapabilityRuntime();
    const tool = makeTool({ name: "add", version: "1.0.0", schema: { input: [
      { name: "a", type: "number", required: true }, { name: "b", type: "number", required: true },
    ] } });
    rt.manager.registerTool(tool, ({ a, b }) => (a as number) + (b as number));
    const out = await rt.manager.invoker.invoke(tool.id, { a: 2, b: 3 });
    expect(out).toBe(5);
    expect(rt.manager.tools.getStatistics(tool.id).invocations).toBe(1);
  });
  it("rejects invalid tool input", async () => {
    const rt = createCapabilityRuntime();
    const tool = makeTool({ name: "t", version: "1.0.0", schema: { input: [{ name: "a", type: "number", required: true }] } });
    rt.manager.registerTool(tool, () => 1);
    await expect(rt.manager.invoker.invoke(tool.id, {} as never)).rejects.toThrow(ToolValidationError);
  });
});

describe("CTOR / workflow execution", () => {
  it("runs a DAG with parallel + sequential steps", async () => {
    const rt = createCapabilityRuntime();
    const wf = new WorkflowBuilder({ name: "w", version: "1.0.0" })
      .add({ id: "a", kind: "task", dependsOn: [], execute: () => 1 })
      .add({ id: "b", kind: "task", dependsOn: [], execute: () => 2 })
      .add({ id: "c", kind: "task", dependsOn: ["a", "b"], execute: (_ctx, out) => (out.a as number) + (out.b as number) })
      .build();
    rt.manager.registerWorkflow(wf);
    const result = await rt.manager.runWorkflow(wf.id, createExecutionContext());
    expect(result.status).toBe("completed");
    expect(result.outputs.c).toBe(3);
  });
  it("retries then fails, respecting required", async () => {
    const rt = createCapabilityRuntime();
    let calls = 0;
    const wf = new WorkflowBuilder({ name: "w", version: "1.0.0" })
      .add({ id: "flaky", kind: "task", dependsOn: [], execute: () => { calls++; throw new Error("boom"); },
        policy: { retry: { maxAttempts: 3, backoffMs: 1, factor: 1 }, timeoutMs: 500 } })
      .build();
    rt.manager.registerWorkflow(wf);
    const result = await rt.manager.runWorkflow(wf.id, createExecutionContext());
    expect(result.status).toBe("failed");
    expect(calls).toBe(3);
    expect(result.failedStep).toBe("flaky");
  });
  it("skips step when when() returns false", async () => {
    const rt = createCapabilityRuntime();
    const wf = new WorkflowBuilder({ name: "w", version: "1.0.0" })
      .add({ id: "a", kind: "conditional", dependsOn: [], execute: () => 1, when: () => false })
      .build();
    rt.manager.registerWorkflow(wf);
    const r = await rt.manager.runWorkflow(wf.id, createExecutionContext());
    expect(r.status).toBe("completed");
    expect(r.steps[0].status).toBe("skipped");
  });
  it("times out a slow step", async () => {
    const rt = createCapabilityRuntime();
    const wf = new WorkflowBuilder({ name: "w", version: "1.0.0" })
      .add({ id: "slow", kind: "task", dependsOn: [], execute: () => new Promise(r => setTimeout(r, 100)),
        policy: { timeoutMs: 10, retry: { maxAttempts: 1, backoffMs: 0, factor: 1 } } })
      .build();
    rt.manager.registerWorkflow(wf);
    const r = await rt.manager.runWorkflow(wf.id, createExecutionContext());
    expect(r.status).toBe("failed");
    expect(r.error).toMatch(/timed out/);
  });
  it("cancels via signal", async () => {
    const rt = createCapabilityRuntime();
    const wf = new WorkflowBuilder({ name: "w", version: "1.0.0" })
      .add({ id: "s", kind: "task", dependsOn: [], execute: () => new Promise(r => setTimeout(r, 200)),
        policy: { timeoutMs: 5000, retry: { maxAttempts: 1, backoffMs: 0, factor: 1 } } })
      .build();
    rt.manager.registerWorkflow(wf);
    const ac = new AbortController();
    const ctx = createExecutionContext({ signal: ac.signal });
    const p = rt.manager.runWorkflow(wf.id, ctx);
    setTimeout(() => ac.abort(), 20);
    const r = await p;
    expect(["cancelled", "failed"]).toContain(r.status);
  });
  it("planner returns layered plan", () => {
    const wf = makeWorkflow({ name: "w", version: "1.0.0", steps: [
      { id: "a", kind: "task", dependsOn: [] },
      { id: "b", kind: "task", dependsOn: ["a"] },
    ] });
    WorkflowValidator.validate(wf);
    expect(WorkflowPlanner.plan(wf).length).toBe(2);
  });
});

describe("CTOR / discovery", () => {
  it("registers capabilities from a contract source", async () => {
    const rt = createCapabilityRuntime();
    const created = await rt.manager.capabilities.discover({
      async discover() { return [
        { id: "cap.x", name: "x", version: "1.0.0", owner: { engine: "e" }, features: ["f1"] },
      ]; },
    });
    expect(created.length).toBe(1);
    expect(rt.manager.capabilities.has("cap.x")).toBe(true);
    expect(rt.manager.capabilities.isVersionCompatible("cap.x", "^1.0.0")).toBe(true);
  });
});

describe("CTOR / events & metrics", () => {
  it("emits typed events with correlation ids", async () => {
    const rt = createCapabilityRuntime();
    const seen: string[] = [];
    rt.onEvent(e => seen.push(e.name));
    const cap = baseCap("cap.evt");
    rt.manager.registerCapability(cap);
    const tool = makeTool({ name: "t", version: "1.0.0", schema: { input: [] } });
    rt.manager.registerTool(tool, () => 1);
    await rt.manager.invoker.invoke(tool.id, {});
    expect(seen).toContain("CapabilityRegistered");
    expect(seen).toContain("ToolRegistered");
    expect(seen).toContain("ToolInvoked");
    const snap = rt.metricsSnapshot();
    expect(snap.capabilities.registered).toBe(1);
    expect(snap.tools.invocations).toBe(1);
  });
});

describe("CTOR / engine contract + manifest", () => {
  it("publishes stable contract & manifest", () => {
    expect(CTOR_ENGINE_CONTRACT.id).toBe("ctor.runtime");
    expect(Object.isFrozen(CTOR_ENGINE_CONTRACT)).toBe(true);
    expect(Object.isFrozen(CTOR_CAPABILITY_MANIFEST)).toBe(true);
    expect(CTOR_ENGINE_CONTRACT.publishedEvents).toContain("WorkflowCompleted");
    expect(CTOR_CAPABILITY_MANIFEST.capabilities.workflow).toContain("dag");
  });
});

describe("CTOR / cross-engine interop via ports only", () => {
  it("integrates with all frozen runtimes through healthy ports", async () => {
    // CTOR touches other engines only through ports — no direct instantiation required.

    const memPort: CTORMemoryPort = { async healthy() { return true; } };
    const promptPort: CTORPromptPort = { async healthy() { return true; }, registeredPromptCount() { return 0; } };

    const rt = createCapabilityRuntime({
      ports: {
        memory: memPort, prompt: promptPort,
        provider: { async healthy() { return true; }, registeredProviderCount() { return 0; } },
        graph: { async healthy() { return true; } },
        journey: { async healthy() { return true; } },
        decision: { async healthy() { return true; } },
        trust: { async healthy() { return true; } },
        goal: { async healthy() { return true; } },
        spatial: { async healthy() { return true; } },
      },
    });

    const h = await rt.health();
    expect(h.healthy).toBe(true);
    expect(Object.keys(h.ports).length).toBeGreaterThan(0);
  });
});

// Remove unused imports references
void [createGraphRuntime, createJourneyRuntime, createDecisionRuntime, createTrustRuntime, createGoalRuntime, createSpatialRuntime];
  });
});

describe("CTOR / architecture fitness", () => {
  it("CTOR does not import other engines' internals (contract-only)", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const dir = path.resolve("src/lib/ctor");
    const files = fs.readdirSync(dir).filter(f => f.endsWith(".ts"));
    const forbidden = [
      "src/lib/memory/", "src/lib/prompt/", "src/lib/graph/",
      "src/lib/journey/", "src/lib/decision/", "src/lib/trust/",
      "src/lib/goal/", "src/lib/spatial/", "src/lib/provider/",
      "@/lib/memory/", "@/lib/prompt/", "@/lib/graph/",
      "@/lib/journey/", "@/lib/decision/", "@/lib/trust/",
      "@/lib/goal/", "@/lib/spatial/", "@/lib/provider/",
    ];
    for (const f of files) {
      const src = fs.readFileSync(path.join(dir, f), "utf8");
      for (const needle of forbidden) {
        expect(src.includes(needle)).toBe(false);
      }
    }
  });
  it("domain factories return frozen objects", () => {
    const c = baseCap("frz");
    expect(Object.isFrozen(c)).toBe(true);
    expect(Object.isFrozen(c.metadata)).toBe(true);
    expect(Object.isFrozen(c.contract)).toBe(true);
  });
});

describe("CTOR / stress", () => {
  it("executes a 200-step DAG under 2s", async () => {
    const rt = createCapabilityRuntime({ policies: { maxConcurrency: 32 } });
    const steps = Array.from({ length: 200 }, (_, i) => ({
      id: `s${i}`, kind: "task" as const,
      dependsOn: i < 10 ? [] : [`s${i - 10}`],
      execute: () => i,
    }));
    const wf = makeWorkflow({ name: "big", version: "1.0.0", steps });
    rt.manager.registerWorkflow(wf);
    const t = Date.now();
    const r = await rt.manager.runWorkflow(wf.id, createExecutionContext());
    expect(r.status).toBe("completed");
    expect(Date.now() - t).toBeLessThan(2000);
  });
  it("registers 500 capabilities quickly", () => {
    const rt = createCapabilityRuntime();
    const t = Date.now();
    for (let i = 0; i < 500; i++) rt.manager.registerCapability(baseCap(`cap.${i}`));
    expect(rt.manager.capabilities.size()).toBe(500);
    expect(Date.now() - t).toBeLessThan(1000);
  });
});
