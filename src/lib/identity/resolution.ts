/**
 * Identity Platform — Preference Resolution Engine (Sprint I-018, ADR-023).
 *
 * Deterministic: identical inputs always produce identical resolutions,
 * conflicts and explanations. The engine resolves *preferences only* — it
 * never selects, books or ranks travel options (ADR-020).
 */
import {
  effectiveConfidence, isExplicit, PREFERENCE_SOURCE_PRIORITY,
  type ConfidencePreference, type PreferenceValue,
} from "./confidence";
import { deepFreeze } from "./factories";

export interface PreferencePriority {
  readonly key: string;
  readonly order: number;
  readonly required: boolean;
}

export interface PreferenceConflict {
  readonly key: string;
  readonly winner: PreferenceValue;
  readonly loser: PreferenceValue;
  readonly winningSource: string;
  readonly losingSource: string;
  readonly reason: string;
}

export interface PreferenceFallback {
  readonly value: PreferenceValue;
  readonly source: string;
  readonly available: boolean;
  readonly reason: string;
}

export interface PreferenceResolution {
  readonly key: string;
  readonly value: PreferenceValue | null;
  readonly source: string;
  readonly confidence: number;
  readonly satisfied: boolean;
  readonly chain: readonly PreferenceFallback[];
  readonly conflicts: readonly PreferenceConflict[];
  readonly explanation: readonly string[];
}

export type AvailabilityFn = (key: string, value: PreferenceValue) => boolean;

export interface ResolvePreferenceInput {
  readonly key: string;
  readonly candidates: readonly ConfidencePreference[];
  /** Explicit fallback ladder applied after candidates are exhausted. */
  readonly fallbacks?: readonly PreferenceValue[];
  readonly defaultValue?: PreferenceValue | null;
  readonly availability?: AvailabilityFn;
}

/** Deterministic candidate ordering: authority → confidence → recency → value. */
export function orderCandidates(
  candidates: readonly ConfidencePreference[],
): readonly ConfidencePreference[] {
  return Object.freeze([...candidates].sort((a, b) => {
    const pa = PREFERENCE_SOURCE_PRIORITY[a.source];
    const pb = PREFERENCE_SOURCE_PRIORITY[b.source];
    if (pa !== pb) return pb - pa;
    const ca = effectiveConfidence(a);
    const cb = effectiveConfidence(b);
    if (ca !== cb) return cb - ca;
    if (a.at !== b.at) return b.at - a.at;
    return String(a.value).localeCompare(String(b.value));
  }));
}

/** Detects competing values for the same key. Explicit always outranks observed. */
export function detectConflicts(
  candidates: readonly ConfidencePreference[],
): readonly PreferenceConflict[] {
  const ordered = orderCandidates(candidates);
  const head = ordered[0];
  if (!head) return Object.freeze([]);
  const conflicts: PreferenceConflict[] = [];
  for (const other of ordered.slice(1)) {
    if (other.value === head.value) continue;
    conflicts.push(deepFreeze({
      key: head.key,
      winner: head.value,
      loser: other.value,
      winningSource: head.source,
      losingSource: other.source,
      reason: isExplicit(head) && !isExplicit(other)
        ? "explicit preference outranks derived preference"
        : `higher authority/confidence (${effectiveConfidence(head).toFixed(3)} > ${effectiveConfidence(other).toFixed(3)})`,
    }));
  }
  return Object.freeze(conflicts);
}

