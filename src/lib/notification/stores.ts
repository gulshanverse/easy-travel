/**
 * NCP — persistence-backed collection stores.
 *
 * All notification state lives in the Persistence Platform. Nothing here
 * keeps authoritative in-memory state.
 */
import type { NotificationDoc, NotificationPersistencePort, NotificationRepository } from "./ports";

export class NotificationStore<T extends { id: string }> {
  constructor(
    private readonly repo: NotificationRepository<NotificationDoc>,
    readonly collection: string,
    private readonly ownerOf: (value: T) => string | null = () => null,
  ) {}

  async put(value: T): Promise<T> {
    await this.repo.save(value.id, value as unknown as NotificationDoc, this.ownerOf(value));
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

export function notificationStoreFor<T extends { id: string }>(
  persistence: NotificationPersistencePort,
  collection: string,
  ownerOf?: (value: T) => string | null,
): NotificationStore<T> {
  return new NotificationStore<T>(
    persistence.repository<NotificationDoc>(collection),
    collection,
    ownerOf,
  );
}
