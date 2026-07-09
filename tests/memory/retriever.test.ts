import { describe, it, expect } from "vitest";
import { MemoryManager, type MemoryDraft } from "../../src/lib/memory";

const OWNER = "user-r";

function d(over: Partial<MemoryDraft> = {}): MemoryDraft {
  return {
    class: "preference",
    kind: "preference/cuisine",
    ownerId: OWNER,
    scope: "user",
    payload: { text: "loves sushi" },
    source: { kind: "user_explicit", actorId: OWNER },
    importance: 0.7,
    confidence: 0.9,
    tags: ["food", "cuisine-japanese"],
    ...over,
  };
}

describe("MemoryRetriever pipeline", () => {
  it("returns session-scoped context first", async () => {
    const m = new MemoryManager();
    await m.write(
      d({
        class: "conversation",
        kind: "conversation/turn",
        scope: "thread",
        threadId: "t1",
        payload: { text: "we discussed tokyo" },
      }),
    );
    await m.write(d({ payload: { text: "likes sushi and ramen" } }));
    const res = await m.retrieve({
      ownerId: OWNER,
      purpose: "companion_turn",
      text: "tokyo",
      threadId: "t1",
    });
    expect(res.items.length).toBeGreaterThan(0);
    expect(res.trace.stageCounts.context).toBeGreaterThan(0);
  });

  it("applies per-class caps and item cap", async () => {
    const m = new MemoryManager();
    for (let i = 0; i < 10; i++) {
      await m.write(d({ payload: { text: `pref ${i}` }, kind: `preference/kind-${i}` }));
    }
    const res = await m.retrieve({
      ownerId: OWNER,
      purpose: "companion_turn",
      text: "pref",
      budget: { maxItems: 3, perClassCaps: { preference: 2 } },
    });
    expect(res.items.length).toBeLessThanOrEqual(3);
    const prefCount = res.items.filter((i) => i.memory.class === "preference").length;
    expect(prefCount).toBeLessThanOrEqual(2);
  });

  it("is deterministic for identical inputs", async () => {
    const m = new MemoryManager();
    for (let i = 0; i < 5; i++)
      await m.write(d({ payload: { text: `t ${i}` }, kind: `preference/kind-${i}` }));
    const q = {
      ownerId: OWNER,
      purpose: "companion_turn" as const,
      text: "t",
      now: 1_800_000_000_000,
    };
    const a = await m.retrieve(q);
    const b = await m.retrieve(q);
    expect(a.items.map((i) => i.memory.memoryId)).toEqual(b.items.map((i) => i.memory.memoryId));
  });

  it("emits MemoryRetrieved", async () => {
    const m = new MemoryManager();
    const events: number[] = [];
    m.publisher.on("MemoryRetrieved", (e) => events.push(e.payload.itemCount));
    await m.write(d());
    await m.retrieve({ ownerId: OWNER, purpose: "companion_turn", text: "sushi" });
    expect(events.length).toBe(1);
  });

  it("degrades under diversity floor without dropping items", async () => {
    const m = new MemoryManager();
    for (let i = 0; i < 3; i++)
      await m.write(d({ payload: { text: `p${i}` }, kind: `preference/k-${i}` }));
    const res = await m.retrieve({
      ownerId: OWNER,
      purpose: "companion_turn",
      text: "p",
      budget: { diversityFloor: 5 },
    });
    expect(res.trace.degraded).toBe(true);
    expect(res.trace.degradedReason).toBe("diversity_floor_unmet");
  });
});
