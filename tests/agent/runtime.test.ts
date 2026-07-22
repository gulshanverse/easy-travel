/**
 * ARP — unit, integration, architecture-fitness, governance,
 * concurrency and stress tests. All engine interop occurs through ports.
 */
import { describe, expect, it } from "vitest";
import {
  createAgentRuntime, AGENT_RUNTIME_ENGINE_CONTRACT, AGENT_RUNTIME_CAPABILITY_MANIFEST,
  makeAgent, makePlan, makeTask, makeSession, makeConversation,
  IntentEngine, PlanningEngine, CapabilitySelectionEngine, GovernanceEngine, ResponseAssemblyEngine,
  canTransitionAgent, transitionAgent, AgentLifecycleError,
  AgentValidationError, CapabilitySelectionError, GovernanceError,
  TravelOrchestratorAgent,
  mergeGovernancePolicies,
  type AgentCTORPort, type AgentCapabilityDescriptor, type AgentWorkflowResult,
} from "@/lib/agent";

function stubCTOR(overrides: Partial<AgentCTORPort> = {}): AgentCTORPort {
  const caps: AgentCapabilityDescriptor[] = [
    { id: "journey.assemble-context", name: "journey", version: "1.0.0" },
    { id: "goal.plan", name: "goal", version: "1.0.0" },
    { id: "decision.rank", name: "decision", version: "1.0.0" },
    { id: "spatial.query", name: "spatial", version: "1.0.0" },
    { id: "trust.evaluate", name: "trust", version: "1.0.0" },
  ];
  return {
    async healthy() { return true; },
    async listCapabilities() { return caps; },
    async getCapability(id) { return caps.find(c => c.id === id); },
    async isVersionCompatible() { return true; },
    async invokeCapability() { return {}; },
    async runWorkflow(req) {
      const steps = (req.steps ?? []).map(s => ({ id: s.id, status: "succeeded" as const, ms: 1 }));
      const outputs: Record<string, unknown> = {};
      for (const s of req.steps ?? []) outputs[s.id] = { capability: s.capabilityId, ok: true };
      return { status: "completed", outputs, ms: steps.length, steps } as AgentWorkflowResult;
    },
    ...overrides,
  };
}

describe("ARP / factories & validation", () => {
  it("makeAgent freezes and validates", () => {
    const a = TravelOrchestratorAgent();
    expect(Object.isFrozen(a)).toBe(true);
    expect(Object.isFrozen(a.metadata)).toBe(true);
    expect(Object.isFrozen(a.capabilities)).toBe(true);
    expect(a.status).toBe("registered");
    expect(() => makeAgent({ type: "generic", name: "x", version: "bad" })).toThrow(AgentValidationError);
  });
  it("makePlan rejects duplicates and unknown deps", () => {
    const t1 = makeTask({ kind: "synthesize", dependsOn: [] });
    expect(() => makePlan({ agentId: "a", intentId: "i", strategy: "sequential", tasks: [t1, t1] }))
      .toThrow(AgentValidationError);
    expect(() => makePlan({
      agentId: "a", intentId: "i", strategy: "sequential",
      tasks: [makeTask({ kind: "synthesize", dependsOn: ["nope"] })],
    })).toThrow(AgentValidationError);
  });
});

describe("ARP / lifecycle", () => {
  it("transitions along the happy path", () => {
    expect(canTransitionAgent("registered", "ready")).toBe(true);
    expect(canTransitionAgent("ready", "receiving-request")).toBe(true);
    expect(canTransitionAgent("archived", "ready")).toBe(false);
    expect(() => transitionAgent("archived", "ready")).toThrow(AgentLifecycleError);
  });
});

