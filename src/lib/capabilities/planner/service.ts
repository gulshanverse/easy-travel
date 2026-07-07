/**
 * PLANNER SERVICE — deterministic intent extraction + structured itinerary.
 *
 * This service does NOT call model providers directly. When AI enhancement
 * is enabled a downstream milestone will attach an AI Core agent handler
 * through the AI Enhancement stage. The service produces production-grade
 * structured output on its own so the pipeline is testable, cacheable,
 * and never returns free-form text.
 */
import type { DecisionContext } from "@/lib/tios/types";
import { capabilityRequestId, emitCapabilityEvent } from "../events";
import type {
  PlannerInput, PlannerIntent, PlannerOutput, TimelineDay,
} from "./types";
import type { CompanionKind, Money, Season, TravelStyle } from "../types";

// ---------- NLU helpers ----------
const MONTHS = ["january","february","march","april","may","june","july","august","september","october","november","december"];
const STYLE_HINTS: Array<[TravelStyle, RegExp]> = [
  ["luxury", /\b(luxury|five[- ]star|5[- ]star|premium|indulgent)\b/i],
  ["budget", /\b(budget|cheap|affordable|shoestring|frugal)\b/i],
  ["backpacker", /\b(backpack(?:ing|er)?|hostels?)\b/i],
  ["family", /\b(family|kids?|children|toddler)\b/i],
  ["romantic", /\b(honeymoon|romantic|anniversary|couples?)\b/i],
  ["adventure", /\b(adventur\w*|trek|hik\w*|rafting|climb\w*)\b/i],
  ["business", /\b(business|corporate|conference)\b/i],
  ["wellness", /\b(wellness|yoga|retreat|spa|detox)\b/i],
  ["comfort", /\b(comfort\w*|relax\w*|leisure)\b/i],
];
const COMPANION_HINTS: Array<[CompanionKind, RegExp]> = [
  ["solo", /\b(solo|alone|by myself)\b/i],
  ["couple", /\b(couple|partner|girlfriend|boyfriend|spouse|wife|husband)\b/i],
  ["family", /\b(family|kids?|children|parents)\b/i],
  ["friends", /\b(friends?|mates|buddies)\b/i],
  ["group", /\b(group of|\d{2,}\s+people)\b/i],
  ["colleagues", /\b(colleagues|coworkers|team offsite)\b/i],
];

