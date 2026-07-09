import { describe, expect, it } from "vitest";
import {
  CapabilityRuntime,
  Container,
  ContextBuilder,
  EventBus,
  RuntimeKernel,
  ServiceRegistry,
  createExecutionContext,
  childContext,
  createToken,
  loadRuntimeConfiguration,
  ConfigurationError,
  DependencyResolutionError,
  ContainerError,
  CapabilityError,
  TimeoutError,
  CancellationError,
  InMemoryMetrics,
  InMemoryDeadLetterQueue,
  NoopTelemetry,
} from "@/lib/runtime";

describe("ExecutionContext", () => {
  it("populates defaults and freezes the context tree", () => {
    const ctx = createExecutionContext({ userId: "u1", journeyId: "j1" });
    expect(ctx.requestId).toMatch(/^req_/);
    expect(ctx.locale).toBe("en-US");
    expect(ctx.trust.score).toBe(0.5);
    expect(Object.isFrozen(ctx)).toBe(true);
    expect(Object.isFrozen(ctx.budget)).toBe(true);
    expect(() => {
      // @ts-expect-error runtime immutability check
      ctx.budget.currency = "EUR";
    }).toThrow();
  });

  it("child inherits correlation + trace and swaps span/causation", () => {
    const parent = createExecutionContext({ userId: "u1" });
    const child = childContext(parent);
    expect(child.correlationId).toBe(parent.correlationId);
    expect(child.tracing.traceId).toBe(parent.tracing.traceId);
    expect(child.tracing.parentSpanId).toBe(parent.tracing.spanId);
    expect(child.causationId).toBe(parent.requestId);
    expect(child.requestId).not.toBe(parent.requestId);
  });
});

describe("RuntimeConfiguration", () => {
  it("loads defaults and rejects invalid policies", () => {
    const cfg = loadRuntimeConfiguration({ environment: "test", debug: true });
    expect(cfg.environment).toBe("test");
    expect(Object.isFrozen(cfg)).toBe(true);
    expect(() =>
      loadRuntimeConfiguration({ policies: { maxConcurrentCapabilities: 0 } }),
    ).toThrow(ConfigurationError);
  });
});

describe("EventBus", () => {
  interface Map { "test.a": { n: number }; "test.b": { s: string } }

  it("dispatches typed events and respects priority", async () => {
    const bus = new EventBus<Map>();
    const order: string[] = [];
    bus.subscribe("test.a", () => { order.push("low"); }, { priority: 1 });
    bus.subscribe("test.a", () => { order.push("high"); }, { priority: 10 });
    await bus.publish("test.a", { n: 1 });
    expect(order).toEqual(["high", "low"]);
  });

  it("unsubscribes and retains replay buffer", async () => {
    const bus = new EventBus<Map>({ replayBufferSize: 5 });
    const seen: number[] = [];
    const off = bus.subscribe("test.a", (e) => { seen.push(e.payload.n); });
    await bus.publish("test.a", { n: 1 });
    off();
    await bus.publish("test.a", { n: 2 });
    expect(seen).toEqual([1]);
    const replay = await bus.replayEvents("test.a");
    expect(replay.map((e) => (e.payload as { n: number }).n)).toEqual([1, 2]);
  });

  it("routes handler errors to the dead-letter queue", async () => {
    const dlq = new InMemoryDeadLetterQueue();
    const bus = new EventBus<Map>({ deadLetterQueue: dlq });
    bus.subscribe("test.a", () => { throw new Error("boom"); });
    await bus.publish("test.a", { n: 1 });
    expect(dlq.size()).toBe(1);
  });

  it("retries with backoff then succeeds", async () => {
    const bus = new EventBus<Map>({
      defaultRetry: { maxAttempts: 3, backoffMs: 0 },
    });
    let calls = 0;
    bus.subscribe("test.a", () => {
      calls += 1;
      if (calls < 3) throw new Error("fail");
    });
    await bus.publish("test.a", { n: 1 });
    expect(calls).toBe(3);
  });

  it("enforces idempotency by event id", async () => {
    const bus = new EventBus<Map>({ enforceIdempotency: true });
    let n = 0;
    bus.subscribe("test.a", () => { n += 1; });
    await bus.publish("test.a", { n: 1 }, { id: "same" });
    await bus.publish("test.a", { n: 1 }, { id: "same" });
    expect(n).toBe(1);
  });

  it("runs middleware before/after", async () => {
    const bus = new EventBus<Map>();
    const trail: string[] = [];
    bus.use({
      before: () => { trail.push("before"); },
      after: () => { trail.push("after"); },
    });
    bus.subscribe("test.a", () => { trail.push("handler"); });
    await bus.publish("test.a", { n: 1 });
    expect(trail).toEqual(["before", "handler", "after"]);
  });
});