describe("ARP / intent engine", () => {
  it("classifies deterministically without an LLM", () => {
    const engine = new IntentEngine();
    const a = engine.classify({ agentId: "a1", rawInput: "book a hotel in Paris" });
    const b = engine.classify({ agentId: "a1", rawInput: "book a hotel in Paris" });
    expect(a.classification).toBe("book.hotel");
    expect(a.classification).toBe(b.classification);
    expect(a.domain).toBe("booking");
    const c = engine.classify({ agentId: "a1", rawInput: "plan a trip to Japan next spring" });
    expect(c.classification).toBe("plan.trip");
    const d = engine.classify({ agentId: "a1", rawInput: "asdf" });
    expect(d.classification).toBe("generic.request");
  });
});

describe("ARP / planning engine", () => {
  it("produces valid layered plan for plan.trip", () => {
    const engine = new PlanningEngine();
    const intent = new IntentEngine().classify({ agentId: "a", rawInput: "plan trip to Bali" });
    const plan = engine.buildPlan({ agentId: "a", intent });
    expect(plan.tasks.length).toBeGreaterThan(0);
    expect(plan.layers.flat().length).toBe(plan.tasks.length);
    expect(plan.tasks.at(-1)?.kind).toBe("synthesize");
  });
  it("supports parallel blueprints", () => {
    const engine = new PlanningEngine();
    const intent = new IntentEngine().classify({ agentId: "a", rawInput: "explore where to travel" });
    const plan = engine.buildPlan({ agentId: "a", intent });
    expect(plan.strategy).toBe("parallel");
  });
});

describe("ARP / capability selection", () => {
  it("rejects capabilities the agent does not declare", async () => {
    const selector = new CapabilitySelectionEngine();
    const agent = makeAgent({ type: "generic", name: "g", version: "1.0.0", capabilities: [] });
    const plan = makePlan({
      agentId: agent.identity.id, intentId: "i", strategy: "sequential",
      tasks: [makeTask({ kind: "capability-request", capabilityId: "unknown.cap", dependsOn: [] })],
    });
    await expect(selector.select({
      agent, plan, policies: mergeGovernancePolicies(), ctor: stubCTOR(),
    })).rejects.toThrow(CapabilitySelectionError);
  });
  it("selects declared+advertised capabilities", async () => {
    const selector = new CapabilitySelectionEngine();
    const agent = TravelOrchestratorAgent();
    const plan = makePlan({
      agentId: agent.identity.id, intentId: "i", strategy: "sequential",
      tasks: [makeTask({ kind: "capability-request", capabilityId: "decision.rank", dependsOn: [] })],
    });
    const r = await selector.select({ agent, plan, policies: mergeGovernancePolicies(), ctor: stubCTOR() });
    expect(r.decisions.length).toBe(1);
  });
});

describe("ARP / governance", () => {
  it("flags plans that exceed capability budget", async () => {
    const gov = new GovernanceEngine();
    const agent = TravelOrchestratorAgent();
    const tasks = Array.from({ length: 5 }, (_, i) => makeTask({ kind: "capability-request", capabilityId: `c${i}`, dependsOn: [] }));
    const plan = makePlan({ agentId: agent.identity.id, intentId: "i", strategy: "parallel", tasks });
    const r = await gov.validate({ agent, plan, policies: mergeGovernancePolicies({ maxCapabilitiesPerPlan: 2 }) });
    expect(r.ok).toBe(false);
    expect(r.violations[0]).toMatch(/exceeds_budget/);
    await expect(gov.ensure({ agent, plan, policies: mergeGovernancePolicies({ maxCapabilitiesPerPlan: 2 }) })).rejects.toThrow(GovernanceError);
  });
});

describe("ARP / response assembly", () => {
  it("produces structured response only (no NLG)", () => {
    const a = TravelOrchestratorAgent();
    const intent = new IntentEngine().classify({ agentId: a.identity.id, rawInput: "budget for Bali" });
    const plan = new PlanningEngine().buildPlan({ agentId: a.identity.id, intent });
    const assembler = new ResponseAssemblyEngine();
    const resp = assembler.assemble({
      agentId: a.identity.id, sessionId: "s", conversationId: "c", turnId: "t",
      intent, plan, outputs: { hello: 1 },
      workflow: { status: "completed", outputs: { hello: 1 }, ms: 1, steps: [] },
    });
    expect(Object.isFrozen(resp)).toBe(true);
    expect(resp.results.length).toBe(1);
    expect(resp.capabilityTrace.length).toBe(plan.tasks.length);
  });
});

