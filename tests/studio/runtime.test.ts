/** JSR — unit, integration, architecture-fitness, concurrency and stress tests. */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  createJourneyStudioRuntime, JOURNEY_STUDIO_ENGINE_CONTRACT, JOURNEY_STUDIO_CAPABILITY_MANIFEST,
  makeCard, makeWorkspace, makePlanningSession, makeParticipant,
  TimelineEngine, WorkspaceEngine, SessionEngine, EditingEngine, CollaborationEngine,
  PresentationEngine, canTransitionSession, transitionSession,
  StudioLifecycleError, StudioConflictError, StudioValidationError, StudioEditingError,
  StudioPermissionError, StudioVersioningError,
  mergeStudioConfig, mergeStudioPolicies, emptyWorkspaceState,
  type StudioAgentPort, type StudioAgentResponse,
} from "@/lib/studio";

function stubAgent(overrides: Partial<StudioAgentPort> = {}): StudioAgentPort {
  return {
    async healthy() { return true; },
    async handleRequest(req): Promise<StudioAgentResponse> {
      return Object.freeze({
        id: `resp_${req.input.slice(0, 6)}`,
        agentId: req.agentId,
        sessionId: req.sessionId,
        outputs: {
          dest: { kind: "destination", title: "Kyoto", tags: ["culture"] },
          plan: { kind: "journey", title: "5-day itinerary", timeline: { startAt: 1, endAt: 5, label: "trip" } },
          rec: { kind: "recommendation", title: "Try matcha" },
        },
        evidence: [{ id: "ev1", kind: "source", payload: { url: "x" } }],
      });
    },
    ...overrides,
  };
}

describe("JSR / factories & validation", () => {
  it("cards, workspaces and sessions freeze deeply", () => {
    const card = makeCard({ kind: "destination", title: "Bali" });
    expect(Object.isFrozen(card)).toBe(true);
    expect(Object.isFrozen(card.data)).toBe(true);
    expect(Object.isFrozen(card.tags)).toBe(true);
    const w = makeWorkspace();
    expect(Object.isFrozen(w)).toBe(true);
    expect(w.status).toBe("empty");
    const s = makePlanningSession({ agentId: "a1", title: "T" });
    expect(Object.isFrozen(s)).toBe(true);
    expect(s.revisions).toHaveLength(1);
    expect(s.status).toBe("created");
  });
  it("rejects invalid inputs", () => {
    expect(() => makeCard({ kind: "insight", title: "" })).toThrow(StudioValidationError);
    expect(() => makePlanningSession({ agentId: "" })).toThrow(StudioValidationError);
    expect(() => makeParticipant("", "editor")).toThrow(StudioValidationError);
  });
});

describe("JSR / lifecycle", () => {
  it("respects state transitions", () => {
    expect(canTransitionSession("created", "active")).toBe(true);
    expect(canTransitionSession("archived", "active")).toBe(false);
    const s = makePlanningSession({ agentId: "a" });
    expect(() => transitionSession(transitionSession(s, "ended").status === "ended"
      ? transitionSession(s, "ended") : s, "active")).toThrow(StudioLifecycleError);
  });
});

describe("JSR / timeline engine", () => {
  it("insert, move, reorder, checkpoint and restore", () => {
    let t = TimelineEngine.insert(makeWorkspace().timeline, { label: "A" }).timeline;
    t = TimelineEngine.insert(t, { label: "B" }).timeline;
    t = TimelineEngine.insert(t, { label: "C" }).timeline;
    expect(t.items.map(i => i.label)).toEqual(["A", "B", "C"]);
    t = TimelineEngine.move(t, t.items[0].id, 2);
    expect(t.items.map(i => i.label)).toEqual(["B", "C", "A"]);
    t = TimelineEngine.reorder(t, [t.items[2].id, t.items[0].id, t.items[1].id]);
    const { timeline: withCp, checkpoint } = TimelineEngine.checkpoint(t, "milestone");
    const restored = TimelineEngine.restoreCheckpoint(
      TimelineEngine.insert(withCp, { label: "D" }).timeline, checkpoint.id
    );
    expect(restored.items).toHaveLength(3);
    expect(() => TimelineEngine.delete(t, "missing")).toThrow(StudioEditingError);
    expect(() => TimelineEngine.reorder(t, ["x"])).toThrow(StudioEditingError);
  });
});

