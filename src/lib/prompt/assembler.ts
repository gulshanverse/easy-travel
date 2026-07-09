/**
 * PromptAssembler — turns a registry entry + assembled context into a
 * deterministic PromptIR.
 */
import { estimateTokens, stableHash, stableHashJson } from "./ids";
import type {
  AssembledContext,
  ConversationContext,
  MemoryContext,
  PromptFragment,
  PromptIR,
  PromptRegistryEntry,
  PromptRequest,
} from "./types";

export interface AssemblyResult {
  ir: PromptIR;
  contextFragmentIds: string[];
}

const FRAG_ORDER = {
  mission: 10,
  safety: 20,
  capability: 30,
  identity: 40,
  trust: 45,
  goal: 50,
  preference: 55,
  relationship: 60,
  timeline: 65,
  budget: 70,
  tool: 80,
  knowledge: 85,
  journey: 90,
  memory: 100,
  conversation: 110,
  output: 900,
  user_input: 999,
  custom: 500,
} as const satisfies Record<PromptFragment["kind"], number>;

const FRAG_PRIORITY = {
  mission: 200,
  safety: 200,
  capability: 150,
  identity: 140,
  goal: 130,
  preference: 100,
  relationship: 90,
  trust: 120,
  timeline: 80,
  budget: 80,
  tool: 110,
  knowledge: 70,
  journey: 120,
  memory: 60,
  conversation: 50,
  output: 200,
  user_input: 200,
  custom: 40,
} as const satisfies Record<PromptFragment["kind"], number>;

export class PromptAssembler {
  assemble(
    entry: PromptRegistryEntry,
    context: AssembledContext,
    request: PromptRequest,
  ): AssemblyResult {
    const fragments: PromptFragment[] = [];
    const contextFragmentIds: string[] = [];

    // 1. Registry fragments (mission/safety/capability/etc — authored).
    for (const f of entry.fragments) {
      fragments.push(normalise(f));
    }

    // 2. Context-derived fragments.
    const pushCtx = (frag: PromptFragment | null) => {
      if (!frag) return;
      fragments.push(normalise(frag));
      contextFragmentIds.push(frag.id);
    };

    pushCtx(this.identityFragment(context));
    pushCtx(this.trustFragment(context));
    pushCtx(this.goalFragment(context));
    pushCtx(this.relationshipFragment(context));
    pushCtx(this.preferenceFragment(context));
    pushCtx(this.timelineFragment(context));
    pushCtx(this.budgetFragment(context));
    pushCtx(this.capabilityFragment(context));
    pushCtx(this.toolFragment(context));
    pushCtx(this.knowledgeFragment(context));
    pushCtx(this.journeyFragment(context));
    pushCtx(this.memoryFragment(context.memory));
    pushCtx(this.conversationFragment(context.conversation));

    // 3. Output schema hint.
    const outputSchema = request.outputSchema ?? entry.outputSchema;
    if (outputSchema) {
      pushCtx({
        id: "sys:output",
        kind: "output",
        role: "system",
        order: FRAG_ORDER.output,
        priority: FRAG_PRIORITY.output,
        content: `Respond ONLY as JSON matching schema "${outputSchema.name}". Do not wrap in prose.`,
      });
    }

    // 4. User input.
    if (request.userInput?.trim()) {
      pushCtx({
        id: "user:input",
        kind: "user_input",
        role: "user",
        order: FRAG_ORDER.user_input,
        priority: FRAG_PRIORITY.user_input,
        content: request.userInput.trim(),
      });
    }

    const deduped = dedupe(fragments);
    const ordered = deduped.sort(sortFragments);

    const ir: PromptIR = {
      promptId: entry.promptId,
      version: entry.version,
      fragments: ordered,
      outputSchema,
      metadata: {
        correlationId: request.correlationId ?? "",
        causationId: request.causationId,
        traceId: request.traceId,
        createdAt: Date.now(),
        templateFingerprint: stableHashJson(entry.fragments.map((f) => f.id)),
      },
    };
    return { ir, contextFragmentIds };
  }

