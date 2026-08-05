/**
 * UnitOfWork — groups repository work into a single transactional scope and
 * flushes queued domain side effects only after a successful commit.
 */

import type { DatabaseManager } from "../database/pool";
import type { PersistenceMetrics } from "../telemetry";
import { GenericRepository } from "./generic-repository";
import type { Repository } from "./types";

export type AfterCommitHook = () => void | Promise<void>;

export class UnitOfWork {
  private readonly repos = new Map<string, Repository<Record<string, unknown>>>();
  private readonly afterCommit: AfterCommitHook[] = [];

  constructor(
    private readonly db: DatabaseManager,
    private readonly metrics: PersistenceMetrics = db.metrics,
  ) {}

  repository<T extends Record<string, unknown>>(collection: string): Repository<T> {
    const existing = this.repos.get(collection);
    if (existing) return existing as unknown as Repository<T>;
    const repo = new GenericRepository<T>(collection, this.db);
    this.repos.set(collection, repo as unknown as Repository<Record<string, unknown>>);
    return repo;
  }

  onCommit(hook: AfterCommitHook): void {
    this.afterCommit.push(hook);
  }

  /** Runs `fn` transactionally; hooks fire only after a successful commit. */
  async run<T>(fn: (uow: UnitOfWork) => Promise<T>): Promise<T> {
    const result = await this.db.transactions.run(() => fn(this));
    for (const hook of this.afterCommit.splice(0)) await hook();
    this.metrics.increment("db.uow.commit");
    return result;
  }
}
