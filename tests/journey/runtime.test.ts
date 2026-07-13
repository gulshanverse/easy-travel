/**
 * Journey Intelligence Engine — Sprint I-006 test suite.
 * Covers: lifecycle, intents, constraints, timeline, context assembly,
 * memory/graph port integration, concurrency, stress, and benchmarks.
 */

import { describe, it, expect } from "vitest";
import {
  ConstraintEngine,
  IntentEngine,
  JourneyContextEngine,
  JourneyEventBus,
  JourneyRuntime,
  TimelineEngine,
  canRollback,
  canTransition,
  createConstraint,
  createIntent,
  createMilestone,
  defineJourneyConfig,
  makeEvent,
  validateJourney,
  type JourneyGraphPort,
  type JourneyMemoryItem,
  type JourneyMemoryPort,
} from "@/lib/journey";

const cfg = defineJourneyConfig({ namespace: "test" });

function makeRuntime(overrides: Partial<{ memory: JourneyMemoryPort; graph: JourneyGraphPort }> = {}) {
  return new JourneyRuntime({ config: cfg, ...overrides });
}

describe("Journey Configuration", () => {
  it("rejects invalid namespaces", () => {
    expect(() => defineJourneyConfig({ namespace: "" })).toThrow();
    expect(() => defineJourneyConfig({ namespace: "!!" })).toThrow();
  });
  it("freezes defaults", () => {
    const c = defineJourneyConfig({ namespace: "abc" });
    expect(Object.isFrozen(c)).toBe(true);
    expect(c.policies.maxJourneysPerProcess).toBeGreaterThan(0);
  });
});

describe("State machine", () => {
  it("allows valid transitions", () => {
    expect(canTransition("created", "exploring")).toBe(true);
    expect(canTransition("planning", "draft")).toBe(true);
    expect(canTransition("archived", "active")).toBe(false);
  });
  it("supports rollback", () => {
    expect(canRollback("planning")).toBe(true);
    expect(canRollback("archived")).toBe(false);
  });
});

describe("Lifecycle", () => {
  it("creates and advances a journey through the full happy path", () => {
    const rt = makeRuntime();
    const mgr = rt.create({ ownerId: "u1", namespace: cfg.namespace, title: "Iceland" });
    expect(mgr.state).toBe("created");
    mgr.transition("exploring");
    mgr.transition("planning");
    mgr.transition("draft");
    mgr.transition("review");
    mgr.transition("confirmed");
    mgr.transition("active");
    mgr.transition("paused");
    mgr.transition("active");
    mgr.transition("completed");
    mgr.transition("archived");
    expect(mgr.state).toBe("archived");
    expect(mgr.versions.length).toBeGreaterThan(5);
  });

  it("rejects illegal transitions", () => {
    const rt = makeRuntime();
    const mgr = rt.create({ ownerId: "u1", namespace: cfg.namespace, title: "X" });
    expect(() => mgr.transition("completed")).toThrow();
  });

  it("rolls back to the previous state", () => {
    const rt = makeRuntime();
    const mgr = rt.create({ ownerId: "u1", namespace: cfg.namespace, title: "X" });
    mgr.transition("exploring");
    mgr.transition("planning");
    mgr.rollback();
    expect(mgr.state).toBe("exploring");
  });

  it("emits typed events on transitions", () => {
    const rt = makeRuntime();
    const events: string[] = [];
    rt.bus.onAny((e) => events.push(e.name));
    const mgr = rt.create({ ownerId: "u1", namespace: cfg.namespace, title: "X" });
    mgr.transition("exploring");
    expect(events).toContain("JourneyStateChanged");
    expect(events).toContain("JourneyStageChanged");
  });
});