export function resolvePreference(input: ResolvePreferenceInput): PreferenceResolution {
  const available: AvailabilityFn = input.availability ?? (() => true);
  const ordered = orderCandidates(input.candidates.filter((c) => c.key === input.key));
  const conflicts = detectConflicts(ordered);
  const chain: PreferenceFallback[] = [];
  const explanation: string[] = [];

  let winner: { value: PreferenceValue; source: string; confidence: number } | null = null;

  for (const candidate of ordered) {
    const ok = available(input.key, candidate.value);
    chain.push(deepFreeze({
      value: candidate.value,
      source: candidate.source,
      available: ok,
      reason: candidate.reason,
    }));
    explanation.push(
      `${ok ? "available" : "unavailable"}: ${String(candidate.value)} (${candidate.source}, confidence ${candidate.confidence.toFixed(2)})`,
    );
    if (ok && !winner) {
      winner = { value: candidate.value, source: candidate.source, confidence: candidate.confidence };
      break;
    }
  }

  if (!winner) {
    for (const value of input.fallbacks ?? []) {
      const ok = available(input.key, value);
      chain.push(deepFreeze({
        value, source: "fallback", available: ok, reason: "declared fallback rule",
      }));
      explanation.push(`${ok ? "available" : "unavailable"}: ${String(value)} (fallback)`);
      if (ok) {
        winner = { value, source: "fallback", confidence: 0.4 };
        break;
      }
    }
  }

  if (!winner && input.defaultValue != null) {
    const ok = available(input.key, input.defaultValue);
    chain.push(deepFreeze({
      value: input.defaultValue, source: "default", available: ok, reason: "engine default",
    }));
    explanation.push(`${ok ? "available" : "unavailable"}: ${String(input.defaultValue)} (default)`);
    if (ok) winner = { value: input.defaultValue, source: "default", confidence: 0.2 };
  }

  if (!winner) explanation.push("no preference could be satisfied — falling back to no preference");

  return deepFreeze({
    key: input.key,
    value: winner?.value ?? null,
    source: winner?.source ?? "none",
    confidence: winner?.confidence ?? 0,
    satisfied: winner !== null,
    chain: Object.freeze(chain),
    conflicts,
    explanation: Object.freeze(explanation),
  });
}

/** Declared fallback ladders per preference key (deterministic). */
export const PREFERENCE_FALLBACKS: Readonly<Record<string, readonly PreferenceValue[]>> =
  Object.freeze({
    preferredSeat: Object.freeze(["window", "lower", "aisle", "any"]),
    preferredCoach: Object.freeze(["ac1", "ac2", "ac3", "sleeper", "chair_car", "any"]),
    preferredCabin: Object.freeze(["first", "business", "premium_economy", "economy", "any"]),
    preferredTransport: Object.freeze(["train", "flight", "bus", "cab"]),
    preferredBudget: Object.freeze(["balanced"]),
  });

export const PREFERENCE_DEFAULTS: Readonly<Record<string, PreferenceValue>> = Object.freeze({
  preferredSeat: "any",
  preferredCoach: "any",
  preferredCabin: "any",
  preferredBudget: "balanced",
  maxTransfers: 3,
});

export interface PreferenceResolutionRequest {
  readonly keys?: readonly string[];
  readonly candidates: readonly ConfidencePreference[];
  readonly priorities?: readonly PreferencePriority[];
  readonly availability?: AvailabilityFn;
}

/** Resolves every requested key deterministically, ordered by priority then key. */
export class PreferenceResolutionEngine {
  constructor(
    private readonly fallbacks: Readonly<Record<string, readonly PreferenceValue[]>> = PREFERENCE_FALLBACKS,
    private readonly defaults: Readonly<Record<string, PreferenceValue>> = PREFERENCE_DEFAULTS,
  ) {}

  resolve(key: string, request: PreferenceResolutionRequest): PreferenceResolution {
    return resolvePreference({
      key,
      candidates: request.candidates,
      fallbacks: this.fallbacks[key],
      defaultValue: this.defaults[key] ?? null,
      availability: request.availability,
    });
  }

  resolveAll(request: PreferenceResolutionRequest): readonly PreferenceResolution[] {
    const keys = request.keys ?? [...new Set(request.candidates.map((c) => c.key))];
    const order = new Map(
      (request.priorities ?? []).map((p) => [p.key, p.order] as const),
    );
    const sorted = [...keys].sort((a, b) => {
      const oa = order.get(a) ?? Number.MAX_SAFE_INTEGER;
      const ob = order.get(b) ?? Number.MAX_SAFE_INTEGER;
      return (oa - ob) || a.localeCompare(b);
    });
    return Object.freeze(sorted.map((key) => this.resolve(key, request)));
  }

  unsatisfied(resolutions: readonly PreferenceResolution[]): readonly string[] {
    return Object.freeze(resolutions.filter((r) => !r.satisfied).map((r) => r.key));
  }

  explain(resolutions: readonly PreferenceResolution[]): readonly string[] {
    return Object.freeze(resolutions.flatMap((r) => [
      `${r.key} → ${r.value === null ? "no preference" : String(r.value)} [${r.source}]`,
      ...r.explanation.map((line) => `  ${line}`),
    ]));
  }
}

export const defaultPreferenceResolutionEngine = new PreferenceResolutionEngine();
