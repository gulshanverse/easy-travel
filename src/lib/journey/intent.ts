/**
 * Journey Intent Engine.
 * Deterministic heuristic-based intent detection & ranking. No LLM calls;
 * the runtime is provider-independent.
 */

import { createIntent } from "./factories";
import type { IntentKind, Journey, JourneyIntent } from "./types";
import { JourneyIntentError } from "./errors";

const KEYWORD_MAP: ReadonlyArray<{ kind: IntentKind; keywords: readonly string[] }> = [
  { kind: "book", keywords: ["book", "reserve", "confirm booking", "pay"] },
  { kind: "cancel", keywords: ["cancel", "refund", "drop"] },
  { kind: "modify", keywords: ["change", "modify", "update", "edit", "reschedule"] },
  { kind: "compare", keywords: ["compare", "vs", "difference", "which"] },
  { kind: "confirm", keywords: ["confirm", "finalize", "lock", "approve"] },
  { kind: "recall", keywords: ["remember", "recall", "last time", "previous"] },
  { kind: "advise", keywords: ["should i", "recommend", "advice", "suggest"] },
  { kind: "plan", keywords: ["plan", "itinerary", "schedule", "organize"] },
  { kind: "explore", keywords: ["explore", "inspire", "ideas", "where"] },
];

export interface IntentDetectionInput {
  readonly text: string;
  readonly signals?: Readonly<Record<string, unknown>>;
}

export interface IntentDetectionResult {
  readonly intent: JourneyIntent;
  readonly alternatives: readonly JourneyIntent[];
}

export class IntentEngine {
  detect(input: IntentDetectionInput): IntentDetectionResult {
    if (!input.text || !input.text.trim())
      throw new JourneyIntentError("intent text is empty");
    const text = input.text.toLowerCase();
    const scores: { kind: IntentKind; score: number }[] = KEYWORD_MAP.map(({ kind, keywords }) => {
      let hits = 0;
      for (const k of keywords) if (text.includes(k)) hits++;
      return { kind, score: hits };
    }).filter((s) => s.score > 0);

    if (scores.length === 0) {
      // default: explore, low confidence
      return {
        intent: createIntent({ kind: "explore", text: input.text, confidence: 0.2, rank: 0, signals: input.signals }),
        alternatives: [],
      };
    }

    scores.sort((a, b) => b.score - a.score);
    const top = scores[0];
    const total = scores.reduce((s, x) => s + x.score, 0);
    const primary = createIntent({
      kind: top.kind,
      text: input.text,
      confidence: Math.min(1, 0.4 + top.score / (total + 1)),
      rank: scores.length,
      signals: input.signals,
    });
    const alts = scores.slice(1).map((s, i) =>
      createIntent({
        kind: s.kind,
        text: input.text,
        confidence: Math.min(0.9, 0.3 + s.score / (total + 1)),
        rank: scores.length - 1 - i,
        signals: input.signals,
      }),
    );
    return { intent: primary, alternatives: alts };
  }

  /** Classify existing intents against the current journey state to detect evolution. */
  evolution(journey: Journey, next: JourneyIntent): {
    readonly changed: boolean;
    readonly previous?: JourneyIntent;
    readonly delta: number;
  } {
    const prev = journey.intents.at(-1);
    if (!prev) return { changed: true, delta: next.confidence };
    if (prev.kind === next.kind) return { changed: false, previous: prev, delta: next.confidence - prev.confidence };
    return { changed: true, previous: prev, delta: next.confidence };
  }

  /** Rank a set of intents by (confidence * 0.7 + normalized-rank * 0.3). */
  rank(intents: readonly JourneyIntent[]): readonly JourneyIntent[] {
    if (intents.length === 0) return [];
    const maxRank = Math.max(1, ...intents.map((i) => i.rank));
    return [...intents].sort((a, b) => {
      const sa = a.confidence * 0.7 + (a.rank / maxRank) * 0.3;
      const sb = b.confidence * 0.7 + (b.rank / maxRank) * 0.3;
      return sb - sa;
    });
  }

  /** Latest intent = the tail of the history (chronological insertion). */
  latest(journey: Journey): JourneyIntent | null {
    return journey.intents.at(-1) ?? null;
  }
}
