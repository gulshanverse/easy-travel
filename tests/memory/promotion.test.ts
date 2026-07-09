import { describe, it, expect } from "vitest";
import { MemoryManager, type MemoryDraft } from "../../src/lib/memory";

const OWNER = "user-p";
function d(over: Partial<MemoryDraft> = {}): MemoryDraft {
  return {
    class: "preference",
    kind: "preference/cuisine",
    ownerId: OWNER,
    scope: "user",
    payload: { likes: "ramen" },
    source: { kind: "user_explicit", actorId: OWNER },
    importance: 0.7,
    confidence: 0.85,
    evidence: [
      { evidenceId: "e1", kind: "user_statement", weight: 0.7 },
      { evidenceId: "e2", kind: "observation", weight: 0.6 },
      { evidenceId: "e3", kind: "citation", weight: 0.8 },
    ],
    ...over,
  };
}

describe("MemoryPromotionEngine", () => {
  it("promotes preference → semantic when evidence + confidence high", async () => {
    const m = new MemoryManager();
    const events: string[] = [];
    m.publisher.on("MemoryPromoted", (e) => events.push(`${e.payload.fromClass}->${e.payload.toClass}`));
    const env = await m.write(d());
    const promoted = await m.promote(env);
    expect(promoted).not.toBeNull();
    expect(promoted?.class).toBe("semantic");
    expect(promoted?.promotedFrom).toBe(env.memoryId);
    expect(events).toContain("preference->semantic");
    const source = await m.store.get(env.memoryId, OWNER);
    expect(source?.status).toBe("archived");
  });

  it("does not promote when importance below minimum", async () => {
    const m = new MemoryManager();
    const env = await m.write(d({ importance: 0.1 }));
    expect(await m.promote(env)).toBeNull();
  });

  it("respects enablePromotion flag", async () => {
    const m = new MemoryManager({ config: { flags: { enableCompression: true, enablePromotion: false, enableSemanticSearch: true, enableRelationshipExpansion: true, strictContradictionCheck: false, softDeleteEnabled: true } } });
    const env = await m.write(d());
    expect(await m.promote(env)).toBeNull();
  });
});