describe("Container", () => {
  const A = createToken<{ v: number }>("A");
  const B = createToken<{ a: { v: number } }>("B");

  it("resolves singletons once", () => {
    const c = new Container();
    let built = 0;
    c.register(A, () => { built += 1; return { v: 1 }; });
    c.resolveSync(A);
    c.resolveSync(A);
    expect(built).toBe(1);
  });

  it("resolves interfaces via factory + tracks dependencies", () => {
    const c = new Container();
    c.register(A, () => ({ v: 42 }));
    c.register(B, (r) => ({ a: r.resolveSync(A) }));
    expect(c.resolveSync(B).a.v).toBe(42);
  });

  it("detects circular dependencies", () => {
    const c = new Container();
    c.register(A, (r) => r.resolveSync(B) as unknown as { v: number });
    c.register(B, (r) => r.resolveSync(A) as unknown as { a: { v: number } });
    expect(() => c.resolveSync(A)).toThrow(DependencyResolutionError);
  });

  it("rejects duplicate registration", () => {
    const c = new Container();
    c.register(A, () => ({ v: 1 }));
    expect(() => c.register(A, () => ({ v: 2 }))).toThrow(ContainerError);
  });

  it("scoped lifetimes are fresh per scope", () => {
    const c = new Container();
    c.register(A, () => ({ v: Math.random() }), "scoped");
    const s1 = c.createScope();
    const s2 = c.createScope();
    expect(s1.resolveSync(A)).not.toEqual(s2.resolveSync(A));
  });
});

describe("ServiceRegistry", () => {
  it("registers, discovers, and health-checks services", async () => {
    const r = new ServiceRegistry();
    r.register("svc.a", { hello: "world" }, {
      version: "1.2.3",
      kind: "test",
      healthCheck: () => ({ status: "healthy", checkedAt: Date.now() }),
    });
    expect(r.require("svc.a").version).toBe("1.2.3");
    expect(r.list("test")).toHaveLength(1);
    const h = await r.health();
    expect(h["svc.a"].status).toBe("healthy");
  });

  it("rejects invalid semver", () => {
    const r = new ServiceRegistry();
    expect(() => r.register("bad", {}, { version: "not-semver" })).toThrow();
  });
});

describe("ContextBuilder", () => {
  it("assembles context from ports deterministically", async () => {
    const builder = new ContextBuilder({
      session: {
        currentSessionId: () => "s1",
        currentUserId: () => "u1",
        currentJourneyId: () => "j1",
        currentLocale: () => "fr-FR",
        currentTimezone: () => "Europe/Paris",
      },
      preferences: { load: async () => ({ theme: "dark" }) },
      goals: { load: async () => ({ goalIds: ["g1"], primaryGoalId: "g1" }) },
      budget: { load: async () => ({ currency: "EUR", totalMinor: 100_000 }) },
      trust: { load: async () => ({ score: 0.9, scopes: ["ai:plan"], retentionOptIn: true }) },
      memory: {
        retrieve: async () => [{ id: "m1", content: "hi" }],
        healthy: async () => true,
      },
    });
    const ctx = await builder.build();
    expect(ctx.userId).toBe("u1");
    expect(ctx.preference.values.theme).toBe("dark");
    expect(ctx.budget.currency).toBe("EUR");
    expect(ctx.memory.attachedIds).toEqual(["m1"]);
    expect(ctx.trust.score).toBe(0.9);
  });
});