describe("JSR / workspace engine", () => {
  it("insert, remove, move, merge, split", () => {
    let state = emptyWorkspaceState();
    const c1 = makeCard({ kind: "destination", title: "A", tags: ["x"] });
    const c2 = makeCard({ kind: "destination", title: "B", tags: ["y"] });
    state = WorkspaceEngine.insertCard(state, c1, { addToTimeline: true });
    state = WorkspaceEngine.insertCard(state, c2);
    expect(state.workspace.cards).toHaveLength(2);
    expect(state.workspace.timeline.items).toHaveLength(1);
    state = WorkspaceEngine.moveCard(state, c2.id, 0);
    expect(state.workspace.cards[0].id).toBe(c2.id);
    state = WorkspaceEngine.mergeCards(state, c2.id, c1.id);
    expect(state.workspace.cards).toHaveLength(1);
    expect(state.workspace.timeline.items).toHaveLength(0);
    const split = WorkspaceEngine.splitCard(state, c2.id,
      base => [makeCard({ kind: base.kind, title: `${base.title}-1` }), makeCard({ kind: base.kind, title: `${base.title}-2` })]);
    expect(split.workspace.cards).toHaveLength(2);
    expect(() => WorkspaceEngine.insertCard(state, state.workspace.cards[0])).toThrow(StudioConflictError);
    expect(() => WorkspaceEngine.removeCard(state, "nope")).toThrow(StudioEditingError);
  });
});

describe("JSR / session versioning", () => {
  it("creates revisions, promotes drafts, and rolls back", () => {
    let s = makePlanningSession({ agentId: "a" });
    const w1 = SessionEngine.currentWorkspace(s);
    const w2 = WorkspaceEngine.insertCard({ workspace: w1, history: { entries: [] } },
      makeCard({ kind: "insight", title: "note" })).workspace;
    s = SessionEngine.createRevision(s, w2, "add note");
    expect(s.revisionNumber).toBe(2);
    s = SessionEngine.startDraft(s, w2, "draft");
    expect(s.draft).toBeDefined();
    expect(() => SessionEngine.startDraft(s, w2)).toThrow(StudioConflictError);
    s = SessionEngine.promoteDraft(s);
    expect(s.draft).toBeUndefined();
    expect(s.revisionNumber).toBe(3);
    s = SessionEngine.restoreRevision(s, s.revisions[0].id);
    expect(s.revisionNumber).toBe(4);
    expect(SessionEngine.currentWorkspace(s).cards).toHaveLength(0);
    s = SessionEngine.promoteVersion(s, "v1");
    expect(s.versions).toHaveLength(1);
    expect(() => SessionEngine.restoreRevision(s, "missing")).toThrow(StudioVersioningError);
  });
});

describe("JSR / collaboration & conflicts", () => {
  it("adds participants, enforces roles, and locks", () => {
    let s = makePlanningSession({ agentId: "a" });
    const owner = makeParticipant("u_owner", "owner");
    const editor = makeParticipant("u_ed", "editor");
    s = CollaborationEngine.addParticipant(s, owner, 10);
    s = CollaborationEngine.addParticipant(s, editor, 10);
    expect(() => CollaborationEngine.addParticipant(s, owner, 10)).toThrow(StudioConflictError);
    CollaborationEngine.assertRole(s, "u_ed", ["owner", "editor"]);
    expect(() => CollaborationEngine.assertRole(s, "u_ed", ["owner"])).toThrow(StudioPermissionError);
    s = CollaborationEngine.lock(s, "u_owner", 1_000, 5_000);
    expect(() => CollaborationEngine.lock(s, "u_ed", 1_000, 5_000)).toThrow(StudioConflictError);
    s = CollaborationEngine.unlock(s, "u_owner");
    expect(s.lock).toBeUndefined();
    expect(SessionEngine.detectConflict(s, 999)).toBe(true);
    expect(SessionEngine.detectConflict(s, s.revisionNumber)).toBe(false);
  });
});

describe("JSR / editing engine", () => {
  it("guards archived sessions and revision conflicts", () => {
    const cfg = mergeStudioConfig();
    const pol = mergeStudioPolicies();
    let s = makePlanningSession({ agentId: "a" });
    s = transitionSession(s, "active");
    const card = makeCard({ kind: "goal", title: "G" });
    s = EditingEngine.insertCard(s, card, { config: cfg, policies: pol });
    expect(SessionEngine.currentWorkspace(s).cards).toHaveLength(1);
    expect(() => EditingEngine.insertCard(s, card, { config: cfg, policies: pol, expectedRevisionNumber: 999 }))
      .toThrow(StudioConflictError);
    const archived = transitionSession(s, "archived");
    expect(() => EditingEngine.insertCard(archived, card, { config: cfg, policies: pol }))
      .toThrow(StudioConflictError);
  });
});