  private identityFragment(ctx: AssembledContext): PromptFragment | null {
    if (!ctx.identity) return null;
    const parts: string[] = [];
    if (ctx.identity.displayName) parts.push(`Name: ${ctx.identity.displayName}`);
    if (ctx.identity.locale) parts.push(`Locale: ${ctx.identity.locale}`);
    if (ctx.identity.timezone) parts.push(`Timezone: ${ctx.identity.timezone}`);
    if (!parts.length) return null;
    return frag("ctx:identity", "identity", "system", parts.join(" · "));
  }

  private trustFragment(ctx: AssembledContext): PromptFragment | null {
    if (!ctx.trust) return null;
    return frag(
      "ctx:trust",
      "trust",
      "system",
      `Trust score: ${ctx.trust.score.toFixed(2)}${
        ctx.trust.signals?.length ? ` (signals: ${ctx.trust.signals.join(", ")})` : ""
      }`,
    );
  }

  private goalFragment(ctx: AssembledContext): PromptFragment | null {
    if (!ctx.goal) return null;
    const lines: string[] = [];
    if (ctx.goal.primary) lines.push(`Primary goal: ${ctx.goal.primary}`);
    if (ctx.goal.secondary?.length) lines.push(`Secondary: ${ctx.goal.secondary.join("; ")}`);
    return lines.length ? frag("ctx:goal", "goal", "system", lines.join("\n")) : null;
  }

  private relationshipFragment(ctx: AssembledContext): PromptFragment | null {
    if (!ctx.relationship) return null;
    const parts: string[] = [];
    if (ctx.relationship.travellingWith?.length) {
      parts.push(`Travelling with: ${ctx.relationship.travellingWith.join(", ")}`);
    }
    if (ctx.relationship.relationships) {
      for (const [k, v] of Object.entries(ctx.relationship.relationships)) {
        parts.push(`${k}: ${v}`);
      }
    }
    return parts.length ? frag("ctx:relationship", "relationship", "system", parts.join("\n")) : null;
  }

