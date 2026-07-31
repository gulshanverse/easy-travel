/**
 * Identity Platform — in-memory stores and registry.
 */
import { IdentityLimitError } from "./errors";

export class KeyedStore<T extends { readonly id: string }> {
  protected readonly byId = new Map<string, T>();
  set(item: T): T { this.byId.set(item.id, item); return item; }
  get(id: string): T | undefined { return this.byId.get(id); }
  has(id: string): boolean { return this.byId.has(id); }
  delete(id: string): boolean { return this.byId.delete(id); }
  list(): readonly T[] { return [...this.byId.values()]; }
  size(): number { return this.byId.size; }
  clear(): void { this.byId.clear(); }
}

/** Store indexed by id with a secondary owner (userId) index. */
export class OwnedStore<T extends { readonly id: string; readonly userId: string }> extends KeyedStore<T> {
  private readonly byUser = new Map<string, Set<string>>();
  constructor(private readonly limitPerUser: number, private readonly label: string) { super(); }

  add(item: T): T {
    const set = this.byUser.get(item.userId) ?? new Set<string>();
    if (!set.has(item.id) && set.size >= this.limitPerUser) {
      throw new IdentityLimitError(`${this.label} limit reached for user`, {
        userId: item.userId, limit: this.limitPerUser,
      });
    }
    set.add(item.id);
    this.byUser.set(item.userId, set);
    return this.set(item);
  }
  replace(item: T): T { return this.set(item); }
  override delete(id: string): boolean {
    const item = this.get(id);
    if (!item) return false;
    this.byUser.get(item.userId)?.delete(id);
    return super.delete(id);
  }
  forUser(userId: string): readonly T[] {
    const ids = this.byUser.get(userId);
    if (!ids) return [];
    const out: T[] = [];
    for (const id of ids) { const v = this.get(id); if (v) out.push(v); }
    return out;
  }
  countForUser(userId: string): number { return this.byUser.get(userId)?.size ?? 0; }
  deleteForUser(userId: string): number {
    const ids = [...(this.byUser.get(userId) ?? [])];
    for (const id of ids) super.delete(id);
    this.byUser.delete(userId);
    return ids.length;
  }
  override clear(): void { super.clear(); this.byUser.clear(); }
}

/** Single-record-per-user store (profile, preferences, settings...). */
export class SingletonStore<T> {
  private readonly byUser = new Map<string, T>();
  set(userId: string, value: T): T { this.byUser.set(userId, value); return value; }
  get(userId: string): T | undefined { return this.byUser.get(userId); }
  delete(userId: string): boolean { return this.byUser.delete(userId); }
  size(): number { return this.byUser.size; }
  entries(): readonly [string, T][] { return [...this.byUser.entries()]; }
  clear(): void { this.byUser.clear(); }
}

/** Registry of named IdentityManagers within one process. */
export class IdentityRegistry<M> {
  private readonly byId = new Map<string, M>();
  register(id: string, manager: M): M {
    if (this.byId.has(id)) throw new IdentityLimitError(`duplicate identity manager: ${id}`, { id });
    this.byId.set(id, manager);
    return manager;
  }
  get(id: string): M | undefined { return this.byId.get(id); }
  list(): readonly string[] { return [...this.byId.keys()]; }
  unregister(id: string): boolean { return this.byId.delete(id); }
  clear(): void { this.byId.clear(); }
  size(): number { return this.byId.size; }
}
