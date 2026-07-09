/**
 * Memory Engine — Compression Engine (EDS-001 v2.0 §3.9, §9.5).
 *
 * Given N related memories, produce a single summary memory that links back
 * to the originals via `derived_from`. The summariser is injected; ME does
 * not own LLM invocation — a no-op deterministic summariser is provided as
 * the default so this module is testable without an AI provider.
 */
import type { MemoryConfiguration } from "./config";
import type { MemoryEnvelope, MemoryDraft } from "./types";
import type { MemoryStore } from "./store/types";
import type { MemoryEventPublisher } from "./events";
import type { MemoryFactories } from "./factories";
import type { MemoryLifecycleManager } from "./lifecycle";

export interface CompressionSummariser {
  summarise(inputs: MemoryEnvelope[]): Promise<{
    kind: string;
    payload: unknown;
    importance: number;
    confidence: number;
    tags: string[];
  }>;
}

export class DeterministicSummariser implements CompressionSummariser {
  async summarise(inputs: MemoryEnvelope[]): Promise<{
    kind: string;
    payload: unknown;
    importance: number;
    confidence: number;
    tags: string[];
  }> {
    const payload = {
      summaryOf: inputs.map((i) => i.memoryId),
      count: inputs.length,
      text: inputs
        .map((i) => (typeof i.payload === "string" ? i.payload : JSON.stringify(i.payload)))
        .join(" | "),
    };
    const importance = clamp(avg(inputs.map((i) => i.importance)));
    const confidence = clamp(avg(inputs.map((i) => i.confidence)));
    const tags = Array.from(new Set(inputs.flatMap((i) => i.tags))).slice(0, 16);
    return { kind: "summary", payload, importance, confidence, tags };
  }
}

export class MemoryCompressionEngine {
  constructor(
    private config: MemoryConfiguration,
    private store: MemoryStore,
    private factories: MemoryFactories,
    private publisher: MemoryEventPublisher,
    private lifecycle: MemoryLifecycleManager,
    private summariser: CompressionSummariser = new DeterministicSummariser(),
  ) {}

  async compress(
    inputs: MemoryEnvelope[],
    opts: { targetClass?: MemoryEnvelope["class"] } = {},
  ): Promise<MemoryEnvelope | null> {
    if (!this.config.flags.enableCompression) return null;
    if (inputs.length < 2) return null;
    const owner = inputs[0].ownerId;
    if (!inputs.every((i) => i.ownerId === owner)) {
      throw new Error("cannot compress memories across owners");
    }
    const summary = await this.summariser.summarise(inputs);
    const targetClass = opts.targetClass ?? "reflection";
    const draft: MemoryDraft = {
      class: targetClass,
      kind: summary.kind,
      ownerId: owner,
      tenantId: inputs[0].tenantId,
      scope: inputs[0].scope,
      visibility: strictestVisibility(inputs),
      payload: summary.payload,
      source: { kind: "system_derived", actorId: "memory.compression" },
      evidence: inputs.flatMap((i) => i.evidence),
      importance: summary.importance,
      confidence: summary.confidence,
      tags: summary.tags,
      relationships: inputs.map((i) => ({
        type: "derived_from" as const,
        targetId: i.memoryId,
        weight: 1,
      })),
      relatedIds: inputs.map((i) => i.memoryId),
    };
    const created = await this.factories.fromDraft(draft);
    const stored = await this.store.put(created);
    this.publisher.publish(
      "MemoryCompressed",
      {
        sourceIds: inputs.map((i) => i.memoryId),
        summaryId: stored.memoryId,
        ratio: inputs.length,
      },
      { ownerId: owner, tenantId: stored.tenantId },
    );
    // Archive the originals (never hard delete on compression).
    for (const i of inputs) {
      await this.lifecycle.archive(i.memoryId, owner, { actorId: "system", reason: "compressed" });
    }
    return stored;
  }
}

function avg(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function clamp(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function strictestVisibility(inputs: MemoryEnvelope[]): MemoryEnvelope["visibility"] {
  const order: Record<MemoryEnvelope["visibility"], number> = {
    private: 0,
    shared: 1,
    team: 2,
    public: 3,
  };
  return inputs.reduce<MemoryEnvelope["visibility"]>(
    (acc, i) => (order[i.visibility] < order[acc] ? i.visibility : acc),
    "public",
  );
}
