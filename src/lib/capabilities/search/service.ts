/**
 * SEARCH SERVICE — semantic search architecture stub.
 * Deterministic in-memory corpus so upstream code can integrate today.
 * Real vector-store provider adapters attach via the Provider Matrix.
 */
import type { DecisionContext } from "@/lib/tios/types";
import { capabilityRequestId, emitCapabilityEvent } from "../events";
import type {
  SearchHit, SearchInput, SearchIntent, SearchOutput, SearchScope,
} from "./types";

interface Doc { id: string; scope: SearchScope; title: string; snippet: string; tags: string[]; }

const CORPUS: Doc[] = [
  { id: "d_kyoto", scope: "destinations", title: "Kyoto", snippet: "Historic temples, tea houses, and cherry blossoms.", tags: ["culture", "temples", "japan"] },
  { id: "d_lisbon", scope: "destinations", title: "Lisbon", snippet: "Coastal city with pastel neighborhoods and vibrant food.", tags: ["coastal", "food", "portugal"] },
  { id: "d_reykjavik", scope: "destinations", title: "Reykjavík", snippet: "Northern lights, geothermal spas, dramatic landscapes.", tags: ["nature", "iceland"] },
  { id: "e_kyoto_walk", scope: "experiences", title: "Gion walking tour", snippet: "Guided evening walk through Kyoto's historic Gion district.", tags: ["walking", "guided"] },
  { id: "h_lisbon_boutique", scope: "hotels", title: "Boutique hotel — Alfama", snippet: "Small design hotel in central Lisbon.", tags: ["boutique", "central"] },
  { id: "r_kyoto_kaiseki", scope: "restaurants", title: "Kaiseki dining", snippet: "Multi-course seasonal Japanese cuisine.", tags: ["fine-dining"] },
];

function intentOf(q: string): SearchIntent {
  if (/\b(book|reserve|buy)\b/i.test(q)) return "book";
  if (/\b(compare|vs|versus|best)\b/i.test(q)) return "compare";
  if (/\b(plan|itinerary|trip)\b/i.test(q)) return "plan";
  if (/\b(what|how|why|history|guide)\b/i.test(q)) return "learn";
  if (q.trim().length > 0) return "browse";
  return "unknown";
}

function score(doc: Doc, q: string): number {
  const query = q.toLowerCase();
  if (!query) return 0;
  const terms = query.split(/\s+/).filter(Boolean);
  let s = 0;
  for (const t of terms) {
    if (doc.title.toLowerCase().includes(t)) s += 0.5;
    if (doc.snippet.toLowerCase().includes(t)) s += 0.3;
    if (doc.tags.some((tag) => tag.includes(t))) s += 0.4;
  }
  return Math.min(1, s / terms.length);
}

export async function runSearch(input: SearchInput, ctx: DecisionContext): Promise<SearchOutput> {
  const t0 = Date.now();
  const requestId = capabilityRequestId("search");
  const intent = intentOf(input.query);
  const scoped = input.scope === "all" ? CORPUS : CORPUS.filter((d) => d.scope === input.scope);
  const scored = scoped
    .map((d) => ({ doc: d, s: score(d, input.query) }))
    .filter(({ s }) => s > 0)
    .sort((a, b) => b.s - a.s);

  const hits: SearchHit[] = scored
    .slice(input.page * input.pageSize, (input.page + 1) * input.pageSize)
    .map(({ doc, s }) => ({
      id: doc.id, scope: doc.scope, title: doc.title,
      snippet: doc.snippet, tags: doc.tags,
      score: Math.round(s * 100) / 100,
    }));

  const suggestions = scoped
    .flatMap((d) => d.tags)
    .filter((t, i, arr) => arr.indexOf(t) === i)
    .slice(0, 6);

  const output: SearchOutput = {
    meta: { requestId, capabilityId: "search-engine", latencyMs: Date.now() - t0, generatedAt: Date.now() },
    query: input.query,
    scope: input.scope,
    intent,
    hits,
    suggestions,
    totalHits: scored.length,
    page: input.page,
    pageSize: input.pageSize,
  };

  emitCapabilityEvent({
    name: "SearchCompleted",
    capability: "search-engine",
    requestId,
    timestamp: Date.now(),
    userId: ctx.userId,
    data: { query: input.query, scope: input.scope, hits: hits.length, intent },
  });

  return output;
}