describe("ARP / conversation & session runtimes", () => {
  it("creates session + conversation and appends turns", () => {
    const rt = createAgentRuntime({ ports: { ctor: stubCTOR() } });
    const agent = rt.manager.registerAgent(TravelOrchestratorAgent());
    const s = rt.startSession({ agentId: agent.identity.id });
    const c = rt.createConversation({ sessionId: s.id });
    const { conversation } = rt.manager.conversations.appendTurn(c.id, { role: "user", input: "hi" });
    expect(conversation.turns.length).toBe(1);
    expect(rt.manager.sessions.get(s.id).conversations).toContain(c.id);
  });
  it("expires stale sessions past ttl", async () => {
    const rt = createAgentRuntime({ ports: { ctor: stubCTOR() } });
    const agent = rt.manager.registerAgent(TravelOrchestratorAgent());
    const s = rt.startSession({ agentId: agent.identity.id, ttlMs: 1 });
    await new Promise(r => setTimeout(r, 5));
    const expired = rt.manager.sessions.expireStale();
    expect(expired.some(x => x.id === s.id)).toBe(true);
  });
});

describe("ARP / end-to-end handleRequest via CTOR port", () => {
  it("classifies, plans, executes and assembles a response", async () => {
    const rt = createAgentRuntime({ ports: { ctor: stubCTOR() } });
    const agent = rt.manager.registerAgent(TravelOrchestratorAgent());
    const s = rt.startSession({ agentId: agent.identity.id });
    const c = rt.createConversation({ sessionId: s.id });
    const seen: string[] = [];
    rt.onEvent(e => seen.push(e.name));

    const result = await rt.manager.handleRequest({
      agentId: agent.identity.id, sessionId: s.id, conversationId: c.id,
      input: "plan a trip to Japan",
    });

    expect(result.intent.classification).toBe("plan.trip");
    expect(result.workflow.status).toBe("completed");
    expect(result.response.results.length).toBeGreaterThan(0);
    expect(seen).toContain("IntentClassified");
    expect(seen).toContain("PlanCreated");
    expect(seen).toContain("WorkflowCompleted");
    expect(seen).toContain("ResponseAssembled");
    expect(rt.manager.registry.get(agent.identity.id).status).toBe("ready");

    const snap = rt.metricsSnapshot();
    expect(snap.intents.classified).toBe(1);
    expect(snap.workflows.completed).toBe(1);
    expect(snap.responses.assembled).toBe(1);
  });

  it("marks response degraded when CTOR workflow fails", async () => {
    const rt = createAgentRuntime({ ports: { ctor: stubCTOR({
      async runWorkflow(req) {
        const steps = (req.steps ?? []).map(s => ({ id: s.id, status: "failed" as const, ms: 1 }));
        return { status: "failed", outputs: {}, ms: 1, error: "capability failed", steps };
      },
    }) } });
    const agent = rt.manager.registerAgent(TravelOrchestratorAgent());
    const s = rt.startSession({ agentId: agent.identity.id });
    const c = rt.createConversation({ sessionId: s.id });
    const r = await rt.manager.handleRequest({
      agentId: agent.identity.id, sessionId: s.id, conversationId: c.id,
      input: "book a hotel in Paris",
    });
    expect(r.workflow.status).toBe("failed");
    expect(r.response.confidence).toBeLessThanOrEqual(0.5);
  });
});

describe("ARP / multi-agent registration", () => {
  it("hosts multiple distinct agents", () => {
    const rt = createAgentRuntime({ ports: { ctor: stubCTOR() } });
    const a = rt.manager.registerAgent(TravelOrchestratorAgent({ id: "a1" }));
    const b = rt.manager.registerAgent(makeAgent({ id: "a2", type: "support", name: "Support", version: "1.0.0" }));
    expect(rt.manager.listAgents().map(x => x.identity.id).sort()).toEqual(["a1", "a2"]);
    expect(a.identity.type).toBe("travel-orchestrator");
    expect(b.identity.type).toBe("support");
  });
});