  private preferenceFragment(ctx: AssembledContext): PromptFragment | null {
    if (!ctx.preference || !Object.keys(ctx.preference.values).length) return null;
    const body = Object.entries(ctx.preference.values)
      .map(([k, v]) => `- ${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
      .join("\n");
    return frag("ctx:preference", "preference", "system", `Preferences:\n${body}`);
  }

  private timelineFragment(ctx: AssembledContext): PromptFragment | null {
    if (!ctx.timeline) return null;
    const lines: string[] = [`Now: ${new Date(ctx.timeline.now).toISOString()}`];
    if (ctx.timeline.daysToDeparture != null) {
      lines.push(`Days to departure: ${ctx.timeline.daysToDeparture}`);
    }
    if (ctx.timeline.keyDates?.length) {
      for (const d of ctx.timeline.keyDates) lines.push(`- ${d.label}: ${d.date}`);
    }
    return frag("ctx:timeline", "timeline", "system", lines.join("\n"));
  }

  private budgetFragment(ctx: AssembledContext): PromptFragment | null {
    if (!ctx.budget) return null;
    const parts: string[] = [];
    if (ctx.budget.total != null) parts.push(`Total: ${ctx.budget.total} ${ctx.budget.currency ?? ""}`);
    if (ctx.budget.perDay != null) parts.push(`Per day: ${ctx.budget.perDay}`);
    if (ctx.budget.flexibility) parts.push(`Flexibility: ${ctx.budget.flexibility}`);
    return parts.length ? frag("ctx:budget", "budget", "system", `Budget — ${parts.join(" · ")}`) : null;
  }

  private capabilityFragment(ctx: AssembledContext): PromptFragment | null {
    if (!ctx.capability?.capabilities.length) return null;
    return frag(
      "ctx:capability",
      "capability",
      "system",
      `Capabilities: ${ctx.capability.capabilities.join(", ")}`,
    );
  }

  private toolFragment(ctx: AssembledContext): PromptFragment | null {
    if (!ctx.tool?.tools.length) return null;
    const body = ctx.tool.tools
      .map((t) => `- ${t.name}: ${t.description}`)
      .join("\n");
    return frag("ctx:tool", "tool", "system", `Available tools:\n${body}`);
  }

  private knowledgeFragment(ctx: AssembledContext): PromptFragment | null {
    if (!ctx.knowledge || (!ctx.knowledge.nodes.length && !ctx.knowledge.edges.length)) return null;
    const nodes = ctx.knowledge.nodes.slice(0, 20).map((n) => `${n.id}(${n.kind}):${n.label}`).join(", ");
    const edges = ctx.knowledge.edges.slice(0, 20).map((e) => `${e.from} -[${e.kind}]-> ${e.to}`).join("; ");
    return frag(
      "ctx:knowledge",
      "knowledge",
      "system",
      `Knowledge graph — nodes: ${nodes || "(none)"}; edges: ${edges || "(none)"}`,
    );
  }

  private journeyFragment(ctx: AssembledContext): PromptFragment | null {
    if (!ctx.journey) return null;
    const parts: string[] = [];
    if (ctx.journey.destination) parts.push(`Destination: ${ctx.journey.destination}`);
    if (ctx.journey.phase) parts.push(`Phase: ${ctx.journey.phase}`);
    if (ctx.journey.window?.start || ctx.journey.window?.end) {
      parts.push(`Window: ${ctx.journey.window?.start ?? "?"} → ${ctx.journey.window?.end ?? "?"}`);
    }
    if (ctx.journey.travellers) parts.push(`Travellers: ${ctx.journey.travellers}`);
    if (ctx.journey.notes) parts.push(ctx.journey.notes);
    return parts.length ? frag("ctx:journey", "journey", "system", parts.join(" · ")) : null;
  }

  private memoryFragment(mem?: MemoryContext): PromptFragment | null {
    if (!mem || !mem.items.length) return null;
    const body = mem.items
      .map((m) => `- [${m.class} · conf=${m.confidence.toFixed(2)}] ${m.content}`)
      .join("\n");
    return frag(
      "ctx:memory",
      "memory",
      "system",
      `Relevant memories${mem.truncated ? " (truncated)" : ""}:\n${body}`,
    );
  }

  private conversationFragment(conv?: ConversationContext): PromptFragment | null {
    if (!conv || (!conv.turns.length && !conv.summary)) return null;
    const parts: string[] = [];
    if (conv.summary) parts.push(`Summary: ${conv.summary}`);
    for (const t of conv.turns.slice(-10)) parts.push(`${t.role}: ${t.content}`);
    return frag("ctx:conversation", "conversation", "system", parts.join("\n"));
  }
}

function frag(id: string, kind: PromptFragment["kind"], role: PromptFragment["role"], content: string): PromptFragment {
  return {
    id,
    kind,
    role,
    order: FRAG_ORDER[kind],
    priority: FRAG_PRIORITY[kind],
    content,
    estimatedTokens: estimateTokens(content),
    dedupeKey: `${kind}:${stableHash(content)}`,
  };
}

function normalise(f: PromptFragment): PromptFragment {
  return {
    ...f,
    order: Number.isFinite(f.order) ? f.order : FRAG_ORDER[f.kind] ?? 500,
    priority: Number.isFinite(f.priority) ? f.priority : FRAG_PRIORITY[f.kind] ?? 50,
    estimatedTokens: f.estimatedTokens ?? estimateTokens(f.content),
    dedupeKey: f.dedupeKey ?? `${f.kind}:${stableHash(f.content)}`,
  };
}

function dedupe(fragments: PromptFragment[]): PromptFragment[] {
  const seen = new Set<string>();
  const out: PromptFragment[] = [];
  for (const f of fragments) {
    const key = f.dedupeKey ?? f.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

function sortFragments(a: PromptFragment, b: PromptFragment): number {
  if (a.order !== b.order) return a.order - b.order;
  return a.id.localeCompare(b.id);
}
