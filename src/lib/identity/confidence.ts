/**
 * Identity Platform — Preference Confidence (Sprint I-018).
 *
 * Every preference value carries a confidence, a source, a timestamp and a
 * human-readable reason. Observed/learned/recommended signals NEVER silently
 * overwrite an explicit user preference (ADR-024).
 */
import { IdentityValidationError } from "./errors";
import { deepFreeze } from "./factories";

export type PreferenceSource =
  | "explicit" | "observed" | "learned" | "inherited" | "recommended";

export type PreferenceValue = string | number | boolean;

export interface ConfidencePreference {
  readonly key: string;
  readonly value: PreferenceValue;
  readonly confidence: number;
  readonly source: PreferenceSource;
  readonly at: number;
  readonly reason: string;
}

/** Deterministic authority ordering. Higher wins on equal confidence. */
export const PREFERENCE_SOURCE_PRIORITY: Readonly<Record<PreferenceSource, number>> =
  Object.freeze({
    explicit: 100,
    inherited: 80,
    observed: 60,
    learned: 40,
    recommended: 20,
  });

/** Multiplier applied to raw confidence when ranking candidates. */
export const PREFERENCE_SOURCE_WEIGHT: Readonly<Record<PreferenceSource, number>> =
  Object.freeze({
    explicit: 1,
    inherited: 0.85,
    observed: 0.7,
    learned: 0.55,
    recommended: 0.4,
  });

export interface MakeConfidencePreferenceInput {
  key: string;
  value: PreferenceValue;
  confidence?: number;
  source?: PreferenceSource;
  at?: number;
  reason?: string;
}

export function makeConfidencePreference(
  input: MakeConfidencePreferenceInput,
): ConfidencePreference {
  const key = input.key.trim();
  if (!key) throw new IdentityValidationError("preference key is required");
  const source = input.source ?? "explicit";
  const confidence = input.confidence ?? (source === "explicit" ? 1 : 0.5);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new IdentityValidationError("confidence must be within [0,1]", { key, confidence });
  }
  return deepFreeze({
    key,
    value: input.value,
    confidence: Number(confidence.toFixed(4)),
    source,
    at: input.at ?? Date.now(),
    reason: input.reason ?? `${source} preference`,
  });
}

/** Confidence scaled by source authority — the deterministic ranking score. */
export function effectiveConfidence(p: ConfidencePreference): number {
  return Number((p.confidence * PREFERENCE_SOURCE_WEIGHT[p.source]).toFixed(6));
}

export function isExplicit(p: ConfidencePreference): boolean {
  return p.source === "explicit";
}

/**
 * ADR-024 — an explicit preference is only replaced by another explicit
 * preference. Non-explicit sources may only refine other non-explicit sources.
 */
export function mergeConfidencePreference(
  current: ConfidencePreference | undefined,
  incoming: ConfidencePreference,
): ConfidencePreference {
  if (!current) return incoming;
  if (current.key !== incoming.key) {
    throw new IdentityValidationError("cannot merge preferences with different keys", {
      current: current.key, incoming: incoming.key,
    });
  }
  if (isExplicit(current) && !isExplicit(incoming)) return current;
  if (!isExplicit(current) && isExplicit(incoming)) return incoming;
  const a = effectiveConfidence(current);
  const b = effectiveConfidence(incoming);
  if (b > a) return incoming;
  if (b < a) return current;
  return incoming.at >= current.at ? incoming : current;
}

export function mergePreferenceSets(
  base: readonly ConfidencePreference[],
  incoming: readonly ConfidencePreference[],
): readonly ConfidencePreference[] {
  const byKey = new Map<string, ConfidencePreference>();
  for (const p of base) byKey.set(p.key, mergeConfidencePreference(byKey.get(p.key), p));
  for (const p of incoming) byKey.set(p.key, mergeConfidencePreference(byKey.get(p.key), p));
  return Object.freeze([...byKey.values()].sort((x, y) => x.key.localeCompare(y.key)));
}

/** Observation counter → confidence, saturating and deterministic. */
export function observedConfidence(observations: number, total: number): number {
  if (total <= 0 || observations <= 0) return 0;
  const ratio = Math.min(1, observations / total);
  const volume = Math.min(1, observations / 20);
  return Number((ratio * (0.6 + 0.4 * volume)).toFixed(4));
}

export function observePreference(input: {
  key: string;
  value: PreferenceValue;
  observations: number;
  total: number;
  at?: number;
}): ConfidencePreference {
  return makeConfidencePreference({
    key: input.key,
    value: input.value,
    confidence: observedConfidence(input.observations, input.total),
    source: "observed",
    at: input.at,
    reason: `selected ${input.observations} times of ${input.total}`,
  });
}

export function explainPreference(p: ConfidencePreference): string {
  return `${p.key} = ${String(p.value)} (confidence ${p.confidence.toFixed(2)}, source ${p.source}, reason: ${p.reason})`;
}