describe("Intent engine", () => {
  const engine = new IntentEngine();
  it("detects a keyword-driven intent", () => {
    const r = engine.detect({ text: "I want to book a flight" });
    expect(r.intent.kind).toBe("book");
    expect(r.intent.confidence).toBeGreaterThan(0.2);
  });
  it("defaults to explore on ambiguous text", () => {
    const r = engine.detect({ text: "hello world" });
    expect(r.intent.kind).toBe("explore");
  });
  it("throws on empty text", () => {
    expect(() => engine.detect({ text: "" })).toThrow();
  });
  it("records intents on the journey", () => {
    const rt = makeRuntime();
    const mgr = rt.create({ ownerId: "u1", namespace: cfg.namespace, title: "X" });
    const detected = engine.detect({ text: "compare Paris and Rome" });
    mgr.recordIntent(detected.intent);
    expect(mgr.journey.intents.length).toBe(1);
    expect(engine.latest(mgr.journey)?.kind).toBe(detected.intent.kind);
  });
  it("ranks intents deterministically", () => {
    const a = createIntent({ kind: "book", text: "b", confidence: 0.9, rank: 2 });
    const b = createIntent({ kind: "explore", text: "e", confidence: 0.3, rank: 1 });
    const ranked = engine.rank([b, a]);
    expect(ranked[0].kind).toBe("book");
  });
});

describe("Constraint engine", () => {
  const engine = new ConstraintEngine();
  it("ranks hard constraints first", () => {
    const soft = createConstraint({ kind: "budget", severity: "soft", description: "s" });
    const hard = createConstraint({ kind: "budget", severity: "hard", description: "h" });
    expect(engine.rank([soft, hard])[0].id).toBe(hard.id);
  });
  it("detects hard budget conflicts", () => {
    const a = createConstraint({ kind: "budget", severity: "hard", description: "a" });
    const b = createConstraint({ kind: "budget", severity: "hard", description: "b" });
    expect(engine.conflicts([a, b]).length).toBeGreaterThan(0);
    expect(() => engine.assertNoConflicts([a, b])).toThrow();
  });
  it("detects capacity conflicts", () => {
    const group = createConstraint({ kind: "group", severity: "hard", description: "group", params: { size: 10 } });
    const bus = createConstraint({ kind: "transport", severity: "hard", description: "bus", params: { capacity: 4 } });
    const c = engine.conflicts([group, bus]);
    expect(c.some((x) => x.kind === "capacity")).toBe(true);
  });
});

describe("Timeline engine", () => {
  const engine = new TimelineEngine();
  const window = { earliestStart: "2026-01-01T00:00:00Z", latestEnd: "2026-01-10T00:00:00Z" };

  it("builds a sorted timeline", () => {
    const t = engine.build({
      window,
      milestones: [
        createMilestone({ at: "2026-01-05T00:00:00Z", label: "B", phase: "in-trip" }),
        createMilestone({ at: "2026-01-02T00:00:00Z", label: "A", phase: "pre-trip" }),
      ],
    });
    expect(t.milestones[0].label).toBe("A");
  });

  it("detects out-of-window milestones", () => {
    const t = engine.build({
      window,
      milestones: [createMilestone({ at: "2027-01-01T00:00:00Z", label: "Late", phase: "post-trip" })],
    });
    const c = engine.conflicts(t);
    expect(c.some((x) => x.kind === "out-of-window")).toBe(true);
  });

  it("rejects inverted windows", () => {
    expect(() =>
      engine.build({
        window: { earliestStart: "2026-02-01T00:00:00Z", latestEnd: "2026-01-01T00:00:00Z" },
        milestones: [],
      }),
    ).toThrow();
  });
});

describe("Context assembly via ports", () => {
  const memory: JourneyMemoryPort = {
    async retrieve() {
      const items: JourneyMemoryItem[] = [
        { id: "m1", kind: "preference", content: "loves cold destinations", score: 0.9 },
        { id: "m2", kind: "trip", content: "past Iceland trip", score: 0.7 },
      ];
      return items;
    },
    async healthy() { return true; },
  };
  const graph: JourneyGraphPort = {
    async seedForJourney() { return ["n:iceland", "n:norway"]; },
    async neighbors(id) { return [`${id}:a`, `${id}:b`]; },
    async healthy() { return true; },
  };

  it("assembles an execution context with memory and graph expansions", async () => {
    const rt = makeRuntime({ memory, graph });
    const mgr = rt.create({ ownerId: "u1", namespace: cfg.namespace, title: "Nordics" });
    const ctx = await rt.assembleContext(mgr.id, "cold winter escape");
    expect(ctx.memory.length).toBe(2);
    expect(ctx.graph.rootNodeIds.length).toBe(2);
    expect(ctx.graph.expandedCount).toBeGreaterThan(0);
    expect(ctx.journey.id).toBe(mgr.id);
  });

  it("surfaces port failures as JourneyPortError", async () => {
    const badGraph: JourneyGraphPort = {
      async seedForJourney() { throw new Error("boom"); },
      async neighbors() { return []; },
      async healthy() { return false; },
    };
    const rt = makeRuntime({ memory, graph: badGraph });
    const mgr = rt.create({ ownerId: "u1", namespace: cfg.namespace, title: "X" });
    await expect(rt.assembleContext(mgr.id)).rejects.toThrow(/graph/);
  });

  it("returns a healthy aggregate when ports are up", async () => {
    const rt = makeRuntime({ memory, graph });
    const h = await rt.health();
    expect(h.status).toBe("healthy");
  });
});

