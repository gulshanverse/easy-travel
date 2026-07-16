/**
 * Trust & Evidence Engine — TrustManager.
 * Orchestrates evidence intake, scoring, conflict detection and trust
 * computation. Emits typed events and records history for observability.
 */
import type { TrustConfig } from "./config";
import { calculateConfidence } from "./confidence";
import { detectConflicts } from "./conflict";
import { ConflictError } from "./errors";
import { TrustEventBus } from "./events";
import { makeBundle, makeReference, makeSnapshot } from "./factories";
import { newDecisionId, newTrustId } from "./ids";
import { TrustMetrics } from "./metrics";
import { DEFAULT_POLICIES, levelFor, levelSatisfies, policyReasons, type TrustPolicy } from "./policies";
import { ProvenanceStore } from "./provenance";
import { EvidenceRegistry, SourceRegistry } from "./registry";
import { scoreEvidence } from "./scoring";
import type { TrustTelemetrySink } from "./telemetry";
import type {
  Evidence, EvidenceBundle, EvidenceConflict, EvidenceScore, EvidenceSnapshot,
  EvidenceSource, TrustDecision, TrustHistoryEntry, TrustScore, TrustSnapshot,
} from "./types";

export interface TrustManagerDeps {
  readonly config: TrustConfig;
  readonly telemetry: TrustTelemetrySink;
  readonly events: TrustEventBus;
  readonly metrics: TrustMetrics;
  readonly now: () => number;
}

export class TrustManager {
  readonly sources = new SourceRegistry();
  readonly evidence = new EvidenceRegistry();
  readonly provenance = new ProvenanceStore();
  private readonly policies = new Map<string, TrustPolicy>();
  private readonly history = new Map<string, TrustHistoryEntry[]>();
  private readonly conflicts = new Map<string, EvidenceConflict>();

  constructor(private readonly deps: TrustManagerDeps) {
    for (const p of DEFAULT_POLICIES) this.policies.set(p.id, p);
  }

  /* ---------- Source management ---------- */
  registerSource(source: EvidenceSource): EvidenceSource {
    const s = this.sources.register(source);
    this.deps.metrics.inc("trust.source.registered");
    this.deps.events.emit({
      name: "SourceRegistered", at: this.deps.now(),
      data: { sourceId: s.id, category: s.category },
    });
    return s;
  }
  invalidateSource(sourceId: string): EvidenceSource {
    const s = this.sources.invalidate(sourceId, this.deps.now());
    this.deps.metrics.inc("trust.source.invalidated");
    this.deps.events.emit({
      name: "SourceInvalidated", at: this.deps.now(),
      data: { sourceId },
    });
    return s;
  }

  /* ---------- Evidence intake ---------- */
  addEvidence(evidence: Evidence): Evidence {
    const e = this.evidence.add(evidence, this.sources.ids());
    this.provenance.register(e);
    this.deps.metrics.inc("trust.evidence.added");
    this.deps.events.emit({
      name: "EvidenceAdded", at: this.deps.now(),
      subject: e.subject, data: { evidenceId: e.id, sourceId: e.sourceId },
    });
    return e;
  }
  updateEvidence(previous: Evidence, next: Evidence, diffSummary = "update"): Evidence {
    this.evidence.remove(previous.id);
    const e = this.evidence.add(next, this.sources.ids());
    this.provenance.recordUpdate(previous, e, diffSummary);
    this.deps.metrics.inc("trust.evidence.updated");
    this.deps.events.emit({
      name: "EvidenceUpdated", at: this.deps.now(),
      subject: e.subject, data: { evidenceId: e.id, prevId: previous.id },
    });
    return e;
  }
  rejectEvidence(evidenceId: string, reason: string): void {
    const e = this.evidence.get(evidenceId);
    if (!e) return;
    this.evidence.remove(evidenceId);
    this.deps.metrics.inc("trust.evidence.rejected");
    this.deps.events.emit({
      name: "EvidenceRejected", at: this.deps.now(),
      subject: e.subject, data: { evidenceId, reason },
    });
  }

  /* ---------- Policies ---------- */
  registerPolicy(policy: TrustPolicy): TrustPolicy {
    this.policies.set(policy.id, policy);
    return policy;
  }
  getPolicy(id: string): TrustPolicy {
    return this.policies.get(id) ?? this.policies.get("policy.default")!;
  }

  /* ---------- Scoring & bundles ---------- */
  bundleFor(subject: string): EvidenceBundle {
    const ev = this.evidence.forSubject(subject);
    const refs = ev.map((e) => makeReference(e, 1));
    return makeBundle(subject, refs, this.deps.now());
  }

  scoreBundle(bundle: EvidenceBundle): readonly EvidenceScore[] {
    const now = this.deps.now();
    const out: EvidenceScore[] = [];
    for (const ref of bundle.references) {
      const e = this.evidence.require(ref.evidenceId);
      const s = this.sources.require(e.sourceId);
      out.push(scoreEvidence(e, s, this.deps.config, now));
    }
    return Object.freeze(out);
  }

