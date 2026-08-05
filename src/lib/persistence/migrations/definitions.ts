/**
 * Schema definitions and the baseline migration set.
 * SQL lives here only — no engine and no repository owns SQL.
 */

import { ALL_COLLECTIONS } from "../collections";
import type { Migration, MigrationContext, AppliedMigration } from "./framework";

export const RECORDS_DDL = `
CREATE TABLE IF NOT EXISTS public.persistence_records (
  collection  text NOT NULL,
  id          text NOT NULL,
  owner_id    uuid NULL,
  version     integer NOT NULL DEFAULT 1,
  data        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz NULL,
  created_by  uuid NULL,
  updated_by  uuid NULL,
  PRIMARY KEY (collection, id)
);
CREATE INDEX IF NOT EXISTS persistence_records_owner_idx
  ON public.persistence_records (collection, owner_id);
CREATE INDEX IF NOT EXISTS persistence_records_live_idx
  ON public.persistence_records (collection, deleted_at);
CREATE INDEX IF NOT EXISTS persistence_records_data_idx
  ON public.persistence_records USING gin (data);
`;

export const MIGRATIONS_DDL = `
CREATE TABLE IF NOT EXISTS public.persistence_migrations (
  version    integer PRIMARY KEY,
  id         text NOT NULL,
  checksum   text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
`;

export const OBJECTS_DDL = `
CREATE TABLE IF NOT EXISTS public.persistence_objects (
  key          text PRIMARY KEY,
  bucket       text NOT NULL,
  size_bytes   bigint NOT NULL,
  content_type text NOT NULL,
  etag         text NOT NULL,
  owner_id     uuid NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
`;

export const baselineMigrations: readonly Migration[] = Object.freeze([
  {
    id: "0001_migration_ledger",
    version: 1,
    description: "Schema version ledger",
    async up(ctx) {
      await ctx.exec(MIGRATIONS_DDL);
    },
    async down(ctx) {
      await ctx.exec("DROP TABLE IF EXISTS public.persistence_migrations;");
    },
  },
  {
    id: "0002_persistence_records",
    version: 2,
    description: "Unified record store for every persisted collection",
    async up(ctx) {
      await ctx.exec(RECORDS_DDL);
    },
    async down(ctx) {
      await ctx.exec("DROP TABLE IF EXISTS public.persistence_records;");
    },
  },
  {
    id: "0003_persistence_objects",
    version: 3,
    description: "Object storage metadata index",
    async up(ctx) {
      await ctx.exec(OBJECTS_DDL);
    },
    async down(ctx) {
      await ctx.exec("DROP TABLE IF EXISTS public.persistence_objects;");
    },
  },
  {
    id: "0004_seed_collections",
    version: 4,
    description: "Seed collection registry rows (idempotent)",
    async up(ctx) {
      for (const c of ALL_COLLECTIONS) {
        await ctx.exec(
          `INSERT INTO public.persistence_records (collection, id, data)
             VALUES ('capabilities', 'collection:${c}', '{"collection":"${c}"}'::jsonb)
             ON CONFLICT (collection, id) DO NOTHING;`,
        );
      }
    },
    async down(ctx) {
      await ctx.exec(
        `DELETE FROM public.persistence_records
           WHERE collection = 'capabilities' AND id LIKE 'collection:%';`,
      );
    },
  },
]);

/** In-process migration context used by tests and by dry-run planning. */
export class RecordingMigrationContext implements MigrationContext {
  readonly statements: string[] = [];
  private readonly ledger: AppliedMigration[] = [];

  async exec(sql: string): Promise<void> {
    this.statements.push(sql.trim());
  }
  async applied(): Promise<readonly AppliedMigration[]> {
    return [...this.ledger];
  }
  async record(m: Migration, checksum: string, at: string): Promise<void> {
    this.ledger.push({ version: m.version, id: m.id, checksum, appliedAt: at });
  }
  async unrecord(version: number): Promise<void> {
    const i = this.ledger.findIndex((x) => x.version === version);
    if (i >= 0) this.ledger.splice(i, 1);
  }
}
