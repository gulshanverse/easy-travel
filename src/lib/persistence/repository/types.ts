/**
 * Repository contracts — pagination, sorting, audit metadata, soft delete
 * and optimistic locking, all expressed independently of any driver.
 */

import type { RowSort } from "../database/types";
import type { Specification } from "./specification";

export interface AuditMetadata {
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
}

export interface Entity<T> {
  readonly id: string;
  readonly ownerId: string | null;
  readonly version: number;
  readonly data: T;
  readonly audit: AuditMetadata;
}

export interface PageRequest {
  readonly page?: number;
  readonly size?: number;
  readonly sort?: readonly RowSort[];
}

export interface Page<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly size: number;
  readonly total: number;
  readonly totalPages: number;
  readonly hasNext: boolean;
}

export interface FindOptions {
  readonly ownerId?: string | null;
  readonly specification?: Specification;
  readonly includeDeleted?: boolean;
  readonly sort?: readonly RowSort[];
  readonly limit?: number;
  readonly offset?: number;
}

export interface SaveOptions {
  readonly actorId?: string | null;
  readonly expectedVersion?: number | null;
}

export interface Repository<T> {
  readonly collection: string;
  save(id: string, data: T, ownerId?: string | null, options?: SaveOptions): Promise<Entity<T>>;
  insert(id: string, data: T, ownerId?: string | null, options?: SaveOptions): Promise<Entity<T>>;
  update(id: string, data: T, ownerId?: string | null, options?: SaveOptions): Promise<Entity<T>>;
  findById(id: string, includeDeleted?: boolean): Promise<Entity<T> | null>;
  requireById(id: string): Promise<Entity<T>>;
  find(options?: FindOptions): Promise<readonly Entity<T>[]>;
  paginate(request?: PageRequest, options?: FindOptions): Promise<Page<Entity<T>>>;
  count(options?: FindOptions): Promise<number>;
  exists(id: string): Promise<boolean>;
  softDelete(id: string, actorId?: string | null): Promise<boolean>;
  restore(id: string): Promise<boolean>;
  hardDelete(id: string): Promise<boolean>;
}