  /* ---------- Trust computation ---------- */
  computeTrust(subject: string): TrustScore {
    return this.deps.telemetry.span("trust.compute", () => {
      const bundle = this.bundleFor(subject);
      const evidence = bundle.references.map((r) => this.evidence.require(r.evidenceId));
      const scores = this.scoreBundle(bundle);
      const confidence = calculateConfidence({ evidence, scores }, this.deps.config);
      const overall = scores.length
        ? scores.reduce((acc, s) => acc + s.overall, 0) / scores.length
        : 0;
      const value = clamp01(0.6 * overall + 0.4 * confidence.value);
      const level = levelFor(value, this.deps.config);
      const conflicts = detectConflicts(evidence, this.deps.config, this.deps.now());
      for (const c of conflicts) {
        this.conflicts.set(c.id, c);
        this.deps.events.emit({
          name: "ConflictDetected", at: this.deps.now(),
          subject, data: { conflictId: c.id, kind: c.kind, evidenceIds: c.evidenceIds },
        });
      }
      const reasons = buildReasons(evidence.length, confidence.agreement, conflicts.length);
      const score: TrustScore = Object.freeze({
        id: newTrustId(),
        subject,
        bundleId: bundle.id,
        level,
        value,
        confidence,
        evidenceScores: scores,
        reasons,
        computedAt: this.deps.now(),
      });
      this.recordHistory(score);
      this.deps.metrics.inc("trust.score.computed");
      this.deps.metrics.observe("trust.score.value", value);
      this.deps.events.emit({
        name: "TrustCalculated", at: this.deps.now(),
        subject, data: { trustId: score.id, value, level },
      });
      this.deps.events.emit({
        name: "ConfidenceCalculated", at: this.deps.now(),
        subject, data: { value: confidence.value, agreement: confidence.agreement },
      });
      return score;
    }, { subject });
  }

  decide(subject: string, policyId = "policy.default"): TrustDecision {
    const policy = this.getPolicy(policyId);
    const score = this.computeTrust(subject);
    const level = levelFor(score.value, this.deps.config);
    const { reasons, antiReasons } = policyReasons(score.value, policy, this.deps.config);
    const allow = score.value >= policy.threshold && levelSatisfies(level, policy.requiredLevel);
    const decision: TrustDecision = Object.freeze({
      id: newDecisionId(),
      subject,
      allow,
      level,
      threshold: policy.threshold,
      score,
      explanation: Object.freeze({
        summary: `Policy ${policy.id} on subject ${subject}: ${allow ? "allow" : "deny"}`,
        reasons,
        antiReasons,
      }),
      decidedAt: this.deps.now(),
    });
    this.deps.events.emit({
      name: "DecisionMade", at: this.deps.now(),
      subject, data: { decisionId: decision.id, allow, level, policyId },
    });
    return decision;
  }

  /* ---------- Conflicts ---------- */
  listConflicts(): readonly EvidenceConflict[] { return Array.from(this.conflicts.values()); }
  resolveConflict(conflictId: string, resolution: string): void {
    const c = this.conflicts.get(conflictId);
    if (!c) throw new ConflictError("Unknown conflict", { conflictId });
    this.conflicts.delete(conflictId);
    this.deps.events.emit({
      name: "ConflictResolved", at: this.deps.now(),
      subject: c.subject, data: { conflictId, resolution },
    });
  }

  /* ---------- Snapshots & history ---------- */
  snapshot(): EvidenceSnapshot {
    return makeSnapshot(this.evidence.all().map((e) => e.id), this.sources.list().map((s) => s.id), this.deps.now());
  }
  trustSnapshot(subjects: readonly string[]): TrustSnapshot {
    return Object.freeze({
      id: newTrustId(),
      at: this.deps.now(),
      scores: Object.freeze(subjects.map((s) => this.computeTrust(s))),
    });
  }
  historyFor(subject: string): readonly TrustHistoryEntry[] {
    return this.history.get(subject) ?? [];
  }

  private recordHistory(score: TrustScore): void {
    const list = this.history.get(score.subject) ?? [];
    list.push({ subject: score.subject, at: score.computedAt, level: score.level, value: score.value });
    if (list.length > this.deps.config.maxHistoryPerSubject) list.shift();
    this.history.set(score.subject, list);
  }
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function buildReasons(count: number, agreement: number, conflictCount: number) {
  const reasons = [] as { code: string; message: string; weight: number }[];
  reasons.push({ code: "evidence.count", message: `${count} evidence item(s)`, weight: 0.4 });
  reasons.push({ code: "evidence.agreement", message: `Agreement ${agreement.toFixed(2)}`, weight: 0.4 });
  if (conflictCount > 0) reasons.push({ code: "evidence.conflicts", message: `${conflictCount} conflict(s) detected`, weight: 0.2 });
  return Object.freeze(reasons);
}
