/**
 * Memory Engine — MemoryStore abstraction.
 *
 * All persistence goes through this interface. Implementations MUST enforce
 * per-owner isolation and MUST NOT return other owners' memories under any
 * code path.
 */
import type { MemoryClass, MemoryEnvelope, MemoryStatus } from "../types";

export interface StoreListFilter {
  ownerId: string;
  classes?: MemoryClass[];
  kinds?: string[];
  tags?: string[];
  threadId?: string | null;
  journeyId?: string | null;
  goalIds?: string[];
  statuses?: MemoryStatus[];
  includeExpired?: boolean;
  now?: number;
  limit?: number;
}

export interface MemoryStore {
  put(env: MemoryEnvelope): Promise<MemoryEnvelope>;
  patch(memoryId: string, patch: Partial<MemoryEnvelope>): Promise<MemoryEnvelope>;
  get(memoryId: string, ownerId: string): Promise<MemoryEnvelope | null>;
  findByContentHash(
    ownerId: string,
    class_: MemoryClass,
    kind: string,
    hash: string,
  ): Promise<MemoryEnvelope | null>;
  list(filter: StoreListFilter): Promise<MemoryEnvelope[]>;
  hardDelete(memoryId: string, ownerId: string): Promise<void>;
  countByOwner(ownerId: string): Promise<number>;
  all(): Promise<MemoryEnvelope[]>; // admin/test only
}