function extractDestination(prompt: string): string | null {
  const m =
    prompt.match(/\b(?:to|in|visit(?:ing)?|going to|trip to|holiday in)\s+([A-Z][A-Za-z\u00C0-\u017F' -]{2,}(?:,\s*[A-Z][A-Za-z ]{2,})?)/) ??
    prompt.match(/\b([A-Z][a-z\u00C0-\u017F]{2,})\b/);
  return m ? m[1].trim().replace(/[.,;!?]$/, "") : null;
}

function extractDuration(prompt: string): number | null {
  const m = prompt.match(/(\d{1,3})\s*(?:-|\s)?(?:day|days|d)\b/i);
  if (m) return Math.max(1, parseInt(m[1], 10));
  const w = prompt.match(/(\d{1,3})\s*week(?:s)?\b/i);
  if (w) return Math.max(1, parseInt(w[1], 10) * 7);
  return null;
}

function extractBudget(prompt: string, currency: string): Money | null {
  const m = prompt.match(/(?:budget\s*(?:of|:)?\s*)?[$€£]?\s?(\d{2,7})(?:\s*(usd|eur|gbp|inr))?/i);
  if (!m) return null;
  const amt = parseInt(m[1], 10);
  const cur = (m[2] ?? currency ?? "USD").toUpperCase();
  return { amountCents: amt * 100, currency: cur };
}

function extractSeason(prompt: string, now: number): Season {
  for (const m of MONTHS) {
    if (new RegExp(`\\b${m}\\b`, "i").test(prompt)) {
      const idx = MONTHS.indexOf(m);
      if (idx >= 2 && idx <= 4) return "spring";
      if (idx >= 5 && idx <= 7) return "summer";
      if (idx >= 8 && idx <= 10) return "autumn";
      return "winter";
    }
  }
  const month = new Date(now).getMonth();
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 10) return "autumn";
  return "winter";
}

function first<T>(hints: Array<[T, RegExp]>, prompt: string): T | null {
  for (const [v, re] of hints) if (re.test(prompt)) return v;
  return null;
}

function extractList(prompt: string, patterns: RegExp[]): string[] {
  const out = new Set<string>();
  for (const p of patterns) for (const m of prompt.matchAll(p)) out.add(m[1].toLowerCase());
  return Array.from(out);
}

// ---------- Intent extraction ----------
export function extractIntent(input: PlannerInput, ctx: DecisionContext): PlannerIntent {
  const prompt = input.prompt ?? "";
  const currency = input.currency ?? ctx.currency ?? "USD";
  const destination = input.overrides?.destination ?? extractDestination(prompt);
  const durationDays = extractDuration(prompt);
  const budget = input.overrides?.budgetCents
    ? { amountCents: input.overrides.budgetCents, currency } as Money
    : extractBudget(prompt, currency);
  const travelStyle = input.overrides?.travelStyle ?? first(STYLE_HINTS, prompt);
  const companions = input.overrides?.companions ?? first(COMPANION_HINTS, prompt);
  const transportation = extractList(prompt, [/\b(flight|train|bus|car|cab|ferry|walking)\b/gi]);
  const accommodation = extractList(prompt, [/\b(hotel|hostel|airbnb|resort|villa|cabin|boutique)\b/gi]);
  const activities = extractList(prompt, [/\b(museum|beach|hiking|shopping|food|nightlife|history|wildlife|photography|snorkel\w*|diving|yoga|spa|temple|art)\b/gi]);
  const season = extractSeason(prompt, ctx.now);
  const constraints = extractList(prompt, [
    /\b(no|avoid|without)\s+([a-z]{3,})/gi,
    /\b(vegetarian|vegan|halal|kosher|wheelchair|accessible|pet[- ]friendly)\b/gi,
  ]);

  const missing: string[] = [];
  if (!destination) missing.push("destination");
  if (!durationDays) missing.push("durationDays");
  if (!budget) missing.push("budget");
  if (!travelStyle) missing.push("travelStyle");
  if (!companions) missing.push("companions");

  return {
    destination,
    origin: null,
    durationDays,
    startDate: input.overrides?.startDate ?? null,
    endDate: input.overrides?.endDate ?? null,
    budget,
    travelStyle,
    companions,
    transportation,
    accommodation,
    activities,
    season,
    constraints,
    missingFields: missing,
  };
}

// ---------- Timeline builder ----------
const DEFAULT_ACTIVITIES: Array<{ title: string; category: string; duration: number }> = [
  { title: "Arrival & check-in", category: "logistics", duration: 90 },
  { title: "Neighborhood orientation walk", category: "exploration", duration: 60 },
  { title: "Local lunch", category: "food", duration: 75 },
  { title: "Signature landmark visit", category: "sightseeing", duration: 120 },
  { title: "Downtime & rest", category: "wellness", duration: 60 },
  { title: "Dinner at a local favorite", category: "food", duration: 90 },
];

function buildTimeline(intent: PlannerIntent, currency: string, durationDays: number): TimelineDay[] {
  const days: TimelineDay[] = [];
  const perDayEstimate = 8000; // 80 units per day
  for (let i = 1; i <= durationDays; i++) {
    days.push({
      dayNumber: i,
      date: null,
      title:
        i === 1 ? `Arrival in ${intent.destination ?? "your destination"}`
        : i === durationDays ? "Departure day"
        : `Day ${i} — explore`,
      activities: DEFAULT_ACTIVITIES.map((a, idx) => ({
        id: `d${i}_a${idx}`,
        title: a.title,
        description: `${a.title} on day ${i}`,
        durationMinutes: a.duration,
        category: a.category,
        estimatedCost: {
          amountCents: Math.round(perDayEstimate / DEFAULT_ACTIVITIES.length),
          currency,
        },
        editable: true as const,
      })),
      notes: [],
    });
  }
  return days;
}

// ---------- Public service API ----------
export async function runPlanner(input: PlannerInput, ctx: DecisionContext): Promise<PlannerOutput> {
  const t0 = Date.now();
  const requestId = capabilityRequestId("planner");
  const intent = extractIntent(input, ctx);
  const currency = input.currency ?? ctx.currency ?? "USD";
  const durationDays = intent.durationDays ?? 5;

  const timeline = buildTimeline(intent, currency, durationDays);
  const perDay = 12000; // 120 units/day baseline
  const total: Money = { amountCents: perDay * durationDays, currency };

  const output: PlannerOutput = {
    meta: {
      requestId,
      capabilityId: "planner",
      latencyMs: Date.now() - t0,
      generatedAt: Date.now(),
    },
    intent,
    journey: {
      id: input.journeyId ?? `journey_${requestId}`,
      title: intent.destination
        ? `${durationDays}-day trip to ${intent.destination}`
        : `${durationDays}-day trip`,
      summary: `Structured plan for ${intent.destination ?? "your destination"} spanning ${durationDays} day(s).`,
      destination: intent.destination,
      startDate: intent.startDate,
      endDate: intent.endDate,
      durationDays,
      travelStyle: intent.travelStyle,
      companions: intent.companions,
    },
    timeline,
    budgetEstimate: {
      total,
      perDay: { amountCents: perDay, currency },
      breakdown: [
        { category: "accommodation", amount: { amountCents: Math.round(total.amountCents * 0.4), currency } },
        { category: "food", amount: { amountCents: Math.round(total.amountCents * 0.25), currency } },
        { category: "transport", amount: { amountCents: Math.round(total.amountCents * 0.15), currency } },
        { category: "activities", amount: { amountCents: Math.round(total.amountCents * 0.15), currency } },
        { category: "misc", amount: { amountCents: Math.round(total.amountCents * 0.05), currency } },
      ],
    },
    recommendations: [
      { subject: "hotel", title: `Boutique stay in ${intent.destination ?? "the area"}`, reason: "Matches travel style", confidence: 0.72 },
      { subject: "experience", title: "Top-rated local walking tour", reason: "Popular with similar travelers", confidence: 0.68 },
    ],
    risks: [
      ...(intent.season === "summer" ? [{ id: "r_weather_heat", kind: "weather" as const, severity: "medium" as const, message: "Peak-summer heat expected — plan hydration and shaded activities." }] : []),
      ...(!intent.budget ? [{ id: "r_budget_unknown", kind: "budget" as const, severity: "low" as const, message: "No explicit budget provided — estimate is heuristic." }] : []),
    ],
    packingSuggestions: [
      "Passport & travel documents",
      "Comfortable walking shoes",
      intent.season === "winter" ? "Warm layers & waterproof jacket" : "Sun protection & refillable water bottle",
      "Universal power adapter",
    ],
    questions: intent.missingFields.map((f) => `Could you clarify: ${f}?`),
    alternatives: [
      { id: "alt_slower", title: "Slower-paced variant", summary: "Fewer activities per day with more rest windows." },
      { id: "alt_offbeat", title: "Off-the-beaten-path variant", summary: "Prioritizes lesser-known neighborhoods and hidden gems." },
    ],
    editable: true,
  };

  emitCapabilityEvent({
    name: "PlannerGenerated",
    capability: "planner",
    requestId,
    timestamp: Date.now(),
    userId: ctx.userId,
    data: { destination: intent.destination, durationDays, missing: intent.missingFields.length },
  });

  return output;
}