describe("CapabilityRuntime", () => {
  it("registers, executes, and emits lifecycle events", async () => {
    const bus = new EventBus();
    const events: string[] = [];
    bus.subscribeAll((e) => { events.push(e.name); });
    const runtime = new CapabilityRuntime({ eventBus: bus, metrics: new InMemoryMetrics(), telemetry: new NoopTelemetry() });
    await runtime.register({
      metadata: { id: "echo", version: "1.0.0" },
      execute: (input: { m: string }) => input.m,
    });
    const ctx = createExecutionContext();
    const out = await runtime.execute<{ m: string }, string>("echo", { m: "hello" }, ctx);
    expect(out).toBe("hello");
    expect(events).toContain("capability.registered");
    expect(events).toContain("capability.executed");
  });

  it("enforces deny lists and unknown capabilities", async () => {
    const runtime = new CapabilityRuntime();
    await runtime.register({
      metadata: { id: "x", version: "1.0.0" },
      execute: () => "ok",
    });
    const denied = createExecutionContext({ capability: { deny: ["x"] } });
    await expect(runtime.execute("x", null, denied)).rejects.toBeInstanceOf(CapabilityError);
    await expect(runtime.execute("unknown", null, createExecutionContext())).rejects.toBeInstanceOf(CapabilityError);
  });

  it("honors timeout and cancellation", async () => {
    const runtime = new CapabilityRuntime();
    await runtime.register({
      metadata: { id: "slow", version: "1.0.0", timeoutMs: 20 },
      execute: () => new Promise((r) => setTimeout(r, 200)),
    });
    await expect(runtime.execute("slow", null, createExecutionContext())).rejects.toBeInstanceOf(TimeoutError);

    await runtime.register({
      metadata: { id: "cancel", version: "1.0.0" },
      execute: () => new Promise((r) => setTimeout(r, 200)),
    });
    const ctrl = new AbortController();
    const ctx = createExecutionContext({ signal: ctrl.signal });
    const p = runtime.execute("cancel", null, ctx);
    ctrl.abort();
    await expect(p).rejects.toBeInstanceOf(CancellationError);
  });
});

describe("RuntimeKernel (integration)", () => {
  it("wires everything and exposes health + diagnostics", async () => {
    const kernel = new RuntimeKernel({ config: { environment: "test" } });
    await kernel.capabilities.register({
      metadata: { id: "add", version: "1.0.0" },
      execute: (input: { a: number; b: number }) => input.a + input.b,
    });
    const ctx = await kernel.buildContext();
    const sum = await kernel.capabilities.execute<{ a: number; b: number }, number>(
      "add", { a: 2, b: 3 }, ctx,
    );
    expect(sum).toBe(5);
    const health = await kernel.health.check();
    expect(health.status).toBe("healthy");
    const diag = await kernel.health.diagnostics();
    expect(diag.services).toBeGreaterThan(0);
    expect(diag.capabilities.add.runs).toBe(1);
  });

  it("processes concurrent capability executions safely", async () => {
    const kernel = new RuntimeKernel();
    await kernel.capabilities.register({
      metadata: { id: "n", version: "1.0.0" },
      execute: async (i: number) => {
        await new Promise((r) => setTimeout(r, 5));
        return i * 2;
      },
    });
    const ctx = await kernel.buildContext();
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) => kernel.capabilities.execute<number, number>("n", i, ctx)),
    );
    expect(results.reduce((a, b) => a + b, 0)).toBe(20 * 19); // 2*(0+1+…+19)
  });
});
