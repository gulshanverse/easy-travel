/**
 * Migration framework — deterministic, versioned, reversible.
 *
 * A migration is a pure description: an id, a monotonically increasing
 * version, an `up` and an optional `down`. The MigrationManager records
 * applied versions in the `persistence_migrations` ledger so forward
 * migration, rollback and development reset are all reproducible.
 */

import { MigrationError } from "../errors";

export interface MigrationContext {
  /** Executes DDL/DML. Injected so migrations never import a driver. */
  exec(sql: string): Promise<void>;
  /** Reads applied migration versions from the ledger. */
  applied(): Promise<readonly AppliedMigration[]>;
  /** Records a migration as applied. */
  record(m: Migration, checksum: string, at: string): Promise<void>;
  /** Removes a migration from the ledger. */
  unrecord(version: number): Promise<void>;
}

export interface Migration {
  readonly id: string;
  readonly version: number;
  readonly description: string;
  up(ctx: MigrationContext): Promise<void>;
  down?(ctx: MigrationContext): Promise<void>;
}

export interface AppliedMigration {
  readonly version: number;
  readonly id: string;
  readonly checksum: string;
  readonly appliedAt: string;
}

export interface MigrationPlan {
  readonly currentVersion: number;
  readonly targetVersion: number;
  readonly pending: readonly Migration[];
}

export function checksumOf(m: Migration): string {
  const src = `${m.id}:${m.version}:${m.description}:${m.up.toString()}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < src.length; i++) {
    h ^= src.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export class MigrationManager {
  constructor(
    private readonly migrations: readonly Migration[],
    private readonly ctx: MigrationContext,
  ) {
    const versions = new Set<number>();
    for (const m of migrations) {
      if (versions.has(m.version))
        throw new MigrationError(`duplicate migration version ${m.version}`, { id: m.id });
      versions.add(m.version);
    }
  }

  private ordered(): readonly Migration[] {
    return [...this.migrations].sort((a, b) => a.version - b.version);
  }

  async currentVersion(): Promise<number> {
    const applied = await this.ctx.applied();
    return applied.reduce((max, a) => Math.max(max, a.version), 0);
  }

  async plan(target?: number): Promise<MigrationPlan> {
    const current = await this.currentVersion();
    const all = this.ordered();
    const targetVersion = target ?? all[all.length - 1]?.version ?? 0;
    return Object.freeze({
      currentVersion: current,
      targetVersion,
      pending: all.filter((m) => m.version > current && m.version <= targetVersion),
    });
  }

  /** Applies pending migrations in version order. */
  async migrate(target?: number): Promise<readonly AppliedMigration[]> {
    const plan = await this.plan(target);
    const done: AppliedMigration[] = [];
    for (const m of plan.pending) {
      try {
        await m.up(this.ctx);
      } catch (err) {
        throw new MigrationError(`migration ${m.id} failed`, {
          version: m.version,
          cause: String((err as Error)?.message ?? err),
        });
      }
      const checksum = checksumOf(m);
      const appliedAt = new Date().toISOString();
      await this.ctx.record(m, checksum, appliedAt);
      done.push({ version: m.version, id: m.id, checksum, appliedAt });
    }
    return done;
  }

  /** Rolls back the most recent `steps` migrations. */
  async rollback(steps = 1): Promise<readonly number[]> {
    const applied = [...(await this.ctx.applied())].sort((a, b) => b.version - a.version);
    const rolledBack: number[] = [];
    for (const entry of applied.slice(0, steps)) {
      const m = this.migrations.find((x) => x.version === entry.version);
      if (!m) throw new MigrationError(`no migration definition for version ${entry.version}`);
      if (!m.down) throw new MigrationError(`migration ${m.id} is irreversible`);
      await m.down(this.ctx);
      await this.ctx.unrecord(entry.version);
      rolledBack.push(entry.version);
    }
    return rolledBack;
  }

  /** Verifies applied checksums still match the definitions on disk. */
  async verify(): Promise<readonly string[]> {
    const problems: string[] = [];
    const applied = await this.ctx.applied();
    for (const a of applied) {
      const m = this.migrations.find((x) => x.version === a.version);
      if (!m) {
        problems.push(`applied version ${a.version} has no definition`);
        continue;
      }
      if (checksumOf(m) !== a.checksum) problems.push(`checksum drift on ${m.id}`);
    }
    return problems;
  }

  /** Development-only: rolls everything back and re-applies from zero. */
  async reset(environment: string): Promise<void> {
    if (environment === "production")
      throw new MigrationError("reset is forbidden in production");
    const applied = await this.ctx.applied();
    await this.rollback(applied.length);
    await this.migrate();
  }
}
