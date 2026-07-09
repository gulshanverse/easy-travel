/**
 * Memory Engine — Envelope factories.
 *
 * Convert a MemoryDraft into a fully-populated MemoryEnvelope with server-
 * assigned fields (id, timestamps, decay defaults, content hash).
 */
import type { MemoryConfiguration } from "./config";
import type { MemoryDraft, MemoryEnvelope } from "./types";
import { newId } from "./ids";
import { contentHash } from "./hash";

export class MemoryFactories {
  constructor(private config: MemoryConfiguration) {}

  async fromDraft<T>(draft: MemoryDraft<T>, now = Date.now()): Promise<MemoryEnvelope<T>> {
    const policy = this.config.classPolicies[draft.class];
    const nowIso = new Date(now).toISOString();
    const ttl = draft.ttlExpiresAt !== undefined
      ? draft.ttlExpiresAt
      : policy.ttlSeconds == null
        ? null
        : new Date(now + policy.ttlSeconds * 1000).toISOString();
    return {
      memoryId: newId(),
      class: draft.class,
      kind: draft.kind,
      ownerId: draft.ownerId,
      tenantId: draft.tenantId ?? null,
      scope: draft.scope,
      visibility: draft.visibility ?? "private",
      payload: draft.payload,
      payloadSchemaVersion: draft.payloadSchemaVersion ?? 1,
      source: draft.source,
      evidence: draft.evidence ?? [],
      confidence: clamp(draft.confidence ?? 0.5),
      importance: clamp(draft.importance ?? 0.5),
      trustSourceId: draft.trustSourceId ?? null,
      tags: draft.tags ?? [],
      relationships: draft.relationships ?? [],
      relatedIds: draft.relatedIds ?? [],
      ttlExpiresAt: ttl,
      decayState: {
        halfLifeSeconds: policy.decayHalfLifeSeconds,
        lastReinforcedAt: nowIso,
        readCount: 0,
      },
      status: "active",
      version: 1,
      contentHash: await contentHash(draft.payload, draft.class, draft.kind),
      createdAt: nowIso,
      updatedAt: nowIso,
      lastReadAt: null,
      readCount: 0,
      promotedFrom: null,
      supersededBy: null,
      redaction: null,
      threadId: draft.threadId ?? null,
      journeyId: draft.journeyId ?? null,
      goalIds: draft.goalIds ?? [],
    };
  }
}

function clamp(n: number): number { return Math.min(1, Math.max(0, n)); }
