import { describe, it, expect } from "vitest";
import {
  PersistenceRuntime,
  createPersistenceConfig,
  createProductionConfig,
  assertProductionConfig,
  MigrationManager,
  RecordingMigrationContext,
  baselineMigrations,
  checksumOf,
  COLLECTIONS,
  ALL_COLLECTIONS,
  PersistenceConfigError,
  OptimisticLockError,
  RECORDS_DDL,
  OBJECTS_DDL,
  MIGRATIONS_DDL,
} from "../../src/lib/persistence";

type Doc = Record<string, unknown>;

function rt() {
  return new PersistenceRuntime({ config: createPersistenceConfig() });
}

/* ------------------------------------------------------------------ */
/* 1. Migrations: schema, history, checksums, rollback                 */
/* ------------------------------------------------------------------ */

describe("production migrations", () => {
  it("emits DDL for every production table", async () => {
    const ctx = new RecordingMigrationContext();
    await new MigrationManager(baselineMigrations, ctx).migrate();
    const sql = ctx.statements.join("\n");
    expect(sql).toContain("public.persistence_migrations");
    expect(sql).toContain("public.persistence_records");
    expect(sql).toContain("public.persistence_objects");
    expect(RECORDS_DDL).toContain("PRIMARY KEY (collection, id)");
    expect(OBJECTS_DDL).toContain("etag");
    expect(MIGRATIONS_DDL).toContain("checksum");
  });

  it("seeds a registry row for every known collection", async () => {
    const ctx = new RecordingMigrationContext();
    await new MigrationManager(baselineMigrations, ctx).migrate();
    for (const c of ALL_COLLECTIONS) expect(ctx.statements.join("\n")).toContain(`collection:${c}`);
  });

  it("records migration history with stable checksums", async () => {
    const ctx = new RecordingMigrationContext();
    const mgr = new MigrationManager(baselineMigrations, ctx);
    const applied = await mgr.migrate();
    for (const a of applied)
      expect(a.checksum).toBe(checksumOf(baselineMigrations.find((m) => m.version === a.version)!));
    expect(await mgr.verify()).toEqual([]);
    expect(await mgr.currentVersion()).toBe(baselineMigrations.length);
  });

  it("detects checksum drift against a tampered definition", async () => {
    const ctx = new RecordingMigrationContext();
    await new MigrationManager(baselineMigrations, ctx).migrate();
    const tampered = baselineMigrations.map((m) =>
      m.version === 2 ? { ...m, description: "tampered" } : m,
    );
    const problems = await new MigrationManager(tampered, ctx).verify();
    expect(problems.some((p) => p.includes("checksum drift"))).toBe(true);
  });

  it("rolls back fully and re-applies from zero", async () => {
    const ctx = new RecordingMigrationContext();
    const mgr = new MigrationManager(baselineMigrations, ctx);
    await mgr.migrate();
    await mgr.rollback(baselineMigrations.length);
    expect(await mgr.currentVersion()).toBe(0);
    await mgr.migrate();
    expect(await mgr.currentVersion()).toBe(baselineMigrations.length);
    await mgr.reset("development");
    expect(await mgr.verify()).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* 2. Production configuration enforcement                             */
/* ------------------------------------------------------------------ */

describe("production configuration enforcement", () => {
  it("names every in-memory offender", () => {
    try {
      assertProductionConfig(createPersistenceConfig({ environment: "production" }));
      throw new Error("expected rejection");
    } catch (err) {
      const message = (err as Error).message;
      expect(err).toBeInstanceOf(PersistenceConfigError);
      expect(message).toContain("database");
      expect(message).toContain("cache");
      expect(message).toContain("storage");
    }
  });

  it("rejects each in-memory pillar individually in production", () => {
    const base = createProductionConfig();
    const variants = [
      { ...base, database: { ...base.database, driver: "memory" as const } },
      { ...base, cache: { ...base.cache, driver: "memory" as const } },
      { ...base, storage: { ...base.storage, driver: "memory" as const } },
    ];
    for (const cfg of variants)
      expect(() => assertProductionConfig(cfg)).toThrow(PersistenceConfigError);
  });

  it("allows in-memory drivers in development and test only", () => {
    expect(() => createPersistenceConfig({ environment: "development" })).not.toThrow();
    expect(
      () => new PersistenceRuntime({ config: createPersistenceConfig({ environment: "test" }) }),
    ).not.toThrow();
  });

  it("requires structural clients for every production driver", () => {
    expect(() => new PersistenceRuntime({ config: createProductionConfig() })).toThrow(
      PersistenceConfigError,
    );
  });
});

/* ------------------------------------------------------------------ */
/* 3. Adapter validation                                               */
/* ------------------------------------------------------------------ */

describe("adapter validation", () => {
  it("workflow adapter round-trips state and keys", async () => {
    const store = rt().workflowStore();
    await store.save("wf-1", { step: 2 });
    expect(await store.load("wf-1")).toEqual({ step: 2 });
    await store.save("wf-2", { step: 0 });
    expect(await store.keys()).toEqual(["wf-1", "wf-2"]);
    await store.remove("wf-1");
    expect(await store.load("wf-1")).toBeUndefined();
  });

  it.each([
    ["identity", (r: PersistenceRuntime) => r.identityStore(), COLLECTIONS.profiles],
    ["journey", (r: PersistenceRuntime) => r.journeyStore(), COLLECTIONS.journeys],
    ["travel", (r: PersistenceRuntime) => r.travelStore(), COLLECTIONS.travelRecords],
    [
      "document",
      (r: PersistenceRuntime) => r.documentStore(COLLECTIONS.notifications),
      COLLECTIONS.notifications,
    ],
  ])("%s adapter supports CRUD, soft delete and restore", async (_name, make, collection) => {
    const store = make(rt());
    expect(store.collection).toBe(collection);
    await store.put("d-1", { title: "one" }, "u1");
    await store.put("d-2", { title: "two" }, "u1");
    await store.put("d-3", { title: "three" }, "u2");
    expect(await store.get("d-1")).toEqual({ title: "one" });
    expect(await store.listForOwner("u1")).toHaveLength(2);
    expect(await store.count("u1")).toBe(2);
    const page = await store.page(1, 1, "u1");
    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(2);
    expect(await store.remove("d-1", "u1")).toBe(true);
    expect(await store.get("d-1")).toBeNull();
    expect(await store.restore("d-1")).toBe(true);
    expect(await store.get("d-1")).not.toBeNull();
  });

  it("adapters honour optimistic locking and transactional rollback", async () => {
    const r = rt();
    const repo = r.repository<Doc>(COLLECTIONS.profiles);
    const first = await repo.insert("p-1", { name: "a" }, "u1");
    await repo.update("p-1", { name: "b" }, "u1", { expectedVersion: first.version });
    await expect(
      repo.update("p-1", { name: "c" }, "u1", { expectedVersion: first.version }),
    ).rejects.toBeInstanceOf(OptimisticLockError);

    await expect(
      r.unitOfWork.run(async (uow) => {
        await uow.repository<Doc>(COLLECTIONS.travelRecords).insert("t-1", { mode: "rail" });
        throw new Error("abort");
      }),
    ).rejects.toThrow("abort");
    expect(await r.travelStore().get("t-1")).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* 4. Event store, audit store, transactional outbox                   */
/* ------------------------------------------------------------------ */

describe("event store", () => {
  it("appends sequentially and replays deterministically", async () => {
    const events = rt().events();
    await events.append({ stream: "journey-1", eventType: "created", ownerId: "u1" });
    await events.append({
      stream: "journey-1",
      eventType: "leg.added",
      payload: { legs: 2 },
      ownerId: "u1",
      expectedSequence: 1,
    });
    const read = await events.read("journey-1");
    expect(read.map((e) => e.sequence)).toEqual([1, 2]);
    const legs = await events.replay("journey-1", 0, (n, e) =>
      e.eventType === "leg.added" ? n + Number(e.payload.legs) : n,
    );
    expect(legs).toBe(2);
    await expect(
      events.append({ stream: "journey-1", eventType: "x", expectedSequence: 0 }),
    ).rejects.toThrow(/expected 0/);
  });
});

describe("audit store", () => {
  it("keeps an append-only trail per record and actor", async () => {
    const audit = rt().audit();
    await audit.record({
      actorId: "u1",
      ownerId: "u1",
      action: "create",
      collection: COLLECTIONS.journeys,
      recordId: "j-1",
      before: null,
      after: { title: "Kyoto" },
    });
    await audit.record({
      actorId: "u1",
      ownerId: "u1",
      action: "update",
      collection: COLLECTIONS.journeys,
      recordId: "j-1",
      before: { title: "Kyoto" },
      after: { title: "Kyoto in autumn" },
    });
    const trail = await audit.forRecord(COLLECTIONS.journeys, "j-1");
    expect(trail.map((e) => e.action)).toEqual(["create", "update"]);
    expect(await audit.forActor("u1")).toHaveLength(2);
  });
});

describe("transactional outbox", () => {
  it("drains pending messages and marks them delivered", async () => {
    const outbox = rt().outbox();
    await outbox.enqueue("journey.updated", { id: "j-1" });
    await outbox.enqueue("journey.updated", { id: "j-2" });
    expect(await outbox.pending()).toHaveLength(2);
    const result = await outbox.drain(async () => {});
    expect(result).toEqual({ delivered: 2, failed: 0 });
    expect(await outbox.pending()).toHaveLength(0);
  });

  it("retries with backoff and fails after max attempts", async () => {
    const outbox = rt().outbox();
    const msg = await outbox.enqueue("email.send", { to: "a@b.c" });
    let state = await outbox.markFailed(msg.id, "smtp down");
    expect(state.status).toBe("pending");
    expect(Date.parse(state.availableAt)).toBeGreaterThan(Date.parse(msg.availableAt));
    state = await outbox.markFailed(msg.id, "smtp down");
    state = await outbox.markFailed(msg.id, "smtp down");
    expect(state.status).toBe("failed");
    expect(state.attempts).toBe(3);
    expect(await outbox.pending()).toHaveLength(0);
  });

  it("enqueues inside a unit of work and rolls back with it", async () => {
    const r = rt();
    await expect(
      r.unitOfWork.run(async (uow) => {
        await uow.repository<Doc>(COLLECTIONS.journeys).insert("j-x", { title: "x" }, "u1");
        await r.outbox().enqueue("journey.created", { id: "j-x" });
        throw new Error("nope");
      }),
    ).rejects.toThrow("nope");
    expect(await r.outbox().pending()).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ */
/* 5. Runtime health and metrics                                       */
/* ------------------------------------------------------------------ */

describe("runtime observability", () => {
  it("exposes collections, health and metrics for reporting", async () => {
    const r = rt();
    await r.repository<Doc>(COLLECTIONS.journeys).insert("j-1", { title: "a" }, "u1");
    expect(r.collections()).toContain(COLLECTIONS.events);
    expect((await r.health()).status).toBe("healthy");
    expect(Object.keys(r.metricsSnapshot()).length).toBeGreaterThan(0);
  });
});
