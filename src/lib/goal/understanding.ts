/**
 * Goal Engine — deterministic understanding engine.
 * Classifies category, scope, complexity, duration, confidence from
 * intent + metadata using rules only. No LLM reasoning.
 */
import type { Goal, GoalCategory, GoalComplexity, GoalDurationBand, GoalScope, GoalUnderstanding } from "./types";

const CATEGORY_KEYWORDS: Readonly<Record<GoalCategory, readonly string[]>> = Object.freeze({
  trip: ["trip", "travel", "vacation", "holiday", "journey", "getaway"],
  booking: ["book", "reservation", "flight", "hotel", "stay"],
  budget: ["budget", "cost", "cheap", "afford", "save"],
  experience: ["experience", "activity", "tour", "adventure", "explore"],
  logistics: ["visa", "passport", "insurance", "packing", "transfer"],
  wellbeing: ["rest", "wellness", "spa", "relax", "retreat"],
  learning: ["learn", "class", "language", "course", "study"],
  other: [],
});

export function classifyCategory(goal: Goal): GoalCategory {
  const text = (goal.title + " " + goal.description + " " + goal.intent.summary + " " + goal.intent.keywords.join(" ")).toLowerCase();
  let best: GoalCategory = "other";
  let bestScore = 0;
  for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS) as [GoalCategory, readonly string[]][]) {
    let score = 0;
    for (const kw of kws) if (text.includes(kw)) score++;
    if (score > bestScore) { bestScore = score; best = cat; }
  }
  return bestScore === 0 ? goal.category : best;
}

export function classifyScope(goal: Goal): GoalScope {
  const windows = goal.timeline.windows.length;
  if (goal.metadata.tags.includes("recurring")) return "recurring";
  if (goal.dependencies.length > 3) return "portfolio";
  if (windows > 1) return "multi-leg";
  return goal.scope;
}

export function classifyComplexity(goal: Goal): GoalComplexity {
  const c = goal.constraints.length + goal.dependencies.length;
  if (c === 0) return "trivial";
  if (c <= 2) return "simple";
  if (c <= 5) return "moderate";
  if (c <= 10) return "complex";
  return "epic";
}

export function classifyDuration(goal: Goal): GoalDurationBand {
  const t = goal.timeline;
  if (!t.startAt || !t.targetAt) return goal.duration;
  const days = (t.targetAt - t.startAt) / (1000 * 60 * 60 * 24);
  if (days <= 1) return "instant";
  if (days <= 7) return "short";
  if (days <= 30) return "medium";
  if (days <= 180) return "long";
  return "openended";
}

export function understandGoal(goal: Goal): GoalUnderstanding {
  const category = classifyCategory(goal);
  const scope = classifyScope(goal);
  const complexity = classifyComplexity(goal);
  const duration = classifyDuration(goal);
  const signals = [
    goal.title.length > 0 ? 1 : 0,
    goal.description.length > 0 ? 1 : 0,
    goal.constraints.length > 0 ? 1 : 0,
    goal.dependencies.length > 0 ? 1 : 0,
    goal.timeline.startAt ? 1 : 0,
    goal.timeline.targetAt ? 1 : 0,
    goal.budget ? 1 : 0,
  ];
  const sum = signals.reduce((a, b) => a + b, 0);
  const value = signals.length === 0 ? 0 : sum / signals.length;
  return Object.freeze({
    goalId: goal.id,
    category,
    scope,
    complexity,
    duration,
    confidence: Object.freeze({
      value,
      sampleSize: sum,
      reasons: Object.freeze([`signals ${sum}/${signals.length}`]),
    }),
    dependencies: goal.dependencies,
    constraints: goal.constraints,
    relationships: Object.freeze([]),
  });
}
