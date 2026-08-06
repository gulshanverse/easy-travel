import { describe, it, expect } from "vitest";
import {
  PersistenceRuntime,
  createPersistenceConfig,
  createProductionConfig,
  assertProductionConfig,
  spec,
  MigrationManager,
  RecordingMigrationContext,
  baselineMigrations,
  COLLECTIONS,
  PersistenceConfigError,
  OptimisticLockError,
} from "../../src/lib/persistence";

type Doc = Record<string, unknown>;

function rt() {
  return new PersistenceRuntime({ config: createPersistenceConfig() });
}

describe("repository layer", () => {
  it("inserts, reads, sorts, filters and paginates", async () => {
    const r = rt();
    const repo = repoOf(r);
    for (let i = 0; i < 12; i++)
      await repo.insert(`j-${i}`, { title: `trip ${i}`, mode: i % 2 ? "rail" : "air" }, "u1");
    const rail = await repo.find({
      ownerId: "u1",
      specification: spec.eq("mode", "rail"),
    });
    expect(rail).toHaveLength(6);
    const page = await repo.paginate({ page: 2, size: 5 }, { ownerId: "u1" });
    expect(page.items).toHaveLength(5);
    expect(page.total).toBe(12);
    expect(page.hasNext).toBe(true);
  });

  it("enforces optimistic locking", async () => {
    const repo = repoOf(rt());
    const saved = await repo.insert("j-1", { title: "a" }, "u1");
    await repo.update("j-1", { title: "b" }, "u1", { expectedVersion: saved.version });
    await expect(
      repo.update("j-1", { title: "c" }, "u1", { expectedVersion: saved.version }),
    ).rejects.toBeInstanceOf(OptimisticLockError);
  });

  it("soft deletes, hides and restores with audit metadata", async () => {
    const repo = repoOf(rt());
    await repo.insert("j-1", { title: "a" }, "u1", { actorId: "u1" });
    expect(await repo.softDelete("j-1", "u1")).toBe(true);
    expect(await repo.findById("j-1")).toBeNull();
    const hidden = await repo.findById("j-1", true);
    expect(hidden?.audit.deletedAt).not.toBeNull();
    expect(hidden?.audit.createdBy).toBe("u1");
    expect(await repo.restore("j-1")).toBe(true);
    expect(await repo.findById("j-1")).not.toBeNull();
  });
});

