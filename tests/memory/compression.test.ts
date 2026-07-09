import { describe, it, expect } from "vitest";
import { MemoryManager, type MemoryDraft } from "../../src/lib/memory";

const OWNER = "user-c";
function d(text: string, over: Partial<MemoryDraft> = {}): MemoryDraft {
  return {
    class: "conversation",
    kind: "conversation/turn",
    ownerId: OWNER,
    scope: "thread",
    threadId: "t-1",
    payload: { text },
    source: { kind: "user_implicit", actorId: OWNER },
    importance: 0.5,
    confidence: 0.7,
    ...over,
  };
}

describe("MemoryCompressionEngine", () => {
  it("compresses ≥2 memories into a summary and archives sources", async () => {
    const m = new MemoryManager();
    const compressed: number[] = [];
    m.publisher.on("MemoryCompressed", (e) => compressed.push(e.payload.ratio));
    const a = await m.write(d("hello 1"));
    const b = await m.write(d("hello 2"));
    const summary = await m.compress([a, b]);
    expect(summary).not.toBeNull();
    expect(summary?.class).toBe("reflection");
    expect(summary?.relationships.some((r) => r.type === "derived_from")).toBe(true);
    expect(compressed).toContain(2);
    const sourceA = await m.store.get(a.memoryId, OWNER);
    expect(sourceA?.status).toBe("archived");
  });

  it("refuses to compress a single memory", async () => {
    const m = new MemoryManager();
    const a = await m.write(d("solo"));
    expect(await m.compress([a])).toBeNull();
  });

  it("refuses to compress across owners", async () => {
    const m = new MemoryManager();
    const a = await m.write(d("a"));
    const b = await m.write(d("b", { ownerId: "other-owner" }));
    await expect(m.compress([a, b])).rejects.toThrow(/owners/);
  });
});

describe("MemoryArchiver.sweep", () => {
  it("archives TTL-expired active memories", async () => {
    const m = new MemoryManager();
    const past = new Date(Date.now() - 1000).toISOString();
    const env = await m.write({
      class: "short_term", kind: "short-term/turn", ownerId: OWNER, scope: "session",
      payload: { text: "expiring" }, source: { kind: "system_derived", actorId: "sys" },
      ttlExpiresAt: past,
    });
    const stats = await m.sweep(OWNER);
    expect(stats.archived).toBeGreaterThanOrEqual(1);
    const row = await m.store.get(env.memoryId, OWNER);
    expect(row?.status).toBe("archived");
  });
});
