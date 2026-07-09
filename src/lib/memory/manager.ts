/**
 * Memory Engine — MemoryManager (facade).
 *
 * The single public entry point. Composes the store, validators, factories,
 * confidence engine, ranker, retriever, lifecycle, promotion, compression,
 * archiver, events, telemetry, metrics, and health into one cohesive API.
 *
 * MemoryManager is intentionally provider-agnostic: swap MemoryStore to
 * change persistence; swap SemanticSearcher to plug an embedding backend;
 * swap CompressionSummariser to plug an LLM. Nothing else changes.
 */
import type { MemoryConfiguration } from "./config";
import { loadMemoryConfiguration } from "./config";
import type { MemoryDraft, MemoryEnvelope, RetrievalQuery, RetrievalResult } from "./types";
import { MemoryFactories } from "./factories";
import { MemoryValidators } from "./validators";
import { MemoryConfidenceEngine } from "./confidence";
import { MemoryRegistry } from "./registry";
import { MemoryRetriever, type SemanticSearcher } from "./retriever";
import { MemoryLifecycleManager, type LifecycleActor } from "./lifecycle";
import { MemoryPromotionEngine, type PromotionRule } from "./promotion";
import { MemoryCompressionEngine, type CompressionSummariser } from "./compression";
import { MemoryArchiver } from "./archiver";
import { MemoryEventPublisher, defaultMemoryEventPublisher } from "./events";
import { MemoryTelemetry, defaultTelemetry } from "./telemetry";
import { MemoryMetrics, defaultMemoryMetrics } from "./metrics";
import { MemoryHealthChecks } from "./health";
import { InMemoryMemoryStore } from "./store/in-memory-store";
import type { MemoryStore } from "./store/types";
import { MemoryConflictError, MemoryError, MemoryNotFoundError } from "./errors";

export interface MemoryManagerOptions {
  config?: Partial<MemoryConfiguration>;
  store?: MemoryStore;
  publisher?: MemoryEventPublisher;
  telemetry?: MemoryTelemetry;
  metrics?: MemoryMetrics;
  searcher?: SemanticSearcher;
  summariser?: CompressionSummariser;
  promotionRules?: PromotionRule[];
}

export class MemoryManager {
  readonly config: MemoryConfiguration;
  readonly store: MemoryStore;
  readonly publisher: MemoryEventPublisher;
  readonly telemetry: MemoryTelemetry;
  readonly metrics: MemoryMetrics;
  readonly registry: MemoryRegistry;
  readonly factories: MemoryFactories;
  readonly confidence: MemoryConfidenceEngine;
  readonly retriever: MemoryRetriever;
  readonly lifecycle: MemoryLifecycleManager;
  readonly promotion: MemoryPromotionEngine;
  readonly compression: MemoryCompressionEngine;
  readonly archiver: MemoryArchiver;
  readonly health: MemoryHealthChecks;

  constructor(opts: MemoryManagerOptions = {}) {
    this.config = loadMemoryConfiguration(opts.config);
    this.store = opts.store ?? new InMemoryMemoryStore();
    this.publisher = opts.publisher ?? defaultMemoryEventPublisher;
    this.telemetry = opts.telemetry ?? defaultTelemetry;
    this.metrics = opts.metrics ?? defaultMemoryMetrics;
    this.registry = new MemoryRegistry(this.config);
    this.factories = new MemoryFactories(this.config);
    this.confidence = new MemoryConfidenceEngine();
    this.retriever = new MemoryRetriever(this.config, this.store, opts.searcher);
    this.lifecycle = new MemoryLifecycleManager(this.config, this.store, this.publisher);
    this.promotion = new MemoryPromotionEngine(
      this.config,
      this.store,
      this.factories,
      this.publisher,
      this.lifecycle,
      opts.promotionRules,
    );
    this.compression = new MemoryCompressionEngine(
      this.config,
      this.store,
      this.factories,
      this.publisher,
      this.lifecycle,
      opts.summariser,
    );
    this.archiver = new MemoryArchiver(this.config, this.store, this.lifecycle);
    this.health = new MemoryHealthChecks(this.store, this.metrics);
  }

