import { describe, it, expect } from "vitest";
import { MemoryManager, type MemoryDraft } from "@/lib/memory";

const OWNER = "user-1";

function draft(over: Partial<MemoryDraft> = {}): MemoryDraft {
  return {
    class: "preference",
    kind: "preference/cuisine",
    ownerId: OWNER,
    scope: "user",
    payload: { likes: "sushi" },
    source: { kind: "user_explicit", actorId: OWNER },
    importance: 0.6,
    confidence: 0.8,
    ...over,
  };
}

describe("MemoryManager.write", () => {
  it("persists and emits MemoryCreated", async () => {
    const m = new MemoryManager();
    const events: string[] = [];
    m.publisher.on("MemoryCreated", (e) => events.push(e.eventName));
    const env = await m.write(draft());
    expect(env.memoryId).toBeTruthy();
    expect(env.contentHash).toBeTruthy();
    expect(env.status).toBe("active");
    expect(events).toContain("MemoryCreated");
  });

  it("dedups by content hash", async () => {
    const m = new MemoryManager();
    const a = await m.write(draft());
    const b = await m.write(draft());
    expect(a.memoryId).toBe(b.memoryId);
  });

  it("rejects invalid kind", async () => {
    const m = new MemoryManager();
    await expect(m.write(draft({ kind: "BadKind!!" }))).rejects.toThrow(/kebab/);
  });

  it("assigns TTL from class policy", async () => {
    const m = new MemoryManager();
    const env = await m.write(draft({ class: "short_term", kind: "short-term/turn" }));
    expect(env.ttlExpiresAt).toBeTruthy();
  });
});

describe("MemoryManager.lifecycle", () => {
  it("soft-deletes then restores", async () => {
    const m = new MemoryManager();
    const env = await m.write(draft());
    await m.softDelete(env.memoryId, OWNER, { actorId: OWNER });
    const deleted = await m.store.get(env.memoryId, OWNER);
    expect(deleted?.status).toBe("deleted");
    await m.restore(env.memoryId, OWNER);
    const restored = await m.store.get(env.memoryId, OWNER);
    expect(restored?.status).toBe("active");
  });

  it("hard delete removes the row and emits MemoryForgotten", async () => {
    const m = new MemoryManager();
    const forgotten: string[] = [];
    m.publisher.on("MemoryForgotten", (e) => forgotten.push(e.payload.memoryId));
    const env = await m.write(draft());
    await m.forget(env.memoryId, OWNER, { actorId: OWNER, reason: "rtbf" });
    expect(await m.store.get(env.memoryId, OWNER)).toBeNull();
    expect(forgotten).toContain(env.memoryId);
  });

  it("archives via lifecycle", async () => {
    const m = new MemoryManager();
    const env = await m.write(draft());
    await m.archive(env.memoryId, OWNER, { actorId: "system" });
    const row = await m.store.get(env.memoryId, OWNER);
    expect(row?.status).toBe("archived");
  });

  it("enforces owner isolation", async () => {
    const m = new MemoryManager();
    const env = await m.write(draft());
    expect(await m.store.get(env.memoryId, "user-2")).toBeNull();
  });
});
