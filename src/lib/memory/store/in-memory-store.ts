/**
 * Memory Engine — In-memory MemoryStore.
 *
 * Reference implementation used for unit + integration tests and for
 * environments without a Postgres/pgvector backend wired up. Preserves
 * per-owner isolation and RLS-equivalent access semantics.
 */
import type { MemoryEnvelope } from "../types";
import { MemoryNotFoundError } from "../errors";
import type { MemoryStore, StoreListFilter } from "./types";

export class InMemoryMemoryStore implements MemoryStore {
  private rows = new Map<string, MemoryEnvelope>();

  async put(env: MemoryEnvelope): Promise<MemoryEnvelope> {
    this.rows.set(env.memoryId, { ...env });
    return { ...env };
  }

  async patch(memoryId: string, patch: Partial<MemoryEnvelope>): Promise<MemoryEnvelope> {
    const existing = this.rows.get(memoryId);
    if (!existing) throw new MemoryNotFoundError(memoryId);
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
    this.rows.set(memoryId, merged);
    return { ...merged };
  }

  async get(memoryId: string, ownerId: string): Promise<MemoryEnvelope | null> {
    const row = this.rows.get(memoryId);
    if (!row) return null;
    if (row.ownerId !== ownerId) return null; // RLS-equivalent
    return { ...row };
  }

  async findByContentHash(ownerId: string, class_: MemoryEnvelope["class"], kind: string, hash: string): Promise<MemoryEnvelope | null> {
    for (const row of this.rows.values()) {
      if (row.ownerId === ownerId && row.class === class_ && row.kind === kind && row.contentHash === hash) {
        return { ...row };
      }
    }
    return null;
  }

  async list(filter: StoreListFilter): Promise<MemoryEnvelope[]> {
    const now = filter.now ?? Date.now();
    const out: MemoryEnvelope[] = [];
    for (const row of this.rows.values()) {
      if (row.ownerId !== filter.ownerId) continue;
      if (filter.classes?.length && !filter.classes.includes(row.class)) continue;
      if (filter.kinds?.length && !filter.kinds.includes(row.kind)) continue;
      if (filter.statuses?.length && !filter.statuses.includes(row.status)) continue;
      if (filter.threadId !== undefined && row.threadId !== filter.threadId) continue;
      if (filter.journeyId !== undefined && row.journeyId !== filter.journeyId) continue;
      if (filter.tags?.length && !filter.tags.every((t) => row.tags.includes(t))) continue;
      if (filter.goalIds?.length && !(row.goalIds ?? []).some((g) => filter.goalIds!.includes(g))) continue;
      if (!filter.includeExpired && row.ttlExpiresAt && Date.parse(row.ttlExpiresAt) <= now) continue;
      out.push({ ...row });
    }
    if (filter.limit) return out.slice(0, filter.limit);
    return out;
  }

  async hardDelete(memoryId: string, ownerId: string): Promise<void> {
    const row = this.rows.get(memoryId);
    if (!row) return;
    if (row.ownerId !== ownerId) return;
    this.rows.delete(memoryId);
  }

  async countByOwner(ownerId: string): Promise<number> {
    let n = 0;
    for (const row of this.rows.values()) if (row.ownerId === ownerId) n += 1;
    return n;
  }

  async all(): Promise<MemoryEnvelope[]> {
    return Array.from(this.rows.values()).map((r) => ({ ...r }));
  }
}
