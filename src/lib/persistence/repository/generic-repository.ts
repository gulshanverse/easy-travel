/**
 * GenericRepository — the single implementation every domain repository
 * builds on. Engines depend on the `Repository<T>` interface only.
 */

import { RecordNotFoundError } from "../errors";
import type { DatabaseManager } from "../database/pool";
import type { PersistedRow, RowQuery } from "../database/types";
import type {
  Entity,
  FindOptions,
  Page,
  PageRequest,
  Repository,
  SaveOptions,
} from "./types";

function toEntity<T>(row: PersistedRow): Entity<T> {
  return Object.freeze({
    id: row.id,
    ownerId: row.ownerId,
    version: row.version,
    data: row.data as T,
    audit: Object.freeze({
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
      createdBy: row.createdBy,
      updatedBy: row.updatedBy,
    }),
  });
}

export class GenericRepository<T extends Record<string, unknown>> implements Repository<T> {
  constructor(
    readonly collection: string,
    private readonly db: DatabaseManager,
  ) {}

  private query(options: FindOptions = {}): RowQuery {
    return {
      collection: this.collection,
      ownerId: options.ownerId,
      filters: options.specification?.filters,
      includeDeleted: options.includeDeleted,
      sort: options.sort,
      limit: options.limit,
      offset: options.offset,
    };
  }

  async insert(id: string, data: T, ownerId: string | null = null, options: SaveOptions = {}) {
    const row = await this.db.execute("insert", (d) =>
      d.insert({ id, collection: this.collection, ownerId, data, actorId: options.actorId }),
    );
    return toEntity<T>(row);
  }

  async update(id: string, data: T, ownerId: string | null = null, options: SaveOptions = {}) {
    const row = await this.db.execute("update", (d) =>
      d.update(
        { id, collection: this.collection, ownerId, data, actorId: options.actorId },
        options.expectedVersion ?? null,
      ),
    );
    return toEntity<T>(row);
  }

  async save(id: string, data: T, ownerId: string | null = null, options: SaveOptions = {}) {
    if (options.expectedVersion != null) return this.update(id, data, ownerId, options);
    const row = await this.db.execute("upsert", (d) =>
      d.upsert({ id, collection: this.collection, ownerId, data, actorId: options.actorId }),
    );
    return toEntity<T>(row);
  }

  async findById(id: string, includeDeleted = false): Promise<Entity<T> | null> {
    const row = await this.db.execute("findById", (d) =>
      d.findById(this.collection, id, includeDeleted),
    );
    return row ? toEntity<T>(row) : null;
  }

  async requireById(id: string): Promise<Entity<T>> {
    const found = await this.findById(id);
    if (!found) throw new RecordNotFoundError(this.collection, id);
    return found;
  }

  async find(options: FindOptions = {}): Promise<readonly Entity<T>[]> {
    const rows = await this.db.execute("find", (d) => d.find(this.query(options)));
    return rows.map((r) => toEntity<T>(r));
  }

  async count(options: FindOptions = {}): Promise<number> {
    return this.db.execute("count", (d) => d.count(this.query(options)));
  }

  async exists(id: string): Promise<boolean> {
    return (await this.findById(id)) !== null;
  }

  async paginate(
    request: PageRequest = {},
    options: FindOptions = {},
  ): Promise<Page<Entity<T>>> {
    const page = Math.max(1, request.page ?? 1);
    const size = Math.min(500, Math.max(1, request.size ?? 25));
    const total = await this.count(options);
    const items = await this.find({
      ...options,
      sort: request.sort ?? options.sort,
      limit: size,
      offset: (page - 1) * size,
    });
    const totalPages = Math.max(1, Math.ceil(total / size));
    return Object.freeze({
      items,
      page,
      size,
      total,
      totalPages,
      hasNext: page < totalPages,
    });
  }

  async softDelete(id: string, actorId: string | null = null): Promise<boolean> {
    return this.db.execute("softDelete", (d) => d.softDelete(this.collection, id, actorId));
  }

  async restore(id: string): Promise<boolean> {
    return this.db.execute("restore", (d) => d.restore(this.collection, id));
  }

  async hardDelete(id: string): Promise<boolean> {
    return this.db.execute("hardDelete", (d) => d.hardDelete(this.collection, id));
  }
}
