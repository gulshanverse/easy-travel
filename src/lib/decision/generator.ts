/**
 * Option Generation Engine.
 * Deterministic candidate generation. Never calls providers or LLMs.
 * Combines seed candidates with signals from journey, graph, memory,
 * preferences, budget and timeline hints.
 */

import { createOption, freezeFeatures } from "./factories";
import type { DecisionOption, DecisionOptionKind, ScoreDimension } from "./types";

export interface OptionSeed {
  readonly title: string;
  readonly kind?: DecisionOptionKind;
  readonly summary?: string;
  readonly attributes?: Record<string, unknown>;
  readonly features?: Partial<Record<ScoreDimension, number>>;
  readonly tags?: readonly string[];
}

export interface GenerationSignals {
  readonly journeyBudgetMinor?: number;
  readonly journeyCurrency?: string;
  readonly preferenceKeys?: readonly string[];
  readonly destinationTags?: readonly string[];
  readonly memoryHints?: readonly string[];
  readonly graphSeedNodeIds?: readonly string[];
  readonly historicalTitles?: readonly string[];
}

export interface GenerationInput {
  readonly seeds: readonly OptionSeed[];
  readonly signals?: GenerationSignals;
  readonly maxOptions?: number;
}

export class OptionGenerator {
  generate(input: GenerationInput): readonly DecisionOption[] {
    const seeds = input.seeds ?? [];
    const sig = input.signals ?? {};
    const preferenceSet = new Set((sig.preferenceKeys ?? []).map((k) => k.toLowerCase()));
    const destinationTagSet = new Set((sig.destinationTags ?? []).map((k) => k.toLowerCase()));

    const derived: OptionSeed[] = [];
    if (sig.historicalTitles?.length) {
      for (const t of sig.historicalTitles) {
        derived.push({
          title: `Historical: ${t}`,
          kind: "itinerary",
          tags: ["historical"],
          features: { preference: 0.6, journeyFit: 0.7 },
        });
      }
    }
    if (sig.graphSeedNodeIds?.length) {
      for (const nodeId of sig.graphSeedNodeIds) {
        derived.push({
          title: `Related: ${nodeId}`,
          kind: "destination",
          tags: ["graph"],
          features: { journeyFit: 0.65, seasonality: 0.55 },
          attributes: { sourceNodeId: nodeId },
        });
      }
    }

    const all = [...seeds, ...derived];
    const capped = all.slice(0, Math.max(0, input.maxOptions ?? all.length));

    const options: DecisionOption[] = [];
    for (const s of capped) {
      const enriched = this.enrichFeatures(s, preferenceSet, destinationTagSet);
      options.push(createOption({
        kind: s.kind,
        title: s.title,
        summary: s.summary,
        attributes: s.attributes,
        features: enriched,
        tags: s.tags,
      }));
    }
    return Object.freeze(options);
  }

  private enrichFeatures(
    s: OptionSeed,
    preferenceSet: Set<string>,
    destinationTagSet: Set<string>,
  ): Partial<Record<ScoreDimension, number>> {
    const base = { ...(s.features ?? {}) };
    const tagLower = (s.tags ?? []).map((t) => t.toLowerCase());
    let preferenceBoost = 0;
    let journeyFitBoost = 0;
    for (const t of tagLower) {
      if (preferenceSet.has(t)) preferenceBoost += 0.15;
      if (destinationTagSet.has(t)) journeyFitBoost += 0.1;
    }
    if (preferenceBoost > 0) {
      base.preference = Math.min(1, (base.preference ?? 0.5) + preferenceBoost);
    }
    if (journeyFitBoost > 0) {
      base.journeyFit = Math.min(1, (base.journeyFit ?? 0.5) + journeyFitBoost);
    }
    // Ensure the object has all dims filled for validation.
    return freezeFeatures(base);
  }
}
