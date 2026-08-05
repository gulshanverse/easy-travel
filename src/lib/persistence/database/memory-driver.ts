/**
 * In-memory DatabaseDriver.
 *
 * Reference driver for tests and local development. Snapshot-based
 * transactions give the same commit/rollback semantics as Postgres for the
 * repository layer above it. NEVER selected by a production configuration.
 */

import { OptimisticLockError, RecordNotFoundError, TransactionError } from "../errors";
import {
  applyQuery,
  nowIso,
  type DatabaseDriver,
  type PersistedRow,
  type RowQuery,
  type WriteRow,
} from "./types";

export class InMemoryDatabaseDriver implements DatabaseDriver {
  readonly kind = "memory" as const;
  private rows = new Map<string, PersistedRow>();
  private readonly txStack = new Map<string, Map<string, PersistedRow>>();
  private txSeq = 0;

  private key(collection: string, id: string): string {
    return `${collection}::${id}`;
  }

  async insert(row: WriteRow): Promise<PersistedRow> {
    const at = nowIso();
    const created: PersistedRow = {
      id: row.id,
      collection: row.collection,
      ownerId: row.ownerId,
      version: 1,
      data: row.data,
      createdAt: at,
      updatedAt: at,
      deletedAt: null,
      createdBy: row.actorId ?? null,
      updatedBy: row.actorId ?? null,
    };
    this.rows.set(this.key(row.collection, row.id), created);
    return created;
  }

  async update(row: WriteRow, expectedVersion: number | null): Promise<PersistedRow> {
    const existing = this.rows.get(this.key(row.collection, row.id));
    if (!existing) throw new RecordNotFoundError(row.collection, row.id);
    if (expectedVersion !== null && existing.version !== expectedVersion)
      throw new OptimisticLockError(row.collection, row.id, expectedVersion, existing.version);
    const next: PersistedRow = {
      ...existing,
      ownerId: row.ownerId,
      data: row.data,
      version: existing.version + 1,
      updatedAt: nowIso(),
      updatedBy: row.actorId ?? existing.updatedBy,
    };
    this.rows.set(this.key(row.collection, row.id), next);
    return next;
  }

  async upsert(row: WriteRow): Promise<PersistedRow> {
    return this.rows.has(this.key(row.collection, row.id))
      ? this.update(row, null)
      : this.insert(row);
  }

  async findById(
    collection: string,
    id: string,
    includeDeleted = false,
  ): Promise<PersistedRow | null> {
    const row = this.rows.get(this.key(collection, id));
    if (!row) return null;
    if (!includeDeleted && row.deletedAt !== null) return null;
    return row;
  }

  async find(query: RowQuery): Promise<readonly PersistedRow[]> {
    return applyQuery([...this.rows.values()], query);
  }

  async count(query: RowQuery): Promise<number> {
    return applyQuery([...this.rows.values()], {
      ...query,
      limit: undefined,
      offset: undefined,
    }).length;
  }

  async softDelete(collection: string, id: string, actorId?: string | null): Promise<boolean> {
    const row = this.rows.get(this.key(collection, id));
    if (!row || row.deletedAt !== null) return false;
    this.rows.set(this.key(collection, id), {
      ...row,
      deletedAt: nowIso(),
      updatedAt: nowIso(),
      updatedBy: actorId ?? row.updatedBy,
      version: row.version + 1,
    });
    return true;
  }

  async restore(collection: string, id: string): Promise<boolean> {
    const row = this.rows.get(this.key(collection, id));
    if (!row || row.deletedAt === null) return false;
    this.rows.set(this.key(collection, id), {
      ...row,
      deletedAt: null,
      updatedAt: nowIso(),
      version: row.version + 1,
    });
    return true;
  }

  async hardDelete(collection: string, id: string): Promise<boolean> {
    return this.rows.delete(this.key(collection, id));
  }

  async ping(): Promise<boolean> {
    return true;
  }

  async begin(): Promise<string> {
    const tx = `tx-${++this.txSeq}`;
    this.txStack.set(tx, new Map(this.rows));
    return tx;
  }

  async commit(tx: string): Promise<void> {
    if (!this.txStack.delete(tx)) throw new TransactionError(`unknown transaction ${tx}`);
  }

  async rollback(tx: string): Promise<void> {
    const snapshot = this.txStack.get(tx);
    if (!snapshot) throw new TransactionError(`unknown transaction ${tx}`);
    this.rows = snapshot;
    this.txStack.delete(tx);
  }

  /** Test/admin helper. */
  size(): number {
    return this.rows.size;
  }
  clear(): void {
    this.rows.clear();
    this.txStack.clear();
  }
}