  // ─── Writes ───────────────────────────────────────────────────────────────
  async write<T>(draft: MemoryDraft<T>): Promise<MemoryEnvelope<T>> {
    const started = Date.now();
    try {
      MemoryValidators.validateDraft(draft);
      const env = await this.factories.fromDraft(draft);
      // Idempotency: dedup on (owner, class, kind, contentHash).
      const existing = await this.store.findByContentHash(
        env.ownerId,
        env.class,
        env.kind,
        env.contentHash,
      );
      if (existing) {
        this.telemetry.debug("write.dedup", { memoryId: existing.memoryId });
        return existing as MemoryEnvelope<T>;
      }
      MemoryValidators.validateEnvelope(env);
      const stored = await this.store.put(env);
      this.publisher.publish(
        "MemoryCreated",
        {
          memoryId: stored.memoryId,
          class: stored.class,
          kind: stored.kind,
          ownerId: stored.ownerId,
          tenantId: stored.tenantId,
          scope: stored.scope,
          visibility: stored.visibility,
          confidence: stored.confidence,
          sourceKind: stored.source.kind,
          evidenceCount: stored.evidence.length,
          contentHash: stored.contentHash,
        },
        { ownerId: stored.ownerId, tenantId: stored.tenantId },
      );
      this.metrics.incWrite(stored.class, Date.now() - started);
      return stored as MemoryEnvelope<T>;
    } catch (err) {
      this.metrics.incError(err instanceof MemoryError ? err.code : "internal_error");
      this.telemetry.error("write.failed", { error: String(err) });
      throw err;
    }
  }

  async update(
    memoryId: string,
    ownerId: string,
    patch: Partial<
      Pick<MemoryEnvelope, "tags" | "importance" | "trustSourceId" | "relatedIds" | "relationships">
    >,
  ): Promise<MemoryEnvelope> {
    const env = await this.store.get(memoryId, ownerId);
    if (!env) throw new MemoryNotFoundError(memoryId);
    if (env.status === "hard_deleted" || env.status === "superseded") {
      throw new MemoryConflictError(`memory in terminal state: ${env.status}`);
    }
    const changed = Object.keys(patch);
    const updated = await this.store.patch(memoryId, { ...patch, version: env.version + 1 });
    this.publisher.publish(
      "MemoryUpdated",
      {
        memoryId,
        changedFields: changed,
        priorVersion: env.version,
        newVersion: env.version + 1,
      },
      { ownerId, tenantId: env.tenantId },
    );
    return updated;
  }

  async supersede<T>(oldId: string, draft: MemoryDraft<T>): Promise<MemoryEnvelope<T>> {
    const created = await this.write(draft);
    await this.lifecycle.supersede(oldId, created.memoryId, draft.ownerId);
    return created;
  }

  // ─── Reads ────────────────────────────────────────────────────────────────
  async get<T = unknown>(memoryId: string, ownerId: string): Promise<MemoryEnvelope<T> | null> {
    const env = await this.store.get(memoryId, ownerId);
    if (!env) return null;
    this.metrics.incRead();
    const reinforced = this.confidence.reinforce(env);
    await this.store.patch(memoryId, {
      decayState: reinforced.decayState,
      lastReadAt: reinforced.lastReadAt,
      readCount: reinforced.readCount,
    });
    return reinforced as MemoryEnvelope<T>;
  }

  async retrieve(query: RetrievalQuery): Promise<RetrievalResult> {
    const result = await this.retriever.retrieve(query);
    this.metrics.incRetrieval(query.purpose, result.trace.latencyMs, result.trace.degraded);
    const qh = result.trace.queryHash;
    this.publisher.publish(
      "MemoryRetrieved",
      {
        queryHash: qh,
        ownerId: query.ownerId,
        purpose: query.purpose,
        itemCount: result.items.length,
        degraded: result.trace.degraded,
        traceHash: qh,
      },
      { ownerId: query.ownerId },
    );
    return result;
  }

  // ─── Lifecycle passthroughs ───────────────────────────────────────────────
  archive(memoryId: string, ownerId: string, actor: LifecycleActor) {
    return this.lifecycle.archive(memoryId, ownerId, actor);
  }
  softDelete(memoryId: string, ownerId: string, actor: LifecycleActor) {
    return this.lifecycle.softDelete(memoryId, ownerId, actor);
  }
  restore(memoryId: string, ownerId: string) {
    return this.lifecycle.restore(memoryId, ownerId);
  }
  forget(memoryId: string, ownerId: string, actor: LifecycleActor) {
    return this.lifecycle.hardDelete(memoryId, ownerId, actor);
  }

  // ─── Promotion / Compression / Sweep ──────────────────────────────────────
  promote(env: MemoryEnvelope) {
    return this.promotion.maybePromote(env);
  }
  compress(inputs: MemoryEnvelope[]) {
    return this.compression.compress(inputs);
  }
  sweep(ownerId: string, now?: number) {
    return this.archiver.sweep(ownerId, now);
  }
}

/** Convenience singleton for callers that want the default configuration. */
let _default: MemoryManager | null = null;
export function getDefaultMemoryManager(): MemoryManager {
  if (!_default) _default = new MemoryManager();
  return _default;
}
export function resetDefaultMemoryManager(): void {
  _default = null;
}
