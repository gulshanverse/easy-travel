/**
 * ConnectionPool, DatabaseManager and TransactionManager.
 *
 * The pool is a logical lease manager around a driver: it bounds concurrent
 * in-flight operations, enforces acquire timeouts, applies bounded retries
 * with deterministic backoff, and records pool/query metrics.
 */

import { DatabaseConnectionError, PoolExhaustedError, TransactionError } from "../errors";
import type { DatabaseConfig } from "../config";
import {
  aggregateHealth,
  noopTelemetry,
  PersistenceMetrics,
  type AggregatedHealth,
  type PersistenceTelemetry,
} from "../telemetry";
import type { DatabaseDriver } from "./types";

export interface PoolStats {
  readonly max: number;
  readonly inFlight: number;
  readonly waiting: number;
  readonly acquired: number;
  readonly timeouts: number;
}

export class ConnectionPool {
  private inFlight = 0;
  private waiting: Array<() => void> = [];
  private acquired = 0;
  private timeouts = 0;

  constructor(
    private readonly config: DatabaseConfig,
    private readonly metrics: PersistenceMetrics,
  ) {}

  stats(): PoolStats {
    return Object.freeze({
      max: this.config.pool.max,
      inFlight: this.inFlight,
      waiting: this.waiting.length,
      acquired: this.acquired,
      timeouts: this.timeouts,
    });
  }

  async withConnection<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private async acquire(): Promise<void> {
    if (this.inFlight < this.config.pool.max) {
      this.inFlight += 1;
      this.acquired += 1;
      this.metrics.increment("db.pool.acquire");
      return;
    }
    this.metrics.increment("db.pool.wait");
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiting = this.waiting.filter((w) => w !== waiter);
        this.timeouts += 1;
        this.metrics.increment("db.pool.timeout");
        reject(new PoolExhaustedError("connection acquire timed out", { ...this.stats() }));
      }, this.config.pool.acquireTimeoutMs);
      const waiter = () => {
        clearTimeout(timer);
        this.inFlight += 1;
        this.acquired += 1;
        resolve();
      };
      this.waiting.push(waiter);
    });
  }

  private release(): void {
    this.inFlight -= 1;
    const next = this.waiting.shift();
    if (next) next();
  }
}

export class TransactionManager {
  private depth = 0;
  constructor(
    private readonly driver: DatabaseDriver,
    private readonly metrics: PersistenceMetrics,
  ) {}

  get inTransaction(): boolean {
    return this.depth > 0;
  }

  /** Runs `fn` inside a transaction, rolling back on any thrown error. */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.depth > 0) throw new TransactionError("nested transactions are not supported");
    const tx = await this.driver.begin();
    this.depth = 1;
    this.metrics.increment("db.tx.begin");
    try {
      const result = await fn();
      await this.driver.commit(tx);
      this.metrics.increment("db.tx.commit");
      return result;
    } catch (err) {
      await this.driver.rollback(tx);
      this.metrics.increment("db.tx.rollback");
      throw err;
    } finally {
      this.depth = 0;
    }
  }
}

export class DatabaseManager {
  readonly pool: ConnectionPool;
  readonly transactions: TransactionManager;

  constructor(
    readonly driver: DatabaseDriver,
    private readonly config: DatabaseConfig,
    readonly metrics: PersistenceMetrics = new PersistenceMetrics(),
    private readonly telemetry: PersistenceTelemetry = noopTelemetry,
  ) {
    this.pool = new ConnectionPool(config, metrics);
    this.transactions = new TransactionManager(driver, metrics);
  }

  /** Executes a driver operation with pooling, retries and metrics. */
  async execute<T>(name: string, fn: (driver: DatabaseDriver) => Promise<T>): Promise<T> {
    return this.pool.withConnection(() =>
      this.metrics.time(`db.query.${name}`, async () => {
        let lastError: unknown;
        for (let attempt = 0; attempt <= this.config.pool.maxRetries; attempt++) {
          try {
            return await fn(this.driver);
          } catch (err) {
            lastError = err;
            if (!isRetryable(err) || attempt === this.config.pool.maxRetries) break;
            this.metrics.increment("db.query.retry");
            await delay(this.config.pool.retryBaseDelayMs * 2 ** attempt);
          }
        }
        this.telemetry.error(`db.query.${name}`, lastError);
        throw lastError;
      }),
    );
  }

  async health(): Promise<AggregatedHealth> {
    let reachable = false;
    try {
      reachable = await this.driver.ping();
    } catch (err) {
      this.telemetry.error("db.ping", err);
    }
    const stats = this.pool.stats();
    return aggregateHealth([
      {
        name: "database.driver",
        status: reachable ? "healthy" : "unhealthy",
        details: { kind: this.driver.kind },
      },
      {
        name: "database.pool",
        status: stats.inFlight >= stats.max ? "degraded" : "healthy",
        details: { ...stats },
      },
    ]);
  }
}

function isRetryable(err: unknown): boolean {
  if (err instanceof DatabaseConnectionError) return true;
  const msg = String((err as Error)?.message ?? "").toLowerCase();
  return (
    msg.includes("timeout") ||
    msg.includes("connection") ||
    msg.includes("econnreset") ||
    msg.includes("temporarily")
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
