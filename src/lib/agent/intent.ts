/** ARP — deterministic intent engine (no LLM). */
import { newIntentId } from "./ids";
import type { Intent, IntentDomain, IntentPriority, IntentScope } from "./types";

interface Rule {
  readonly classification: string;
  readonly domain: IntentDomain;
  readonly priority: IntentPriority;
  readonly scope: IntentScope;
  readonly keywords: readonly string[];
  readonly weight: number;
}

const RULES: readonly Rule[] = Object.freeze([
  { classification: "book.flight", domain: "booking", priority: "high", scope: "multi-turn", keywords: ["flight", "fly", "airline"], weight: 1 },
  { classification: "book.hotel", domain: "booking", priority: "high", scope: "multi-turn", keywords: ["hotel", "stay", "lodging"], weight: 1 },
  { classification: "book.cab", domain: "booking", priority: "normal", scope: "single-turn", keywords: ["cab", "taxi", "ride"], weight: 1 },
  { classification: "plan.trip", domain: "travel", priority: "high", scope: "multi-turn", keywords: ["plan", "trip", "itinerary", "vacation", "holiday"], weight: 1 },
  { classification: "discover.destination", domain: "discovery", priority: "normal", scope: "multi-turn", keywords: ["where", "destination", "explore", "recommend"], weight: 1 },
  { classification: "budget.estimate", domain: "budget", priority: "normal", scope: "single-turn", keywords: ["budget", "cost", "price", "cheap"], weight: 1 },
  { classification: "safety.check", domain: "safety", priority: "critical", scope: "single-turn", keywords: ["safe", "safety", "risk", "warning", "advisory"], weight: 1 },
  { classification: "support.help", domain: "support", priority: "normal", scope: "single-turn", keywords: ["help", "support", "issue", "problem"], weight: 1 },
  { classification: "visa.check", domain: "travel", priority: "high", scope: "single-turn", keywords: ["visa", "passport", "immigration"], weight: 1 },
]);

export interface ClassifyOptions {
  readonly agentId: string;
  readonly rawInput: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly now?: number;
}

export class IntentEngine {
  classify(opts: ClassifyOptions): Intent {
    const text = opts.rawInput.toLowerCase();
    const scores = new Map<string, { rule: Rule; hits: number }>();
    for (const r of RULES) {
      let hits = 0;
      for (const k of r.keywords) if (text.includes(k)) hits += r.weight;
      if (hits > 0) scores.set(r.classification, { rule: r, hits });
    }
    const best = [...scores.values()].sort((a, b) => b.hits - a.hits)[0];
    const rule = best?.rule;
    const total = [...scores.values()].reduce((s, v) => s + v.hits, 0);
    const confidence = best ? Math.min(0.99, best.hits / Math.max(1, total)) : 0.1;
    return Object.freeze({
      id: newIntentId(),
      agentId: opts.agentId,
      classification: rule?.classification ?? "generic.request",
      confidence,
      priority: rule?.priority ?? "normal",
      scope: rule?.scope ?? "single-turn",
      domain: rule?.domain ?? "generic",
      constraints: Object.freeze([]),
      relationships: Object.freeze([]),
      rawInput: opts.rawInput,
      metadata: Object.freeze({ ...(opts.metadata ?? {}) }),
      createdAt: opts.now ?? Date.now(),
    });
  }
}
