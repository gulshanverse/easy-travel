/**
 * Trust & Evidence Engine — unit + integration + stress tests.
 */
import { describe, expect, it } from "vitest";
import {
  calculateAgreement, calculateConfidence, createTrustRuntime, detectConflicts,
  evaluateFreshness, DEFAULT_TRUST_CONFIG, makeEvidence, makeSource,
  scoreEvidence, TRUST_CAPABILITY_MANIFEST,
} from "@/lib/trust";

function seed(runtime: ReturnType<typeof createTrustRuntime>) {
  const s1 = runtime.registerSource(makeSource({
    name: "Official Airline", category: "official", authority: 0.95, reliability: 0.9,
  }));
  const s2 = runtime.registerSource(makeSource({
    name: "Aggregator", category: "provider", authority: 0.7, reliability: 0.75,
  }));
  return { s1, s2 };
}

describe("TrustRuntime", () => {
  it("registers sources and evidence and computes a trust score", () => {
    const runtime = createTrustRuntime();
    const { s1, s2 } = seed(runtime);
    runtime.addEvidence(makeEvidence({ sourceId: s1.id, kind: "fact", subject: "flight:AA123", claim: "on-time" }));
    runtime.addEvidence(makeEvidence({ sourceId: s2.id, kind: "fact", subject: "flight:AA123", claim: "on-time" }));
    const score = runtime.computeTrust("flight:AA123");
    expect(score.value).toBeGreaterThan(0.5);
    expect(score.evidenceScores).toHaveLength(2);
    expect(["medium", "high", "verified"]).toContain(score.level);
    expect(score.confidence.agreement).toBe(1);
  });

  it("detects value conflicts across disagreeing sources", () => {
    const runtime = createTrustRuntime();
    const { s1, s2 } = seed(runtime);
    runtime.addEvidence(makeEvidence({ sourceId: s1.id, kind: "fact", subject: "hotel:HX1", claim: "5-star" }));
    runtime.addEvidence(makeEvidence({ sourceId: s2.id, kind: "fact", subject: "hotel:HX1", claim: "3-star" }));
    runtime.computeTrust("hotel:HX1");
    const conflicts = runtime.listConflicts();
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts.some((c) => c.kind === "value" || c.kind === "source")).toBe(true);
  });

  it("freshness decays with age and expires past validUntil", () => {
    const cfg = DEFAULT_TRUST_CONFIG;
    const now = 1_000_000_000_000;
    const ev = makeEvidence({
      sourceId: "src_x", kind: "fact", subject: "s", claim: "c",
      collectedAt: now - cfg.freshnessHalfLifeMs,
    });
    const fresh = evaluateFreshness(ev, cfg, now);
    expect(fresh.score).toBeGreaterThan(0.45);
    expect(fresh.score).toBeLessThan(0.55);

    const expiredEv = makeEvidence({
      sourceId: "src_x", kind: "fact", subject: "s", claim: "c",
      collectedAt: now - 1000, validUntil: now - 500,
    });
    const expired = evaluateFreshness(expiredEv, cfg, now);
    expect(expired.expired).toBe(true);
    expect(expired.score).toBe(0);
  });

  it("scores evidence deterministically", () => {
    const source = makeSource({ name: "s", category: "official", authority: 0.8, reliability: 0.8 });
    const ev = makeEvidence({ sourceId: source.id, kind: "fact", subject: "s", claim: "c", collectedAt: Date.now() });
    const s1 = scoreEvidence(ev, source, DEFAULT_TRUST_CONFIG, Date.now());
    const s2 = scoreEvidence(ev, source, DEFAULT_TRUST_CONFIG, Date.now());
    expect(s1.overall).toBeCloseTo(s2.overall, 5);
    expect(s1.overall).toBeGreaterThan(0.5);
  });

  it("calculates agreement and confidence over an evidence set", () => {
    const src = "src_a";
    const ev = [
      makeEvidence({ sourceId: src, kind: "fact", subject: "s", claim: "A" }),
      makeEvidence({ sourceId: src, kind: "fact", subject: "s", claim: "A" }),
      makeEvidence({ sourceId: src, kind: "fact", subject: "s", claim: "B" }),
    ];
    expect(calculateAgreement(ev)).toBeCloseTo(2 / 3, 5);
    const scores = ev.map(() => ({
      evidenceId: "x", quality: 0.8, freshness: 0.9, reliability: 0.8, authority: 0.9, overall: 0.85,
    }));
    const conf = calculateConfidence({ evidence: ev, scores }, DEFAULT_TRUST_CONFIG);
    expect(conf.value).toBeGreaterThan(0);
    expect(conf.value).toBeLessThanOrEqual(1);
    expect(conf.sampleSize).toBe(3);
  });

  it("emits typed events across the pipeline", () => {
    const runtime = createTrustRuntime();
    const seen: string[] = [];
    const unsub = runtime.onEvent((e) => seen.push(e.name));
    const { s1 } = seed(runtime);
    runtime.addEvidence(makeEvidence({ sourceId: s1.id, kind: "fact", subject: "s", claim: "c" }));
    runtime.computeTrust("s");
    unsub();
    expect(seen).toContain("SourceRegistered");
    expect(seen).toContain("EvidenceAdded");
    expect(seen).toContain("TrustCalculated");
    expect(seen).toContain("ConfidenceCalculated");
  });

  it("decides against a policy with reasons", () => {
    const runtime = createTrustRuntime();
    const { s1 } = seed(runtime);
    runtime.addEvidence(makeEvidence({ sourceId: s1.id, kind: "fact", subject: "book:1", claim: "confirmed" }));
    const strict = runtime.decide("book:1", "policy.strict");
    expect(strict.threshold).toBeCloseTo(0.9);
    expect(typeof strict.allow).toBe("boolean");
    const lax = runtime.decide("book:1", "policy.lax");
    expect(lax.allow).toBe(true);
    expect(lax.explanation.reasons.length + lax.explanation.antiReasons.length).toBeGreaterThan(0);
  });

  it("invalidates sources and records provenance", () => {
    const runtime = createTrustRuntime();
    const { s1 } = seed(runtime);
    const ev = runtime.addEvidence(makeEvidence({ sourceId: s1.id, kind: "fact", subject: "x", claim: "a" }));
    expect(runtime.manager.provenance.get(ev.id)?.originSourceId).toBe(s1.id);
    const invalidated = runtime.invalidateSource(s1.id);
    expect(invalidated.invalidatedAt).toBeDefined();
  });

  it("history is bounded per subject", () => {
    const runtime = createTrustRuntime({ config: { maxHistoryPerSubject: 3 } });
    const { s1 } = seed(runtime);
    runtime.addEvidence(makeEvidence({ sourceId: s1.id, kind: "fact", subject: "z", claim: "c" }));
    for (let i = 0; i < 10; i++) runtime.computeTrust("z");
    expect(runtime.historyFor("z").length).toBe(3);
  });

  it("health check aggregates registry state", async () => {
    const runtime = createTrustRuntime();
    seed(runtime);
    const h = await runtime.health();
    expect(h.healthy).toBe(true);
    expect(h.sizes.sources).toBe(2);
  });

  it("exposes a stable capability manifest", () => {
    expect(TRUST_CAPABILITY_MANIFEST.id).toBe("trust");
    expect(TRUST_CAPABILITY_MANIFEST.capabilities.length).toBeGreaterThan(5);
  });

  it("stress: 1000 evidence items across 100 subjects computes under 2s", () => {
    const runtime = createTrustRuntime();
    const { s1, s2 } = seed(runtime);
    for (let i = 0; i < 1000; i++) {
      const src = i % 2 === 0 ? s1.id : s2.id;
      runtime.addEvidence(makeEvidence({
        sourceId: src, kind: "fact", subject: `subj:${i % 100}`,
        claim: (i % 5).toString(),
      }));
    }
    const t0 = Date.now();
    for (let i = 0; i < 100; i++) runtime.computeTrust(`subj:${i}`);
    expect(Date.now() - t0).toBeLessThan(2000);
  });

  it("detectConflicts is a pure function", () => {
    const src = "src_a";
    const now = Date.now();
    const ev = [
      makeEvidence({ sourceId: src, kind: "fact", subject: "z", claim: "a" }),
      makeEvidence({ sourceId: src, kind: "fact", subject: "z", claim: "b" }),
      makeEvidence({ sourceId: src, kind: "fact", subject: "z", claim: "c" }),
    ];
    const conflicts = detectConflicts(ev, DEFAULT_TRUST_CONFIG, now);
    expect(conflicts.length).toBeGreaterThan(0);
  });
});
