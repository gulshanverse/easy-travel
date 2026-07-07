/**
 * RECOMMENDATION SERVICE — Context → Knowledge → Rules → Ranking → AI → Explain.
 * AI enhancement stage is a no-op stub until Providers/AI-Core integration lands.
 */
import type { DecisionContext } from "@/lib/tios/types";
import { capabilityRequestId, emitCapabilityEvent } from "../events";
import type {
  RecommendationInput, RecommendationItem, RecommendationOutput, RecommendationSubject,
} from "./types";

interface Candidate {
  id: string;
  title: string;
  subtitle?: string;
  baseScore: number;
  tags: string[];
  reasons: string[];
  payload: Record<string, unknown>;
}

const SEED: Record<RecommendationSubject, (destination: string) => Candidate[]> = {
  hotels: (d) => [
    { id: "h1", title: `Boutique hotel in central ${d}`, baseScore: 0.82, tags: ["boutique", "central"], reasons: ["Central location", "Strong guest reviews"], payload: { stars: 4 } },
    { id: "h2", title: `Design hostel — ${d}`, baseScore: 0.7, tags: ["hostel", "budget"], reasons: ["Affordable", "Social atmosphere"], payload: { stars: 3 } },
    { id: "h3", title: `Riverside resort near ${d}`, baseScore: 0.65, tags: ["resort", "quiet"], reasons: ["Quiet setting", "Full amenities"], payload: { stars: 5 } },
  ],
  flights: (d) => [
    { id: "f1", title: `Direct flight to ${d}`, baseScore: 0.85, tags: ["direct"], reasons: ["Nonstop", "Convenient timing"], payload: { stops: 0 } },
    { id: "f2", title: `1-stop flight to ${d}`, baseScore: 0.7, tags: ["1-stop"], reasons: ["Lower fare"], payload: { stops: 1 } },
  ],
  restaurants: (d) => [
    { id: "r1", title: `Signature bistro in ${d}`, baseScore: 0.78, tags: ["local", "bistro"], reasons: ["Local favorite"], payload: {} },
    { id: "r2", title: `Street-food alley — ${d}`, baseScore: 0.72, tags: ["street", "budget"], reasons: ["Authentic", "Affordable"], payload: {} },
  ],
  experiences: (d) => [
    { id: "e1", title: `Guided walking tour of ${d}`, baseScore: 0.8, tags: ["walking", "guided"], reasons: ["High-rated guide"], payload: {} },
    { id: "e2", title: `Cooking class in ${d}`, baseScore: 0.74, tags: ["food", "hands-on"], reasons: ["Small group", "Cultural depth"], payload: {} },
  ],
  transport: (d) => [
    { id: "t1", title: `Day pass in ${d}`, baseScore: 0.7, tags: ["transit"], reasons: ["Cost-effective"], payload: {} },
  ],
  destinations: () => [
    { id: "d1", title: "Kyoto, Japan", baseScore: 0.88, tags: ["culture", "temples"], reasons: ["Rich cultural heritage"], payload: {} },
    { id: "d2", title: "Lisbon, Portugal", baseScore: 0.82, tags: ["coastal", "food"], reasons: ["Mild weather", "Excellent food"], payload: {} },
  ],
  "local-tips": (d) => [
    { id: "lt1", title: `Avoid tourist traps near ${d} main square`, baseScore: 0.65, tags: ["insider"], reasons: ["Local wisdom"], payload: {} },
  ],
  "hidden-gems": (d) => [
    { id: "hg1", title: `Rooftop viewpoint above ${d}`, baseScore: 0.76, tags: ["view", "hidden"], reasons: ["Uncrowded", "Great photos"], payload: {} },
  ],
};

// ---------- Pipeline stages ----------
function stageContext(input: RecommendationInput, ctx: DecisionContext) {
  return {
    destination: input.destination ?? "your destination",
    locale: ctx.locale ?? "en",
    filters: input.filters ?? {},
  };
}

function stageKnowledge(subject: RecommendationSubject, destination: string): Candidate[] {
  return SEED[subject](destination);
}

function stageRules(candidates: Candidate[], filters: Record<string, unknown>): Candidate[] {
  return candidates.map((c) => {
    let score = c.baseScore;
    const antiReasons: string[] = [];
    for (const [k, v] of Object.entries(filters)) {
      if (k === "maxPrice" && typeof v === "number" && (c.payload.price as number | undefined ?? 0) > v) {
        score -= 0.2;
        antiReasons.push(`Exceeds max price ${v}`);
      }
      if (k === "requireTag" && typeof v === "string" && !c.tags.includes(v)) {
        score -= 0.15;
        antiReasons.push(`Missing tag "${v}"`);
      }
    }
    return { ...c, baseScore: Math.max(0, Math.min(1, score)), reasons: [...c.reasons], payload: { ...c.payload, __anti: antiReasons } };
  });
}

function stageRanking(candidates: Candidate[]): Candidate[] {
  return [...candidates].sort((a, b) => b.baseScore - a.baseScore);
}

async function stageAI(candidates: Candidate[], enable: boolean): Promise<{ items: Candidate[]; aiEnhanced: boolean }> {
  if (!enable) return { items: candidates, aiEnhanced: false };
  // Placeholder AI enhancement — nudges top-3 by +0.05.
  return {
    items: candidates.map((c, i) => (i < 3 ? { ...c, baseScore: Math.min(1, c.baseScore + 0.05), reasons: [...c.reasons, "AI-enhanced ranking"] } : c)),
    aiEnhanced: true,
  };
}

function stageExplain(candidates: Candidate[]): RecommendationItem[] {
  return candidates.map((c) => ({
    id: c.id,
    title: c.title,
    subtitle: c.subtitle,
    score: Math.round(c.baseScore * 100) / 100,
    confidence: Math.round((0.5 + c.baseScore / 2) * 100) / 100,
    reasons: c.reasons,
    antiReasons: (c.payload.__anti as string[] | undefined) ?? [],
    tags: c.tags,
    payload: (() => {
      const { __anti: _a, ...rest } = c.payload as Record<string, unknown>;
      return rest;
    })(),
  }));
}

// ---------- Public API ----------
export async function runRecommendation(
  input: RecommendationInput, ctx: DecisionContext,
): Promise<RecommendationOutput> {
  const t0 = Date.now();
  const requestId = capabilityRequestId("recommendation");

  const context = stageContext(input, ctx);
  const knowledge = stageKnowledge(input.subject, context.destination);
  const ruled = stageRules(knowledge, context.filters);
  const ranked = stageRanking(ruled);
  const { items: enhanced, aiEnhanced } = await stageAI(ranked, input.enhanceWithAI);
  const items = stageExplain(enhanced).slice(0, input.limit);

  const output: RecommendationOutput = {
    meta: { requestId, capabilityId: "recommendation-engine", latencyMs: Date.now() - t0, generatedAt: Date.now() },
    subject: input.subject,
    items,
    explanation: {
      summary: `Ranked ${items.length} ${input.subject} for ${context.destination}.`,
      stages: ["context", "knowledge", "rules", "ranking", ...(aiEnhanced ? (["ai"] as const) : []), "explainability"],
      aiEnhanced,
    },
  };

  emitCapabilityEvent({
    name: "RecommendationCreated",
    capability: "recommendation-engine",
    requestId,
    timestamp: Date.now(),
    userId: ctx.userId,
    data: { subject: input.subject, count: items.length, aiEnhanced },
  });

  return output;
}