describe("transactions and unit of work", () => {
  it("rolls back every write when the scope throws", async () => {
    const r = rt();
    const repo = repoOf(r);
    await expect(
      r.unitOfWork.run(async (uow) => {
        await uow.repository<Doc>(COLLECTIONS.journeys).insert("j-tx", { title: "x" }, "u1");
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await repo.findById("j-tx")).toBeNull();
  });

  it("commits and fires after-commit hooks once", async () => {
    const r = rt();
    let hooks = 0;
    await r.unitOfWork.run(async (uow) => {
      uow.onCommit(() => {
        hooks += 1;
      });
      await uow.repository<Doc>(COLLECTIONS.journeys).insert("j-ok", { title: "y" }, "u1");
    });
    expect(hooks).toBe(1);
    expect(await repoOf(r).findById("j-ok")).not.toBeNull();
  });
});

describe("memory store adapter", () => {
  it("satisfies the MemoryStore port including owner isolation", async () => {
    const store = rt().memoryStore();
    const env = {
      memoryId: "m-1",
      ownerId: "u1",
      tenantId: null,
      class: "preference",
      kind: "preference/cuisine",
      status: "active",
      tags: ["food"],
      contentHash: "h1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as unknown as Parameters<typeof store.put>[0];
    await store.put(env);
    expect((await store.get("m-1", "u1"))?.memoryId).toBe("m-1");
    expect(await store.get("m-1", "u2")).toBeNull();
    expect(await store.countByOwner("u1")).toBe(1);
    expect(
      (await store.findByContentHash("u1", "preference", "preference/cuisine", "h1"))?.memoryId,
    ).toBe("m-1");
    const patched = await store.patch("m-1", { importance: 0.9 } as never);
    expect(patched.memoryId).toBe("m-1");
    await store.hardDelete("m-1", "u1");
    expect(await store.get("m-1", "u1")).toBeNull();
  });
});

describe("cache platform", () => {
  it("namespaces reads/writes and reports hit rate", async () => {
    const r = rt();
    await r.cache.session.set("s1", { userId: "u1" });
    expect(await r.cache.session.get<{ userId: string }>("s1")).toEqual({ userId: "u1" });
    expect(await r.cache.workflow.get("s1")).toBeNull();
    expect(r.cache.session.stats().hitRate).toBeGreaterThan(0);
  });

  it("expires entries by TTL", async () => {
    const r = rt();
    await r.cache.prompt.set("p", "v", 1);
    await new Promise((res) => setTimeout(res, 5));
    expect(await r.cache.prompt.get("p")).toBeNull();
  });

  it("rate limits within a fixed window", async () => {
    const r = rt();
    const first = await r.cache.rateLimit.consume("ip-1", 2);
    await r.cache.rateLimit.consume("ip-1", 2);
    const third = await r.cache.rateLimit.consume("ip-1", 2);
    expect(first.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.retryAfterMs).toBeGreaterThan(0);
  });
});

describe("object storage abstraction", () => {
  it("round-trips objects and signs urls without provider logic", async () => {
    const r = rt();
    const meta = await r.storage.put("exports", "trip.json", '{"ok":true}', "application/json");
    expect(meta.size).toBeGreaterThan(0);
    const bytes = await r.storage.get("exports", "trip.json");
    expect(new TextDecoder().decode(bytes!)).toContain("ok");
    const signed = await r.storage.signedUrl("exports", "trip.json", "read");
    expect(signed.method).toBe("GET");
    expect(await r.storage.delete("exports", "trip.json")).toBe(true);
  });
});

describe("migrations", () => {
  it("applies, verifies and rolls back deterministically", async () => {
    const ctx = new RecordingMigrationContext();
    const mgr = new MigrationManager(baselineMigrations, ctx);
    const applied = await mgr.migrate();
    expect(applied).toHaveLength(baselineMigrations.length);
    expect(await mgr.currentVersion()).toBe(baselineMigrations.length);
    expect(await mgr.verify()).toEqual([]);
    const rolled = await mgr.rollback(1);
    expect(rolled).toEqual([baselineMigrations.length]);
    expect((await mgr.plan()).pending).toHaveLength(1);
  });

  it("refuses reset in production", async () => {
    const mgr = new MigrationManager(baselineMigrations, new RecordingMigrationContext());
    await expect(mgr.reset("production")).rejects.toThrow(/forbidden/);
  });
});

describe("production configuration", () => {
  it("rejects in-memory drivers in production", () => {
    expect(() =>
      assertProductionConfig(createPersistenceConfig({ environment: "production" })),
    ).toThrow(PersistenceConfigError);
  });

  it("builds a production config selecting postgres, redis and object storage", () => {
    const cfg = createProductionConfig();
    expect(cfg.database.driver).toBe("postgres");
    expect(cfg.cache.driver).toBe("redis");
    expect(cfg.storage.driver).toBe("s3");
    expect(() => new PersistenceRuntime({ config: cfg })).toThrow(PersistenceConfigError);
  });
});

describe("concurrency and performance", () => {
  it("serialises concurrent writes through the pool", async () => {
    const r = rt();
    const repo = repoOf(r);
    await Promise.all(Array.from({ length: 50 }, (_, i) => repo.insert(`c-${i}`, { i }, "u1")));
    expect(await repo.count({ ownerId: "u1" })).toBe(50);
    expect(r.metricsSnapshot()["db.query.insert.ok"]).toBe(50);
  });

  it("stays within the benchmark budget for 500 reads", async () => {
    const r = rt();
    const repo = repoOf(r);
    await repo.insert("bench", { v: 1 }, "u1");
    const started = Date.now();
    for (let i = 0; i < 500; i++) await repo.findById("bench");
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("reports aggregated health across all three pillars", async () => {
    const health = await rt().health();
    expect(health.status).toBe("healthy");
    expect(health.checks.map((c) => c.name)).toContain("database.driver");
    expect(health.checks.map((c) => c.name)).toContain("cache.driver");
    expect(health.checks.map((c) => c.name)).toContain("storage.driver");
  });
});

function repoOf(r: PersistenceRuntime) {
  return r.repository<Doc>(COLLECTIONS.journeys);
}
