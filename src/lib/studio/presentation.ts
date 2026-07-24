/** JSR — Presentation engine.
 * Transforms Agent Runtime output into Studio models (cards, timeline items).
 * Pure transformation. No rendering, no LLMs.
 */
import { StudioPresentationError } from "./errors";
import { makeCard } from "./cards";
import { WorkspaceEngine, emptyWorkspaceState } from "./workspace";
import { TimelineEngine } from "./timeline";
import type { StudioAgentResponse } from "./ports";
import type { Card, CardKind, Workspace } from "./types";

const KIND_MAP: Record<string, CardKind> = {
  destination: "destination", place: "destination", region: "destination",
  journey: "journey", trip: "journey", itinerary: "journey",
  decision: "decision", choice: "decision",
  trust: "trust", evidence: "trust", confidence: "trust",
  goal: "goal", milestone: "goal", objective: "goal",
  budget: "budget", cost: "budget", price: "budget",
  timeline: "timeline", schedule: "timeline",
  warning: "warning", risk: "warning", alert: "warning",
  recommendation: "recommendation", suggestion: "recommendation",
  insight: "insight", observation: "insight", finding: "insight",
};

export interface PresentationCandidate {
  readonly kind: CardKind;
  readonly title: string;
  readonly subtitle?: string;
  readonly body?: string;
  readonly data?: Readonly<Record<string, unknown>>;
  readonly tags?: readonly string[];
  readonly timeline?: { startAt?: number; endAt?: number; label?: string };
}

export interface PresentationExtractorInput {
  readonly response: StudioAgentResponse;
}

/** Deterministic extractor over well-known keys in `response.outputs`. */
export function extractCandidates(input: PresentationExtractorInput): readonly PresentationCandidate[] {
  const { response } = input;
  const out: PresentationCandidate[] = [];
  const outputs = response.outputs ?? {};
  for (const [key, value] of Object.entries(outputs)) {
    if (!value || typeof value !== "object") continue;
    const rec = value as Record<string, unknown>;
    const kindHint = String(rec.kind ?? rec.type ?? key).toLowerCase();
    const kind: CardKind = KIND_MAP[kindHint] ?? "insight";
    const title = String(rec.title ?? rec.name ?? key);
    out.push(Object.freeze({
      kind, title,
      subtitle: typeof rec.subtitle === "string" ? rec.subtitle : undefined,
      body: typeof rec.summary === "string" ? rec.summary
           : typeof rec.body === "string" ? rec.body : undefined,
      data: Object.freeze({ source: key, raw: rec }),
      tags: Array.isArray(rec.tags) ? rec.tags.filter((t): t is string => typeof t === "string") : [],
      timeline: rec.timeline && typeof rec.timeline === "object"
        ? {
            startAt: typeof (rec.timeline as Record<string, unknown>).startAt === "number"
              ? (rec.timeline as Record<string, number>).startAt : undefined,
            endAt: typeof (rec.timeline as Record<string, unknown>).endAt === "number"
              ? (rec.timeline as Record<string, number>).endAt : undefined,
            label: typeof (rec.timeline as Record<string, unknown>).label === "string"
              ? (rec.timeline as Record<string, string>).label : undefined,
          }
        : undefined,
    }));
  }
  for (const e of response.evidence ?? []) {
    out.push(Object.freeze({
      kind: "trust", title: `Evidence: ${e.kind}`,
      subtitle: e.id,
      data: Object.freeze({ evidenceId: e.id, kind: e.kind, payload: e.payload ?? {} }),
      tags: ["evidence", e.kind],
    }));
  }
  return Object.freeze(out);
}

export interface ApplyPresentationInput {
  readonly response: StudioAgentResponse;
  readonly baseWorkspace?: Workspace;
  readonly addToTimeline?: boolean;
}

export interface ApplyPresentationResult {
  readonly workspace: Workspace;
  readonly cards: readonly Card[];
}

export class PresentationEngine {
  apply(input: ApplyPresentationInput): ApplyPresentationResult {
    try {
      const candidates = extractCandidates({ response: input.response });
      let state = input.baseWorkspace
        ? { workspace: input.baseWorkspace, history: { entries: [] as never[] } }
        : emptyWorkspaceState();
      const cards: Card[] = [];
      for (const c of candidates) {
        const card = makeCard({
          kind: c.kind, title: c.title, subtitle: c.subtitle, body: c.body,
          data: c.data, tags: c.tags, sourceAgentResponseId: input.response.id,
        });
        cards.push(card);
        state = WorkspaceEngine.insertCard(state, card);
        if (input.addToTimeline) {
          const { timeline } = TimelineEngine.insert(state.workspace.timeline, {
            cardId: card.id,
            label: c.timeline?.label ?? card.title,
            startAt: c.timeline?.startAt,
            endAt: c.timeline?.endAt,
          });
          state = WorkspaceEngine.applyTimeline(state, timeline, "presentation.timeline");
        }
      }
      return { workspace: state.workspace, cards: Object.freeze(cards) };
    } catch (err) {
      throw new StudioPresentationError((err as Error).message);
    }
  }
}
