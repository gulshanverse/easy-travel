import { describe, it, expect } from "vitest";
import { MemoryManager, MemoryRanker, loadMemoryConfiguration, MemoryFactories, type MemoryDraft } from "../../src/lib/memory";

async function envOf(overrides: Partial<MemoryDraft>) {
  const factories = new MemoryFactories(loadMemoryConfiguration());
  return factories.fromDraft({
    class: "preference", kind: "preference/x", ownerId: "u", scope: "user",
    payload: { text: "x" }, source: { kind: "user_explicit", actorId: "u" },
    importance: 0.5, confidence: 0.8, ...overrides,
  });
}

describe("MemoryRanker", () => {
  const ranker = new MemoryRanker(loadMemoryConfiguration());

  it("higher similarity yields higher score", async () => {
    const e = await envOf({});
    const a = ranker.score(e, "companion_turn", { similarity: 0.9 });
    const b = ranker.score(e, "companion_turn", { similarity: 0.1 });
    expect(a.score.final).toBeGreaterThan(b.score.final);
  });

  it("contradictions penalise", async () => {
    const e = await envOf({});
    const clean = ranker.score(e, "companion_turn", { similarity: 0.5 });
    const bad = ranker.score(e, "companion_turn", { similarity: 0.5, contradictionPenalty: 1 });
    expect(bad.score.final).toBeLessThan(clean.score.final);
  });

  it("sort is deterministic under score ties", async () => {
    const e1 = await envOf({ importance: 0.5 });
    const e2 = await envOf({ importance: 0.5 });
    const a = ranker.score(e1, "companion_turn", { similarity: 0.5 });
    const b = ranker.score(e2, "companion_turn", { similarity: 0.5 });
    const sorted1 = ranker.sort([a, b]);
    const sorted2 = ranker.sort([b, a]);
    expect(sorted1.map((x) => x.memory.memoryId)).toEqual(sorted2.map((x) => x.memory.memoryId));
  });
});

describe("MemoryManager metrics & health", () => {
  it("increments write metric per class", async () => {
    const m = new MemoryManager();
    m.metrics.reset();
    await m.write({
      class: "preference", kind: "preference/x", ownerId: "u", scope: "user",
      payload: { a: 1 }, source: { kind: "user_explicit", actorId: "u" },
    });
    const snap = m.metrics.snapshot();
    expect(snap.writes).toBe(1);
    expect(snap.byClass.preference).toBe(1);
  });

  it("health check returns healthy on fresh manager", async () => {
    const m = new MemoryManager();
    const r = await m.health.check();
    expect(r.status).toBe("healthy");
  });
});
