/**
 * Travel Decision Intelligence Engine — Sprint I-007 test suite.
 * Unit, integration, ranking, scoring, trade-off, explanation, lifecycle,
 * concurrency and stress tests.
 */

import { describe, expect, it } from "vitest";
import {
  ConstraintEngine, DECISION_CAPABILITY_MANIFEST, DecisionEventBus,
  DecisionRuntime, ExplanationEngine, OptionGenerator, RankingEngine,
  ScoringEngine, TradeoffEngine, canTransition, createConstraint,
  createDecisionRuntime, createOption, defineDecisionConfig, normalizeWeights,
} from "../../src/lib/decision";
import type { DecisionOption, ScoreDimension } from "../../src/lib/decision";

function makeOption(title: string, features: Partial<Record<ScoreDimension, number>>, tags: string[] = []) {
  return createOption({ title, features, tags });
}

describe("config & weights", () => {
  it("normalizes weights so they sum to 1", () => {
    const w = normalizeWeights({ budget: 2, time: 2 });
    const sum = Object.values(w).reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(1, 5);
  });
  it("rejects invalid namespace", () => {
    expect(() => defineDecisionConfig({ namespace: "!!" })).toThrow();
  });
});

describe("state machine", () => {
  it("permits legal transitions", () => {
    expect(canTransition("created", "collecting_context")).toBe(true);
    expect(canTransition("collecting_context", "generating_options")).toBe(true);
  });
  it("rejects illegal transitions", () => {
    expect(canTransition("created", "approved")).toBe(false);
  });
});

describe("scoring engine", () => {
  const scoring = new ScoringEngine();
  it("produces overall in [0,1]", () => {
    const cfg = defineDecisionConfig({ namespace: "test" });
    const opt = makeOption("A", { budget: 0.8, time: 0.6, comfort: 0.7 });
    const s = scoring.score(opt, { weights: cfg.weights });
    expect(s.overall).toBeGreaterThanOrEqual(0);
    expect(s.overall).toBeLessThanOrEqual(1);
    expect(s.dimensions.length).toBeGreaterThan(0);
  });
  it("blends preferences via tags", () => {
    const cfg = defineDecisionConfig({ namespace: "test" });
    const opt = makeOption("A", { preference: 0.5 }, ["beach"]);
    const withPref = scoring.score(opt, { weights: cfg.weights, preferences: { beach: 1 } });
    const withoutPref = scoring.score(opt, { weights: cfg.weights });
    expect(withPref.overall).toBeGreaterThanOrEqual(withoutPref.overall - 0.01);
  });
});

describe("constraint engine", () => {
  const engine = new ConstraintEngine();
  it("flags hard violations", () => {
    const opt = makeOption("Pricey", { budget: 0.1 });
    const c = createConstraint({
      kind: "budget", severity: "hard", description: "budget>=0.5",
      predicate: (o: DecisionOption) => o.features.budget >= 0.5,
    });
    const ev = engine.evaluate(opt, [c]);
    expect(ev.satisfiesHardConstraints).toBe(false);
    expect(ev.violated).toHaveLength(1);
  });
  it("detects hard-vs-hard conflicts", () => {
    const a = createConstraint({ kind: "budget", severity: "hard", description: "a", params: { max: 100 } });
    const b = createConstraint({ kind: "budget", severity: "hard", description: "b", params: { max: 50 } });
    expect(() => engine.detectConflicts([a, b])).toThrow();
  });
});

describe("ranking engine", () => {
  const scoring = new ScoringEngine();
  const ranking = new RankingEngine();
  const cfg = defineDecisionConfig({ namespace: "test" });
  it("orders by overall score and is stable", () => {
    const a = makeOption("A", { budget: 0.9, time: 0.9, comfort: 0.9 });
    const b = makeOption("B", { budget: 0.5, time: 0.5, comfort: 0.5 });
    const scores = scoring.scoreMany([a, b], { weights: cfg.weights });
    const ranked = ranking.rank({ options: [a, b], scores });
    expect(ranked[0].optionId).toBe(a.id);
    expect(ranked[1].optionId).toBe(b.id);
  });
  it("respects topN", () => {
    const opts = Array.from({ length: 10 }, (_, i) => makeOption(`o${i}`, { budget: i / 10 }));
    const scores = scoring.scoreMany(opts, { weights: cfg.weights });
    const ranked = ranking.rank({ options: opts, scores, topN: 3 });
    expect(ranked).toHaveLength(3);
  });
});

describe("tradeoff engine", () => {
  const scoring = new ScoringEngine();
  const tradeoffs = new TradeoffEngine();
  const cfg = defineDecisionConfig({ namespace: "test" });
  it("detects opposing dimension strengths", () => {
    const cheap = makeOption("Cheap", { budget: 0.9, time: 0.2 });
    const fast = makeOption("Fast", { budget: 0.2, time: 0.9 });
    const scores = scoring.scoreMany([cheap, fast], { weights: cfg.weights });
    const t = tradeoffs.compute([cheap, fast], scores);
    expect(t.length).toBeGreaterThan(0);
  });
});

describe("explanation engine", () => {
  it("produces a summary and rationale", async () => {
    const runtime = createDecisionRuntime({ namespace: "test" });
    const mgr = runtime.create({ ownerId: "u1", title: "Weekend getaway" });
    await runtime.evaluate({
      decisionId: mgr.id,
      generation: {
        seeds: [
          { title: "Kyoto", features: { budget: 0.7, time: 0.6, comfort: 0.8 }, tags: ["culture"] },
          { title: "Tokyo", features: { budget: 0.5, time: 0.9, comfort: 0.7 }, tags: ["city"] },
        ],
      },
    });
    expect(mgr.decision.explanation).toBeDefined();
    expect(mgr.decision.explanation!.summary).toContain("Selected");
    expect(mgr.decision.explanation!.rationale.length + mgr.decision.explanation!.whyTop.length).toBeGreaterThan(0);
    const _explainer = new ExplanationEngine(); // ensure class exported
    void _explainer;
  });
});

