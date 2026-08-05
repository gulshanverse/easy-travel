/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * PostgreSQL DatabaseDriver (production).
 *
 * Talks to the managed Postgres instance through the project's Data API
 * client. The driver is injected structurally, so this module imports no
 * vendor SDK and no engine code.
 *
 * Transactions: the Data API is stateless, so `begin/commit/rollback` are
 * implemented as a compensating journal — every write inside a transaction
 * records its inverse, and `rollback` replays the inverses in reverse order.
 * Repository semantics above the driver are unchanged.
 */

import {
  DatabaseQueryError,
  OptimisticLockError,
  RecordNotFoundError,
  TransactionError,
} from "../errors";
import {
  matchesFilter,
  nowIso,
  type DatabaseDriver,
  type PersistedRow,
  type RowQuery,
  type WriteRow,
} from "./types";

export const RECORDS_TABLE = "persistence_records";

/** Structural shape of a PostgREST-style client (no SDK import). */
export interface SqlDataClient {
  from(table: string): any;
}

interface DbRow {
  id: string;
  collection: string;
  owner_id: string | null;
  version: number;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  created_by: string | null;
  updated_by: string | null;
}

function toRow(r: DbRow): PersistedRow {
  return {
    id: r.id,
    collection: r.collection,
    ownerId: r.owner_id,
    version: r.version,
    data: r.data ?? {},
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
    createdBy: r.created_by,
    updatedBy: r.updated_by,
  };
}

type Undo = () => Promise<void>;

export class PostgresDatabaseDriver implements DatabaseDriver {
  readonly kind = "postgres" as const;
  private readonly journals = new Map<string, Undo[]>();
  private txSeq = 0;
  private activeTx: string | null = null;

  constructor(
    private readonly client: SqlDataClient,
    private readonly table: string = RECORDS_TABLE,
  ) {}

  private t() {
    return this.client.from(this.table);
  }

  private record(undo: Undo): void {
    if (!this.activeTx) return;
    this.journals.get(this.activeTx)?.push(undo);
  }

  private fail(op: string, error: unknown): never {
    throw new DatabaseQueryError(`postgres ${op} failed`, {
      cause: (error as { message?: string })?.message ?? String(error),
    });
  }

  async insert(row: WriteRow): Promise<PersistedRow> {
    const at = nowIso();
    const { data, error } = await this.t()
      .insert({
        id: row.id,
        collection: row.collection,
        owner_id: row.ownerId,
        version: 1,
        data: row.data,
        created_at: at,
        updated_at: at,
        deleted_at: null,
        created_by: row.actorId ?? null,
        updated_by: row.actorId ?? null,
      })
      .select()
      .single();
    if (error) this.fail("insert", error);
    this.record(async () => {
      await this.t().delete().eq("collection", row.collection).eq("id", row.id);
    });
    return toRow(data as DbRow);
  }

  async update(row: WriteRow, expectedVersion: number | null): Promise<PersistedRow> {
    const current = await this.findById(row.collection, row.id, true);
    if (!current) throw new RecordNotFoundError(row.collection, row.id);
    if (expectedVersion !== null && current.version !== expectedVersion)
      throw new OptimisticLockError(row.collection, row.id, expectedVersion, current.version);

    let q = this.t()
      .update({
        owner_id: row.ownerId,
        data: row.data,
        version: current.version + 1,
        updated_at: nowIso(),
        updated_by: row.actorId ?? current.updatedBy,
      })
      .eq("collection", row.collection)
      .eq("id", row.id);
    // Concurrency guard: only update when the version is still what we read.
    q = q.eq("version", current.version);
    const { data, error } = await q.select().single();
    if (error) this.fail("update", error);
    if (!data)
      throw new OptimisticLockError(row.collection, row.id, current.version, -1);
    this.record(async () => {
      await this.t()
        .update({
          owner_id: current.ownerId,
          data: current.data,
          version: current.version,
          updated_at: current.updatedAt,
          updated_by: current.updatedBy,
        })
        .eq("collection", row.collection)
        .eq("id", row.id);
    });
    return toRow(data as DbRow);
  }

  async upsert(row: WriteRow): Promise<PersistedRow> {
    const existing = await this.findById(row.collection, row.id, true);
    return existing ? this.update(row, null) : this.insert(row);
  }

