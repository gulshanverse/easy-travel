import { describe, it, expect } from "vitest";
import { MemoryConfidenceEngine, MemoryFactories, loadMemoryConfiguration } from "@/lib/memory";

describe("MemoryConfidenceEngine", () => {
  const conf = new MemoryConfidenceEngine();

  it("weights explicitness", () => {
    const explicit = conf.compute({ kind: "user_explicit", actorId: "u" }, {});
    const inferred = conf.compute({ kind: "agent_inference", actorId: "a" }, {});
    expect(explicit).toBeGreaterThan(inferred);
  });

  it("penalises contradictions", () => {
    const base = conf.compute({ kind: "user_explicit", actorId: "u" }, {});
    const contra = conf.compute({ kind: "user_explicit", actorId: "u" }, { contradictions: 1 });
    expect(contra).toBeLessThan(base);
  });

  it("decays over time by half-life", async () => {
    const factories = new MemoryFactories(loadMemoryConfiguration());
    const env = await factories.fromDraft({
      class: "preference", kind: "preference/cuisine", ownerId: "u", scope: "user",
      payload: {}, source: { kind: "user_explicit", actorId: "u" }, confidence: 1.0,
    });
    const now = Date.parse(env.decayState.lastReinforcedAt);
    const halfLifeMs = env.decayState.halfLifeSeconds * 1000;
    const later = conf.effective(env, now + halfLifeMs);
    expect(later).toBeCloseTo(0.5, 1);
  });

  it("reinforce increments read count and refreshes decay anchor", () => {
    const anchor = Date.parse("2026-01-01T00:00:00Z");
    const env = {
      confidence: 0.9,
      decayState: { halfLifeSeconds: 3600, lastReinforcedAt: new Date(anchor).toISOString(), readCount: 0 },
      lastReadAt: null, readCount: 0,
    } as never;
    const reinforced = conf.reinforce(env, anchor + 1000);
    expect(reinforced.readCount).toBe(1);
    expect(reinforced.decayState.readCount).toBe(1);
  });
});