describe("lifecycle & events", () => {
  it("emits state change events through the pipeline", async () => {
    const bus = new DecisionEventBus();
    const events: string[] = [];
    bus.onAny((e) => events.push(e.name));
    const runtime = new DecisionRuntime({ config: defineDecisionConfig({ namespace: "test" }), bus });
    const mgr = runtime.create({ ownerId: "u", title: "X" });
    await runtime.evaluate({
      decisionId: mgr.id,
      generation: { seeds: [{ title: "A", features: { budget: 0.8 } }] },
    });
    expect(events).toContain("DecisionCreated");
    expect(events).toContain("DecisionScored");
    expect(events).toContain("DecisionRanked");
    expect(events).toContain("DecisionExplained");
  });

  it("supports rollback", async () => {
    const runtime = createDecisionRuntime({ namespace: "test" });
    const mgr = runtime.create({ ownerId: "u", title: "X" });
    mgr.transition("collecting_context");
    mgr.rollback();
    expect(mgr.state).toBe("created");
  });

  it("archives decisions", async () => {
    const runtime = createDecisionRuntime({ namespace: "test" });
    const mgr = runtime.create({ ownerId: "u", title: "X" });
    mgr.archive();
    expect(mgr.state).toBe("archived");
  });
});

describe("generator", () => {
  it("caps output at maxOptions", () => {
    const gen = new OptionGenerator();
    const opts = gen.generate({
      seeds: Array.from({ length: 10 }, (_, i) => ({ title: `S${i}` })),
      maxOptions: 4,
    });
    expect(opts).toHaveLength(4);
  });
});

describe("full pipeline integration", () => {
  it("evaluates decisions end-to-end with constraints and preferences", async () => {
    const runtime = createDecisionRuntime({ namespace: "test" });
    const constraints = [
      createConstraint({
        kind: "budget", severity: "hard", description: "budget>=0.4",
        predicate: (o) => o.features.budget >= 0.4,
      }),
    ];
    const mgr = runtime.create({
      ownerId: "u1",
      title: "City break",
      constraints,
      preferences: { culture: 0.8 },
    });
    const result = await runtime.evaluate({
      decisionId: mgr.id,
      generation: {
        seeds: [
          { title: "Rome",   features: { budget: 0.7, comfort: 0.7, journeyFit: 0.7 }, tags: ["culture"] },
          { title: "Vegas",  features: { budget: 0.2, comfort: 0.9, journeyFit: 0.4 }, tags: ["nightlife"] },
          { title: "Berlin", features: { budget: 0.6, comfort: 0.6, journeyFit: 0.6 }, tags: ["culture"] },
        ],
      },
      topN: 5,
    });
    expect(result.decision.ranked.length).toBeGreaterThan(0);
    expect(result.decision.ranked[0].satisfiesHardConstraints).toBe(true);
    // Vegas should be filtered by hard constraint (budget 0.2 < 0.4).
    const vegasRanked = result.decision.ranked.find((r) => r.optionId === result.decision.options[1].id);
    expect(vegasRanked).toBeUndefined();
  });
});

describe("concurrency", () => {
  it("evaluates many decisions in parallel", async () => {
    const runtime = createDecisionRuntime({ namespace: "test" });
    const promises = Array.from({ length: 25 }, async (_, i) => {
      const mgr = runtime.create({ ownerId: `u${i}`, title: `D${i}` });
      await runtime.evaluate({
        decisionId: mgr.id,
        generation: {
          seeds: [
            { title: "A", features: { budget: 0.6 } },
            { title: "B", features: { budget: 0.4 } },
          ],
        },
      });
      return mgr.decision.ranked[0]?.optionId;
    });
    const results = await Promise.all(promises);
    expect(results.filter(Boolean)).toHaveLength(25);
  });
});

describe("stress", () => {
  it("handles 200 options across ranking under 2s", async () => {
    const runtime = createDecisionRuntime({ namespace: "test" });
    const seeds = Array.from({ length: 200 }, (_, i) => ({
      title: `Opt${i}`,
      features: {
        budget: (i % 10) / 10, time: ((i + 1) % 10) / 10, comfort: ((i + 2) % 10) / 10,
      } as Partial<Record<ScoreDimension, number>>,
    }));
    const mgr = runtime.create({ ownerId: "u", title: "stress" });
    const t0 = Date.now();
    await runtime.evaluate({ decisionId: mgr.id, generation: { seeds } });
    const ms = Date.now() - t0;
    expect(mgr.decision.ranked.length).toBeGreaterThan(0);
    expect(ms).toBeLessThan(2000);
  });
});

describe("manifest & health", () => {
  it("exposes the capability manifest", () => {
    expect(DECISION_CAPABILITY_MANIFEST.name).toBe("travel-decision-intelligence-engine");
    expect(DECISION_CAPABILITY_MANIFEST.capabilities.length).toBeGreaterThan(0);
  });
  it("reports aggregated health", async () => {
    const runtime = createDecisionRuntime({ namespace: "test" });
    const h = await runtime.health();
    expect(h.status).toBeDefined();
    expect(h.checks.length).toBeGreaterThan(0);
  });
});
