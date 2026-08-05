/**
 * Persistence Platform — error hierarchy.
 * Engines never see driver-specific errors; everything is normalised here.
 */

export class PersistenceError extends Error {
  constructor(
    message: string,
    readonly details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class PersistenceConfigError extends PersistenceError {}
export class DatabaseConnectionError extends PersistenceError {}
export class DatabaseQueryError extends PersistenceError {}
export class TransactionError extends PersistenceError {}
export class MigrationError extends PersistenceError {}
export class CacheError extends PersistenceError {}
export class ObjectStorageError extends PersistenceError {}

export class RecordNotFoundError extends PersistenceError {
  constructor(collection: string, id: string) {
    super(`record not found: ${collection}/${id}`, { collection, id });
  }
}

export class OptimisticLockError extends PersistenceError {
  constructor(collection: string, id: string, expected: number, actual: number) {
    super(`optimistic lock conflict on ${collection}/${id}`, {
      collection,
      id,
      expected,
      actual,
    });
  }
}

export class PoolExhaustedError extends PersistenceError {}