describe("JSR / presentation engine", () => {
  it("transforms an agent response into cards + timeline", () => {
    const engine = new PresentationEngine();
    const applied = engine.apply({
      response: {
        id: "resp_1", agentId: "a",
        outputs: {
          dest: { kind: "destination", title: "Kyoto" },
          plan: { kind: "journey", title: "Trip", timeline: { startAt: 1, endAt: 2, label: "Trip" } },
        },
        evidence: [{ id: "ev", kind: "source" }],
      },
      addToTimeline: true,
    });
    expect(applied.cards.length).toBe(3);
    expect(applied.workspace.timeline.items.length).toBe(3);
    const kinds = applied.cards.map(c => c.kind).sort();
    expect(kinds).toEqual(["destination", "journey", "trust"]);
  });
});

describe("JSR / runtime end-to-end", () => {
  it("creates a session, applies presentation, edits and archives", async () => {
    const rt = createJourneyStudioRuntime({ agent: stubAgent() });
    const events: string[] = [];
    rt.onEvent(e => events.push(e.name));
    const s0 = rt.manager.createSession({ agentId: "a", title: "Trip" });
    const s1 = rt.manager.activate(s0.id);
    const s2 = await rt.manager.requestAndApply(s1.id, { agentId: "a", input: "plan trip" }, { addToTimeline: true });
    expect(SessionEngine.currentWorkspace(s2).cards.length).toBe(4);
    const first = SessionEngine.currentWorkspace(s2).cards[0];
    const s3 = rt.manager.deleteCard(s2.id, first.id);
    expect(SessionEngine.currentWorkspace(s3).cards.length).toBe(3);
    const s4 = rt.manager.rollbackToRevision(s3.id, s2.currentRevisionId);
    expect(SessionEngine.currentWorkspace(s4).cards.length).toBe(4);
    const owner = rt.manager.addParticipant(s4.id, "u1", "owner").session;
    const archived = rt.manager.archive(owner.id, "u1");
    expect(archived.status).toBe("archived");
    const snap = rt.metricsSnapshot();
    expect(snap.sessions.created).toBe(1);
    expect(snap.presentations.applied).toBe(1);
    expect(events).toContain("SessionCreated");
    expect(events).toContain("PresentationApplied");
    expect(events).toContain("SessionArchived");
    const health = await rt.health();
    expect(health.status).toBe("healthy");
    rt.shutdown();
  });
});

describe("JSR / concurrency", () => {
  it("handles many parallel edits deterministically", async () => {
    const rt = createJourneyStudioRuntime({ agent: stubAgent() });
    const s = rt.manager.createSession({ agentId: "a" });
    rt.manager.activate(s.id);
    const ops = Array.from({ length: 50 }, (_, i) =>
      Promise.resolve(rt.manager.insertCard(s.id, makeCard({ kind: "insight", title: `n${i}` }))));
    await Promise.all(ops);
    const cur = SessionEngine.currentWorkspace(rt.manager.require(s.id));
    expect(cur.cards.length).toBe(50);
  });
});

describe("JSR / stress", () => {
  it("500 sessions and 1000 timeline items complete under 5s", () => {
    const rt = createJourneyStudioRuntime({ agent: stubAgent() });
    const t0 = Date.now();
    for (let i = 0; i < 500; i++) rt.manager.createSession({ agentId: "a" });
    expect(rt.manager.list().length).toBe(500);
    let tl = makeWorkspace().timeline;
    for (let i = 0; i < 1000; i++) tl = TimelineEngine.insert(tl, { label: `i${i}` }).timeline;
    expect(tl.items.length).toBe(1000);
    expect(Date.now() - t0).toBeLessThan(5000);
  });
});

describe("JSR / architecture fitness", () => {
  const forbidden = ["memory", "journey", "decision", "trust", "goal", "spatial", "graph", "prompt", "provider", "runtime", "ctor"];
  it("no source file imports domain engines directly", () => {
    const dir = new URL("../../src/lib/studio/", import.meta.url).pathname;
    const files = readdirSync(dir).filter(f => f.endsWith(".ts"));
    for (const f of files) {
      const src = readFileSync(join(dir, f), "utf8");
      for (const eng of forbidden) {
        const pattern = new RegExp(`from ["']@/lib/${eng}(?:/|["'])`);
        expect(pattern.test(src), `${f} must not import @/lib/${eng}`).toBe(false);
      }
    }
  });
  it("contract & manifest are frozen and stable", () => {
    expect(Object.isFrozen(JOURNEY_STUDIO_ENGINE_CONTRACT)).toBe(true);
    expect(Object.isFrozen(JOURNEY_STUDIO_CAPABILITY_MANIFEST)).toBe(true);
    expect(JOURNEY_STUDIO_ENGINE_CONTRACT.dependencies.frozenEngines).toEqual(["agent.runtime"]);
    expect(JOURNEY_STUDIO_ENGINE_CONTRACT.ports).toEqual(["StudioAgentPort"]);
  });
});
