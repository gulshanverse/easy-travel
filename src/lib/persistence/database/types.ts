/**
 * Persistence Platform — database contracts.
 *
 * Every engine talks to persistence through repositories; repositories talk
 * to a `DatabaseDriver`. No engine owns SQL and no driver owns domain logic.
 */

import type { DatabaseDriverKind } from "../config";

/** Canonical persisted row. Domain payloads live in `data` as JSON. */
export interface PersistedRow {
  readonly id: string;
  readonly collection: string;
  readonly ownerId: string | null;
  readonly version: number;
  readonly data: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
}

export type FilterOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "contains"
  | "exists";

export interface RowFilter {
  /** Dot path inside `data`, or a top-level column name (`ownerId`, `id`...). */
  readonly field: string;
  readonly op: FilterOperator;
  readonly value?: unknown;
}

export type SortDirection = "asc" | "desc";

export interface RowSort {
  readonly field: string;
  readonly direction: SortDirection;
}

export interface RowQuery {
  readonly collection: string;
  readonly ownerId?: string | null;
  readonly ids?: readonly string[];
  readonly filters?: readonly RowFilter[];
  readonly sort?: readonly RowSort[];
  readonly limit?: number;
  readonly offset?: number;
  readonly includeDeleted?: boolean;
}

export interface WriteRow {
  readonly id: string;
  readonly collection: string;
  readonly ownerId: string | null;
  readonly data: Readonly<Record<string, unknown>>;
  readonly actorId?: string | null;
}

export interface DatabaseDriver {
  readonly kind: DatabaseDriverKind;
  insert(row: WriteRow): Promise<PersistedRow>;
  update(row: WriteRow, expectedVersion: number | null): Promise<PersistedRow>;
  upsert(row: WriteRow): Promise<PersistedRow>;
  findById(collection: string, id: string, includeDeleted?: boolean): Promise<PersistedRow | null>;
  find(query: RowQuery): Promise<readonly PersistedRow[]>;
  count(query: RowQuery): Promise<number>;
  softDelete(collection: string, id: string, actorId?: string | null): Promise<boolean>;
  restore(collection: string, id: string): Promise<boolean>;
  hardDelete(collection: string, id: string): Promise<boolean>;
  ping(): Promise<boolean>;
  /** Transaction hooks — drivers without native transactions buffer writes. */
  begin(): Promise<string>;
  commit(tx: string): Promise<void>;
  rollback(tx: string): Promise<void>;
}

export function nowIso(at?: number): string {
  return new Date(at ?? Date.now()).toISOString();
}

/** Reads a dot path out of a row (top-level column first, then `data`). */
export function readField(row: PersistedRow, field: string): unknown {
  switch (field) {
    case "id":
      return row.id;
    case "ownerId":
      return row.ownerId;
    case "version":
      return row.version;
    case "createdAt":
      return row.createdAt;
    case "updatedAt":
      return row.updatedAt;
    case "deletedAt":
      return row.deletedAt;
    default:
      break;
  }
  let cur: unknown = row.data;
  for (const part of field.split(".")) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

export function matchesFilter(row: PersistedRow, f: RowFilter): boolean {
  const actual = readField(row, f.field);
  switch (f.op) {
    case "eq":
      return actual === f.value;
    case "neq":
      return actual !== f.value;
    case "gt":
      return compare(actual, f.value) > 0;
    case "gte":
      return compare(actual, f.value) >= 0;
    case "lt":
      return compare(actual, f.value) < 0;
    case "lte":
      return compare(actual, f.value) <= 0;
    case "in":
      return Array.isArray(f.value) && (f.value as unknown[]).includes(actual);
    case "contains":
      return Array.isArray(actual) && actual.includes(f.value);
    case "exists":
      return (actual !== undefined && actual !== null) === (f.value !== false);
    default:
      return false;
  }
}

function compare(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  const as = String(a ?? "");
  const bs = String(b ?? "");
  return as < bs ? -1 : as > bs ? 1 : 0;
}

/** Deterministic in-process query evaluation shared by drivers. */
export function applyQuery(rows: readonly PersistedRow[], q: RowQuery): PersistedRow[] {
  let out = rows.filter((r) => r.collection === q.collection);
  if (!q.includeDeleted) out = out.filter((r) => r.deletedAt === null);
  if (q.ownerId !== undefined) out = out.filter((r) => r.ownerId === q.ownerId);
  if (q.ids) out = out.filter((r) => q.ids!.includes(r.id));
  for (const f of q.filters ?? []) out = out.filter((r) => matchesFilter(r, f));
  const sort = q.sort ?? [{ field: "createdAt", direction: "asc" as const }];
  out = [...out].sort((a, b) => {
    for (const s of sort) {
      const c = compare(readField(a, s.field), readField(b, s.field));
      if (c !== 0) return s.direction === "asc" ? c : -c;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  const offset = q.offset ?? 0;
  const limit = q.limit ?? out.length;
  return out.slice(offset, offset + limit);
}
