/**
 * Persistence adapters — bridge existing engine ports onto repositories.
 * Engine contracts are unchanged; only the implementation moves.
 */

import type { MemoryEnvelope } from "../memory/types";
import type { MemoryStore, StoreListFilter } from "../memory/store/types";
import { MemoryNotFoundError } from "../memory/errors";
import type { WorkflowStatePersistencePort } from "../workflow/ports";
import { COLLECTIONS } from "./collections";
import { spec } from "./repository/specification";
import type { Repository } from "./repository/types";

type Doc = Record<string, unknown>;

/** Memory Engine port → persistence repository. */
export class MemoryStoreAdapter implements MemoryStore {
  constructor(private readonly repo: Repository<Doc>) {}

  private toEnvelope(data: Doc): MemoryEnvelope {
    return data as unknown as MemoryEnvelope;
  }

  async put(env: MemoryEnvelope): Promise<MemoryEnvelope> {
    await this.repo.save(env.memoryId, env as unknown as Doc, env.ownerId);
    return { ...env };
  }

  async patch(memoryId: string, patch: Partial<MemoryEnvelope>): Promise<MemoryEnvelope> {
    const found = await this.repo.findById(memoryId);
    if (!found) throw new MemoryNotFoundError(memoryId);
    const existing = this.toEnvelope(found.data);
    const merged: MemoryEnvelope = {
      ...existing,
      ...patch,
      memoryId: existing.memoryId,
      ownerId: existing.ownerId,
      tenantId: existing.tenantId,
      class: existing.class,
      kind: existing.kind,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    await this.repo.save(memoryId, merged as unknown as Doc, existing.ownerId);
    return { ...merged };
  }

  async get(memoryId: string, ownerId: string): Promise<MemoryEnvelope | null> {
    const found = await this.repo.findById(memoryId);
    if (!found || found.ownerId !== ownerId) return null; // RLS-equivalent
    return { ...this.toEnvelope(found.data) };
  }

  async findByContentHash(
    ownerId: string,
    class_: MemoryEnvelope["class"],
    kind: string,
    hash: string,
  ): Promise<MemoryEnvelope | null> {
    const rows = await this.repo.find({
      ownerId,
      specification: spec.all(
        spec.eq("class", class_),
        spec.eq("kind", kind),
        spec.eq("contentHash", hash),
      ),
      limit: 1,
    });
    return rows[0] ? { ...this.toEnvelope(rows[0].data) } : null;
  }

  async list(filter: StoreListFilter): Promise<MemoryEnvelope[]> {
    const rows = await this.repo.find({ ownerId: filter.ownerId });
    const now = filter.now ?? Date.now();
    const out = rows
      .map((r) => this.toEnvelope(r.data))
      .filter((row) => {
        if (filter.classes?.length && !filter.classes.includes(row.class)) return false;
        if (filter.kinds?.length && !filter.kinds.includes(row.kind)) return false;
        if (filter.statuses?.length && !filter.statuses.includes(row.status)) return false;
        if (filter.threadId !== undefined && row.threadId !== filter.threadId) return false;
        if (filter.journeyId !== undefined && row.journeyId !== filter.journeyId) return false;
        if (filter.tags?.length && !filter.tags.every((t) => row.tags.includes(t))) return false;
        if (
          filter.goalIds?.length &&
          !(row.goalIds ?? []).some((g) => filter.goalIds!.includes(g))
        )
          return false;
        if (!filter.includeExpired && row.ttlExpiresAt && Date.parse(row.ttlExpiresAt) <= now)
          return false;
        return true;
      })
      .map((r) => ({ ...r }));
    return filter.limit ? out.slice(0, filter.limit) : out;
  }

  async hardDelete(memoryId: string, ownerId: string): Promise<void> {
    const found = await this.repo.findById(memoryId);
    if (!found || found.ownerId !== ownerId) return;
    await this.repo.hardDelete(memoryId);
  }

  async countByOwner(ownerId: string): Promise<number> {
    return this.repo.count({ ownerId });
  }

  async all(): Promise<MemoryEnvelope[]> {
    const rows = await this.repo.find({});
    return rows.map((r) => ({ ...this.toEnvelope(r.data) }));
  }
}

/** Workflow state persistence port → persistence repository. */
export class WorkflowStoreAdapter implements WorkflowStatePersistencePort {
  constructor(private readonly repo: Repository<Doc>) {}
  async save(key: string, value: unknown): Promise<void> {
    await this.repo.save(key, { key, value } as Doc);
  }
  async load(key: string): Promise<unknown> {
    return (await this.repo.findById(key))?.data.value;
  }
  async remove(key: string): Promise<void> {
    await this.repo.hardDelete(key);
  }
  async keys(): Promise<readonly string[]> {
    return (await this.repo.find({})).map((r) => r.id).sort();
  }
}

/**
 * Generic document adapter used by Graph, Identity, Journey, Travel and
 * Notification stores — all of which need owner-scoped document CRUD.
 */
export class DocumentStoreAdapter<T extends Doc> {
  constructor(
    readonly collection: string,
    private readonly repo: Repository<Doc>,
  ) {}
  async put(id: string, doc: T, ownerId: string | null = null): Promise<T> {
    await this.repo.save(id, doc, ownerId);
    return doc;
  }
  async get(id: string): Promise<T | null> {
    return ((await this.repo.findById(id))?.data as T) ?? null;
  }
  async listForOwner(ownerId: string): Promise<readonly T[]> {
    return (await this.repo.find({ ownerId })).map((r) => r.data as T);
  }
  async page(page: number, size: number, ownerId?: string) {
    const result = await this.repo.paginate({ page, size }, { ownerId });
    return { ...result, items: result.items.map((i) => i.data as T) };
  }
  async remove(id: string, actorId?: string): Promise<boolean> {
    return this.repo.softDelete(id, actorId ?? null);
  }
  async restore(id: string): Promise<boolean> {
    return this.repo.restore(id);
  }
  async count(ownerId?: string): Promise<number> {
    return this.repo.count({ ownerId });
  }
}

export const ADAPTER_COLLECTIONS = Object.freeze({
  memory: COLLECTIONS.memoryRecords,
  graphNodes: COLLECTIONS.graphNodes,
  graphEdges: COLLECTIONS.graphEdges,
  workflow: COLLECTIONS.workflowInstances,
  identity: COLLECTIONS.profiles,
  journey: COLLECTIONS.journeys,
  travel: COLLECTIONS.travelRecords,
  notifications: COLLECTIONS.notifications,
});

/* ------------------------------------------------------------------ */
/* Domain-specific document adapters                                   */
/* ------------------------------------------------------------------ */

/** Identity/profile documents (IPUP) → persistence repository. */
export class IdentityStoreAdapter<T extends Doc = Doc> extends DocumentStoreAdapter<T> {
  constructor(repo: Repository<Doc>, collection: string = COLLECTIONS.profiles) {
    super(collection, repo);
  }
}

/** Saved journeys / planning sessions → persistence repository. */
export class JourneyStoreAdapter<T extends Doc = Doc> extends DocumentStoreAdapter<T> {
  constructor(repo: Repository<Doc>, collection: string = COLLECTIONS.journeys) {
    super(collection, repo);
  }
}

/** Normalized multi-modal travel records → persistence repository. */
export class TravelStoreAdapter<T extends Doc = Doc> extends DocumentStoreAdapter<T> {
  constructor(repo: Repository<Doc>, collection: string = COLLECTIONS.travelRecords) {
    super(collection, repo);
  }
}
