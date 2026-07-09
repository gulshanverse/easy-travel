/**
 * PromptContextAssembler — collects and assembles the AssembledContext bundle.
 *
 * Memory access is delegated to a MemoryPort — the runtime never imports the
 * MemoryManager class directly. Any adapter that satisfies MemoryPort works,
 * which keeps the dependency inversion required by EBP-001.
 */
import type {
  AssembledContext,
  MemoryContext,
  MemoryContextItem,
  PromptRequest,
} from "./types";

export interface ContextCollectionInput {
  request: PromptRequest;
  base?: Partial<AssembledContext>;
}

/**
 * Adapter contract for the Memory Engine. Any object matching this shape may
 * be injected; the concrete MemoryManager from src/lib/memory exposes a
 * superset of this contract.
 */
export interface MemoryPort {
  retrieve(query: MemoryPortQuery): Promise<MemoryPortResult>;
}

export interface MemoryPortQuery {
  ownerId: string;
  purpose?: string;
  text?: string;
  limit?: number;
  classes?: string[];
  correlationId?: string;
}

export interface MemoryPortResult {
  items: {
    memoryId: string;
    class: string;
    content: string;
    confidence: number;
    createdAt: number;
  }[];
  truncated?: boolean;
}

/**
 * Ordered context sources. Ordering matters for downstream assembly; matches
 * EDS-002 §Context Assembly ordering.
 */
export type ContextSource =
  | "identity"
  | "trust"
  | "goal"
  | "relationship"
  | "preference"
  | "timeline"
  | "budget"
  | "capability"
  | "tool"
  | "knowledge"
  | "journey"
  | "conversation"
  | "memory";

export const DEFAULT_CONTEXT_ORDER: ContextSource[] = [
  "identity",
  "trust",
  "goal",
  "relationship",
  "preference",
  "timeline",
  "budget",
  "capability",
  "tool",
  "knowledge",
  "journey",
  "conversation",
  "memory",
];

export interface ContextAssemblerOptions {
  memory?: MemoryPort;
  ownerId?: string;
  memoryLimit?: number;
  order?: ContextSource[];
}

export class PromptContextAssembler {
  constructor(private readonly opts: ContextAssemblerOptions = {}) {}

  async assemble(input: ContextCollectionInput): Promise<AssembledContext> {
    const { request, base = {} } = input;
    const overrides = request.contextOverrides ?? {};
    const merged: AssembledContext = { ...base, ...overrides };

    // Memory retrieval via the port — only if a port and an owner exist and
    // the caller did not already supply memory context.
    if (!merged.memory && this.opts.memory && (this.opts.ownerId || merged.identity?.userId)) {
      const ownerId = this.opts.ownerId ?? merged.identity!.userId!;
      const result = await this.opts.memory.retrieve({
        ownerId,
        purpose: "prompt_context",
        text: request.userInput,
        limit: this.opts.memoryLimit ?? 12,
        correlationId: request.correlationId,
      });
      merged.memory = toMemoryContext(result);
    }

    // Ensure timeline.now is populated.
    if (!merged.timeline) merged.timeline = { now: Date.now() };
    if (!merged.timeline.now) merged.timeline.now = Date.now();

    return this.applyOrdering(merged);
  }

  /**
   * Return a shallow-cloned context whose keys follow the configured order.
   * Ordering is stable and used by the assembler to emit deterministic
   * fragment sequences.
   */
  applyOrdering(ctx: AssembledContext): AssembledContext {
    const order = this.opts.order ?? DEFAULT_CONTEXT_ORDER;
    const ordered: AssembledContext = {};
    for (const key of order) {
      const v = (ctx as Record<string, unknown>)[key];
      if (v !== undefined) (ordered as Record<string, unknown>)[key] = v;
    }
    if (ctx.extras) ordered.extras = ctx.extras;
    return ordered;
  }
}

function toMemoryContext(r: MemoryPortResult): MemoryContext {
  const items: MemoryContextItem[] = r.items.map((it) => ({
    memoryId: it.memoryId,
    class: it.class,
    content: it.content,
    confidence: it.confidence,
    createdAt: it.createdAt,
  }));
  return { items, truncated: r.truncated };
}
