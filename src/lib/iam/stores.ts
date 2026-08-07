/**
 * IAM Platform — persistence-backed collection stores.
 *
 * Every IAM aggregate is persisted through the Persistence Platform via the
 * `IamPersistencePort`. There is no in-memory authentication state: the
 * stores below are thin, typed projections over repositories.
 */
import type { IamDoc, IamPersistencePort, IamRepository } from "./ports";

export class CollectionStore<T extends { id: string }> {
  constructor(
    private readonly repo: IamRepository<IamDoc>,
    readonly collection: string,
    private readonly ownerOf: (value: T) => string | null = () => null,
  ) {}

  async put(value: T): Promise<T> {
    await this.repo.save(value.id, value as unknown as IamDoc, this.ownerOf(value));
    return value;
  }

  async get(id: string): Promise<T | undefined> {
    const row = await this.repo.findById(id);
    return row ? (row.data as unknown as T) : undefined;
  }

  async all(): Promise<readonly T[]> {
    const rows = await this.repo.find({});
    return rows.map((r) => r.data as unknown as T);
  }

  async where(predicate: (value: T) => boolean): Promise<readonly T[]> {
    return (await this.all()).filter(predicate);
  }

  async first(predicate: (value: T) => boolean): Promise<T | undefined> {
    return (await this.all()).find(predicate);
  }

  async count(): Promise<number> {
    return this.repo.count({});
  }

  async remove(id: string): Promise<boolean> {
    return this.repo.hardDelete(id);
  }
}

export function storeFor<T extends { id: string }>(
  persistence: IamPersistencePort,
  collection: string,
  ownerOf?: (value: T) => string | null,
): CollectionStore<T> {
  return new CollectionStore<T>(persistence.repository<IamDoc>(collection), collection, ownerOf);
}