describe("Registry", () => {
  it("caps journeys per process", () => {
    const tight = defineJourneyConfig({ namespace: "cap", policies: { maxJourneysPerProcess: 2 } });
    const rt = new JourneyRuntime({ config: tight });
    rt.create({ ownerId: "u", namespace: "cap", title: "1" });
    rt.create({ ownerId: "u", namespace: "cap", title: "2" });
    expect(() => rt.create({ ownerId: "u", namespace: "cap", title: "3" })).toThrow();
  });
  it("supports lookup by owner", () => {
    const rt = makeRuntime();
    rt.create({ ownerId: "alice", namespace: cfg.namespace, title: "A" });
    rt.create({ ownerId: "bob", namespace: cfg.namespace, title: "B" });
    expect(rt.registry.listByOwner("alice").length).toBe(1);
  });
  it("deletes journeys and emits an event", () => {
    const rt = makeRuntime();
    const evts: string[] = [];
    rt.bus.onAny((e) => evts.push(e.name));
    const mgr = rt.create({ ownerId: "u", namespace: cfg.namespace, title: "T" });
    expect(rt.delete(mgr.id)).toBe(true);
    expect(evts).toContain("JourneyDeleted");
  });
});

describe("Events", () => {
  it("makeEvent freezes envelope", () => {
    const e = makeEvent({
      name: "JourneyCreated",
      journeyId: "j",
      ownerId: "o",
      namespace: "n",
      version: 1,
      payload: { hello: "world" },
    });
    expect(Object.isFrozen(e)).toBe(true);
    expect(e.correlationId).toBeTruthy();
  });
  it("bus routes named and global listeners", () => {
    const bus = new JourneyEventBus();
    const named: string[] = [];
    const any: string[] = [];
    bus.on("JourneyCreated", (e) => named.push(e.name));
    bus.onAny((e) => any.push(e.name));
    bus.publish(makeEvent({
      name: "JourneyCreated", journeyId: "j", ownerId: "o", namespace: "n", version: 1, payload: {},
    }));
    expect(named).toEqual(["JourneyCreated"]);
    expect(any).toEqual(["JourneyCreated"]);
  });
});

describe("Validation", () => {
  it("validates a well-formed journey", () => {
    const rt = makeRuntime();
    const mgr = rt.create({ ownerId: "u", namespace: cfg.namespace, title: "T" });
    expect(validateJourney(mgr.journey).ok).toBe(true);
  });
});

describe("Concurrency & stress", () => {
  it("assembles many contexts concurrently", async () => {
    const rt = makeRuntime({
      memory: { async retrieve() { return []; }, async healthy() { return true; } },
      graph: { async seedForJourney() { return []; }, async neighbors() { return []; }, async healthy() { return true; } },
    });
    const mgrs = Array.from({ length: 50 }, (_, i) =>
      rt.create({ ownerId: `u${i}`, namespace: cfg.namespace, title: `J${i}` }),
    );
    const contexts = await Promise.all(mgrs.map((m) => rt.assembleContext(m.id)));
    expect(contexts.length).toBe(50);
    expect(new Set(contexts.map((c) => c.id)).size).toBe(50);
  });

  it("benchmark: assembles 200 contexts under 2s", async () => {
    const rt = makeRuntime();
    const mgrs = Array.from({ length: 200 }, (_, i) =>
      rt.create({ ownerId: `u${i}`, namespace: cfg.namespace, title: `J${i}` }),
    );
    const started = Date.now();
    await Promise.all(mgrs.map((m) => rt.assembleContext(m.id)));
    expect(Date.now() - started).toBeLessThan(2_000);
  });
});