  async findById(
    collection: string,
    id: string,
    includeDeleted = false,
  ): Promise<PersistedRow | null> {
    let q = this.t().select("*").eq("collection", collection).eq("id", id);
    if (!includeDeleted) q = q.is("deleted_at", null);
    const { data, error } = await q.maybeSingle();
    if (error) this.fail("findById", error);
    return data ? toRow(data as DbRow) : null;
  }

  private async fetch(query: RowQuery): Promise<PersistedRow[]> {
    let q = this.t().select("*").eq("collection", query.collection);
    if (!query.includeDeleted) q = q.is("deleted_at", null);
    if (query.ownerId !== undefined) {
      q = query.ownerId === null ? q.is("owner_id", null) : q.eq("owner_id", query.ownerId);
    }
    if (query.ids) q = q.in("id", [...query.ids]);
    for (const s of query.sort ?? [{ field: "createdAt", direction: "asc" as const }]) {
      const column = COLUMN_BY_FIELD[s.field];
      if (column) q = q.order(column, { ascending: s.direction === "asc" });
    }
    const { data, error } = await q;
    if (error) this.fail("find", error);
    let rows = ((data ?? []) as DbRow[]).map(toRow);
    for (const f of query.filters ?? []) rows = rows.filter((r) => matchesFilter(r, f));
    return rows;
  }

  async find(query: RowQuery): Promise<readonly PersistedRow[]> {
    const rows = await this.fetch(query);
    const offset = query.offset ?? 0;
    const limit = query.limit ?? rows.length;
    return rows.slice(offset, offset + limit);
  }

  async count(query: RowQuery): Promise<number> {
    return (await this.fetch({ ...query, limit: undefined, offset: undefined })).length;
  }

  async softDelete(collection: string, id: string, actorId?: string | null): Promise<boolean> {
    const current = await this.findById(collection, id);
    if (!current) return false;
    const { error } = await this.t()
      .update({ deleted_at: nowIso(), updated_at: nowIso(), updated_by: actorId ?? null, version: current.version + 1 })
      .eq("collection", collection)
      .eq("id", id);
    if (error) this.fail("softDelete", error);
    this.record(async () => {
      await this.t()
        .update({ deleted_at: null, version: current.version })
        .eq("collection", collection)
        .eq("id", id);
    });
    return true;
  }

  async restore(collection: string, id: string): Promise<boolean> {
    const current = await this.findById(collection, id, true);
    if (!current || current.deletedAt === null) return false;
    const { error } = await this.t()
      .update({ deleted_at: null, updated_at: nowIso(), version: current.version + 1 })
      .eq("collection", collection)
      .eq("id", id);
    if (error) this.fail("restore", error);
    return true;
  }

  async hardDelete(collection: string, id: string): Promise<boolean> {
    const current = await this.findById(collection, id, true);
    if (!current) return false;
    const { error } = await this.t().delete().eq("collection", collection).eq("id", id);
    if (error) this.fail("hardDelete", error);
    this.record(async () => {
      await this.insert({
        id: current.id,
        collection: current.collection,
        ownerId: current.ownerId,
        data: current.data,
        actorId: current.createdBy,
      });
    });
    return true;
  }

  async ping(): Promise<boolean> {
    const { error } = await this.t().select("id").limit(1);
    return !error;
  }

  async begin(): Promise<string> {
    if (this.activeTx) throw new TransactionError("nested transactions are not supported");
    const tx = `pgtx-${++this.txSeq}`;
    this.journals.set(tx, []);
    this.activeTx = tx;
    return tx;
  }

  async commit(tx: string): Promise<void> {
    if (!this.journals.delete(tx)) throw new TransactionError(`unknown transaction ${tx}`);
    this.activeTx = null;
  }

  async rollback(tx: string): Promise<void> {
    const journal = this.journals.get(tx);
    if (!journal) throw new TransactionError(`unknown transaction ${tx}`);
    this.activeTx = null;
    for (const undo of [...journal].reverse()) await undo();
    this.journals.delete(tx);
  }
}

const COLUMN_BY_FIELD: Readonly<Record<string, string>> = Object.freeze({
  id: "id",
  ownerId: "owner_id",
  version: "version",
  createdAt: "created_at",
  updatedAt: "updated_at",
  deletedAt: "deleted_at",
});
