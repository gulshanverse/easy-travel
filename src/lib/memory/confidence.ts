/**
 * Memory Engine — Confidence Framework (EDS-001 v2.0 §6).
 *
 * Confidence combines signals into a single [0,1] scalar. Effective confidence
 * at read time additionally applies a decay curve based on time-since-last-
 * reinforcement.
 */
import type { MemoryEnvelope, MemorySource } from "./types";

const EXPLICITNESS_WEIGHT: Record<MemorySource["kind"], number> = {
  user_explicit: 1.0,
  user_implicit: 0.7,
  agent_inference: 0.5,
  system_derived: 0.4,
  import: 0.6,
};

export interface ConfidenceSignals {
  freshness?: number; // [0,1]
  frequency?: number; // [0,1]
  agreement?: number; // [0,1]
  contradictions?: number; // [0,1] — higher = more contradiction
  trust?: number; // [0,1] — source trust
  evidenceWeight?: number; // [0,1] — mean evidence weight
}

export class MemoryConfidenceEngine {
  /** Compute a fresh confidence value from raw signals. */
  compute(source: MemorySource, signals: ConfidenceSignals): number {
    const expl = EXPLICITNESS_WEIGHT[source.kind] ?? 0.5;
    const parts = [
      { w: 0.2, v: signals.freshness ?? 0.6 },
      { w: 0.1, v: signals.frequency ?? 0.3 },
      { w: 0.15, v: signals.agreement ?? 0.6 },
      { w: 0.15, v: signals.trust ?? 0.6 },
      { w: 0.15, v: signals.evidenceWeight ?? 0.5 },
      { w: 0.25, v: expl },
    ];
    let sum = 0,
      wsum = 0;
    for (const p of parts) {
      sum += p.w * p.v;
      wsum += p.w;
    }
    let confidence = sum / wsum;
    const contra = signals.contradictions ?? 0;
    confidence *= 1 - Math.min(1, contra) * 0.5;
    return clamp(confidence);
  }

  /**
   * Effective confidence at read time — applies exponential decay based on
   * halfLifeSeconds and last reinforcement. HalfLife=0 disables decay.
   */
  effective(env: MemoryEnvelope, now = Date.now()): number {
    const stored = env.confidence;
    const hl = env.decayState.halfLifeSeconds;
    if (!hl) return stored;
    const last = Date.parse(env.decayState.lastReinforcedAt);
    if (!Number.isFinite(last)) return stored;
    const dtS = Math.max(0, (now - last) / 1000);
    const decayFactor = Math.pow(0.5, dtS / hl);
    return clamp(stored * decayFactor);
  }

  /** Called by retriever after a successful read; caller persists via store. */
  reinforce(env: MemoryEnvelope, now = Date.now()): MemoryEnvelope {
    return {
      ...env,
      decayState: {
        ...env.decayState,
        lastReinforcedAt: new Date(now).toISOString(),
        readCount: env.decayState.readCount + 1,
      },
      lastReadAt: new Date(now).toISOString(),
      readCount: env.readCount + 1,
    };
  }
}

function clamp(n: number): number {
  return Math.min(1, Math.max(0, n));
}
