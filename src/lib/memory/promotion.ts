/**
 * Memory Engine — Promotion Engine (EDS-001 v2.0 §3.8).
 *
 * Rules-based promotion from short-lived → long-lived classes. Promotion is
 * event-sourced: it writes a new memory in the target class and links back
 * via promotedFrom. The source is optionally archived.
 */
import type { MemoryConfiguration } from "./config";
import type { MemoryEnvelope, MemoryClass, MemoryDraft } from "./types";
import type { MemoryStore } from "./store/types";
import type { MemoryEventPublisher } from "./events";
import type { MemoryFactories } from "./factories";
import type { MemoryLifecycleManager } from "./lifecycle";

export interface PromotionRule {
  from: MemoryClass;
  to: MemoryClass;
  trigger: string; // "repeat_exposure" | "explicit_confirmation" | "evidence_accumulation" | "reflection"
  shouldPromote(env: MemoryEnvelope): boolean;
  transformKind?(kind: string): string;
}

export const DEFAULT_PROMOTION_RULES: PromotionRule[] = [
  {
    from: "short_term",
    to: "working",
    trigger: "repeat_exposure",
    shouldPromote: (e) => e.readCount >= 2,
  },
  {
    from: "working",
    to: "conversation",
    trigger: "repeat_exposure",
    shouldPromote: (e) => e.readCount >= 3,
  },
  {
    from: "conversation",
    to: "episodic",
    trigger: "reflection",
    shouldPromote: (e) => e.readCount >= 5 && e.importance >= 0.5,
  },
  {
    from: "preference",
    to: "semantic",
    trigger: "evidence_accumulation",
    shouldPromote: (e) => e.evidence.length >= 3 && e.confidence >= 0.75,
  },
  {
    from: "journey",
    to: "episodic",
    trigger: "explicit_confirmation",
    shouldPromote: (e) => e.status === "active" && e.confidence >= 0.7 && e.importance >= 0.6,
  },
  {
    from: "reflection",
    to: "semantic",
    trigger: "evidence_accumulation",
    shouldPromote: (e) => e.confidence >= 0.8,
  },
];

export class MemoryPromotionEngine {
  private rules: PromotionRule[];

  constructor(
    private config: MemoryConfiguration,
    private store: MemoryStore,
    private factories: MemoryFactories,
    private publisher: MemoryEventPublisher,
    private lifecycle: MemoryLifecycleManager,
    rules: PromotionRule[] = DEFAULT_PROMOTION_RULES,
  ) {
    this.rules = rules;
  }

  register(rule: PromotionRule): void {
    this.rules.push(rule);
  }

  /** Evaluate rules for a single memory. Returns the new memory id if promoted. */
  async maybePromote(env: MemoryEnvelope): Promise<MemoryEnvelope | null> {
    if (!this.config.flags.enablePromotion) return null;
    const policy = this.config.classPolicies[env.class];
    if (!policy.promotable) return null;
    if (env.importance < policy.minImportanceToPromote) return null;
    const rule = this.rules.find((r) => r.from === env.class && r.shouldPromote(env));
    if (!rule) return null;
    const draft: MemoryDraft = {
      class: rule.to,
      kind: rule.transformKind ? rule.transformKind(env.kind) : env.kind,
      ownerId: env.ownerId,
      tenantId: env.tenantId,
      scope: env.scope,
      visibility: env.visibility,
      payload: env.payload,
      payloadSchemaVersion: env.payloadSchemaVersion,
      source: { ...env.source, kind: "system_derived" },
      evidence: env.evidence,
      confidence: env.confidence,
      importance: env.importance,
      trustSourceId: env.trustSourceId,
      tags: env.tags,
      relationships: [
        ...env.relationships,
        { type: "promoted_from", targetId: env.memoryId, weight: 1 },
      ],
      relatedIds: env.relatedIds,
      threadId: env.threadId,
      journeyId: env.journeyId,
      goalIds: env.goalIds,
    };
    const promoted = await this.factories.fromDraft(draft);
    promoted.promotedFrom = env.memoryId;
    const stored = await this.store.put(promoted);
    this.publisher.publish(
      "MemoryPromoted",
      {
        sourceId: env.memoryId,
        targetId: stored.memoryId,
        fromClass: env.class,
        toClass: rule.to,
        trigger: rule.trigger,
      },
      { ownerId: env.ownerId, tenantId: env.tenantId },
    );
    // Source is archived after successful promotion.
    await this.lifecycle.archive(env.memoryId, env.ownerId, {
      actorId: "system",
      reason: "promoted",
    });
    return stored;
  }
}