describe("ARP / engine contract + manifest + ADR references", () => {
  it("publishes stable contract & manifest", () => {
    expect(AGENT_RUNTIME_ENGINE_CONTRACT.id).toBe("agent.runtime");
    expect(Object.isFrozen(AGENT_RUNTIME_ENGINE_CONTRACT)).toBe(true);
    expect(Object.isFrozen(AGENT_RUNTIME_CAPABILITY_MANIFEST)).toBe(true);
    expect(AGENT_RUNTIME_ENGINE_CONTRACT.publishedEvents).toContain("ResponseAssembled");
    expect(AGENT_RUNTIME_CAPABILITY_MANIFEST.supportedAgentTypes).toContain("travel-orchestrator");
    expect(AGENT_RUNTIME_ENGINE_CONTRACT.adr).toEqual(["ADR-001", "ADR-002", "ADR-003", "ADR-004", "ADR-005"]);
  });
  it("all referenced ADR files exist", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const dir = path.resolve("docs/adr");
    for (const id of AGENT_RUNTIME_ENGINE_CONTRACT.adr) {
      const found = fs.readdirSync(dir).some(f => f.startsWith(`${id}-`));
      expect(found).toBe(true);
    }
  });
});

describe("ARP / architecture fitness", () => {
  it("does not import any other engine's internals (ports-only)", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const root = path.resolve("src/lib/agent");
    const forbidden = [
      "@/lib/ctor", "@/lib/memory", "@/lib/prompt", "@/lib/graph",
      "@/lib/journey", "@/lib/decision", "@/lib/trust", "@/lib/goal",
      "@/lib/spatial", "@/lib/provider", "@/lib/runtime",
      "src/lib/ctor/", "src/lib/memory/", "src/lib/prompt/", "src/lib/graph/",
      "src/lib/journey/", "src/lib/decision/", "src/lib/trust/", "src/lib/goal/",
      "src/lib/spatial/", "src/lib/provider/", "src/lib/runtime/",
    ];
    const walk = (dir: string): string[] => {
      const out: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walk(p));
        else if (entry.name.endsWith(".ts")) out.push(p);
      }
      return out;
    };
    for (const f of walk(root)) {
      const src = fs.readFileSync(f, "utf8");
      for (const needle of forbidden) expect(src.includes(needle)).toBe(false);
    }
  });
});

describe("ARP / concurrency & stress", () => {
  it("handles 100 concurrent requests under 3s", async () => {
    const rt = createAgentRuntime({ ports: { ctor: stubCTOR() } });
    const agent = rt.manager.registerAgent(TravelOrchestratorAgent());
    const sessions = Array.from({ length: 20 }, () => rt.startSession({ agentId: agent.identity.id }));
    const convs = sessions.map(s => rt.createConversation({ sessionId: s.id }));
    const started = Date.now();
    await Promise.all(convs.flatMap((c, i) => Array.from({ length: 5 }, (_, j) =>
      rt.manager.handleRequest({
        agentId: agent.identity.id, sessionId: sessions[i].id, conversationId: c.id,
        input: j % 2 === 0 ? "book a hotel" : "plan a trip",
      }),
    )));
    expect(Date.now() - started).toBeLessThan(3000);
    const snap = rt.metricsSnapshot();
    expect(snap.responses.assembled).toBe(100);
  });
  it("registers 500 agents quickly", () => {
    const rt = createAgentRuntime({ ports: { ctor: stubCTOR() } });
    const t = Date.now();
    for (let i = 0; i < 500; i++) rt.manager.registerAgent(makeAgent({ id: `a${i}`, type: "generic", name: `agent-${i}`, version: "1.0.0" }));
    expect(rt.manager.listAgents().length).toBe(500);
    expect(Date.now() - t).toBeLessThan(1000);
  });
});
