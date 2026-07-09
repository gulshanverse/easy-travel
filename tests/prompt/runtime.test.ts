import { describe, expect, it } from "vitest";
import {
  PromptRegistry,
  PromptTemplateRegistry,
  PromptAssembler,
  PromptCompiler,
  PromptBudgetManager,
  PromptValidator,
  PromptRepairEngine,
  PromptCache,
  PromptRuntime,
  PromptContextAssembler,
  DEFAULT_PROMPT_CONFIG,
  DEFAULT_BUDGET,
  compareSemver,
  isCompatible,
  PromptVersionManager,
  BudgetExceededError,
  ContextOverflowError,
  VersionConflictError,
  RegistryError,
  ValidationError,
  TemplateError,
  RetryExceededError,
  CancellationError,
  estimateTokens,
  stableHash,
  canonicalJson,
  InMemoryPromptEventPublisher,
  type PromptFragment,
  type ProviderAdapter,
  type ProviderResponse,
  type ProviderChunk,
  type PromptRequest,
  type MemoryPort,
  type MemoryPortResult,
} from "@/lib/prompt";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fragment(id: string, overrides: Partial<PromptFragment> = {}): PromptFragment {
  return {
    id,
    kind: "mission",
    role: "system",
    order: 10,
    priority: 100,
    content: `content-${id}`,
    ...overrides,
  };
}

const stubProvider: ProviderAdapter = {
  name: "stub",
  async execute(prompt): Promise<ProviderResponse> {
    return {
      content: `echo:${prompt.messages.map((m) => m.content).join("|")}`,
      usage: { inputTokens: prompt.estimatedTokens, outputTokens: 12, totalTokens: prompt.estimatedTokens + 12, costEstimate: 0.001 },
      finishReason: "stop",
    };
  },
  async *stream(prompt): AsyncIterable<ProviderChunk> {
    const words = prompt.messages[prompt.messages.length - 1].content.split(" ");
    for (let i = 0; i < words.length; i++) {
      yield { index: i, delta: words[i] + (i < words.length - 1 ? " " : ""), finished: i === words.length - 1 };
    }
  },
};

// ─── ids/helpers ─────────────────────────────────────────────────────────────
describe("ids helpers", () => {
  it("estimates tokens", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBeGreaterThan(0);
  });
  it("hashes deterministically", () => {
    expect(stableHash("x")).toBe(stableHash("x"));
    expect(stableHash("x")).not.toBe(stableHash("y"));
  });
  it("canonicalises JSON key order", () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }));
  });
});

// ─── versioning ──────────────────────────────────────────────────────────────
describe("PromptVersionManager", () => {
  const vm = new PromptVersionManager();
  it("bumps and compares", () => {
    expect(vm.next("1.2.3", "patch")).toBe("1.2.4");
    expect(vm.next("1.2.3", "minor")).toBe("1.3.0");
    expect(vm.next("1.2.3", "major")).toBe("2.0.0");
    expect(compareSemver("1.2.3", "1.2.4")).toBeLessThan(0);
  });
  it("checks compatibility", () => {
    expect(isCompatible("1.2.0", "1.3.0")).toBe(true);
    expect(isCompatible("1.2.0", "2.0.0")).toBe(false);
    expect(isCompatible("1.2.0", "1.1.0")).toBe(false);
  });
  it("throws VersionConflictError on incompatible bump", () => {
    expect(() => vm.assertCompatible("1.0.0", "2.0.0")).toThrow(VersionConflictError);
  });
});

// ─── registry ────────────────────────────────────────────────────────────────
describe("PromptRegistry", () => {
  it("registers, activates and supersedes versions", () => {
    const r = new PromptRegistry();
    r.register({ promptId: "greet", version: "1.0.0", fragments: [fragment("m1")] });
    r.register({ promptId: "greet", version: "1.1.0", fragments: [fragment("m1")] });
    r.activate("greet", "1.0.0");
    expect(r.activeVersion("greet")).toBe("1.0.0");
    r.activate("greet", "1.1.0");
    expect(r.activeVersion("greet")).toBe("1.1.0");
    expect(r.get("greet", "1.0.0")?.status).toBe("deprecated");
  });
  it("rolls back to a previous version", () => {
    const r = new PromptRegistry();
    r.register({ promptId: "p", version: "1.0.0", fragments: [fragment("a")] });
    r.register({ promptId: "p", version: "1.1.0", fragments: [fragment("a")] });
    r.activate("p", "1.0.0");
    r.activate("p", "1.1.0");
    r.rollback("p", "1.0.0");
    expect(r.activeVersion("p")).toBe("1.0.0");
  });
  it("throws on duplicate registration", () => {
    const r = new PromptRegistry();
    r.register({ promptId: "p", version: "1.0.0", fragments: [fragment("a")] });
    expect(() => r.register({ promptId: "p", version: "1.0.0", fragments: [fragment("a")] })).toThrow(VersionConflictError);
  });
  it("throws when resolving unknown prompt", () => {
    const r = new PromptRegistry();
    expect(() => r.resolve("missing")).toThrow(RegistryError);
  });
  it("captures audit trail", () => {
    const r = new PromptRegistry();
    r.register({ promptId: "p", version: "1.0.0", fragments: [fragment("a")] });
    r.activate("p", "1.0.0");
    r.deprecate("p", "1.0.0");
    expect(r.auditTrail("p").length).toBe(3);
  });
});

// ─── templates ───────────────────────────────────────────────────────────────
describe("PromptTemplateRegistry", () => {
  it("renders placeholders and produces fragments", () => {
    const t = new PromptTemplateRegistry();
    t.register({
      id: "greet",
      category: "mission",
      role: "system",
      order: 10,
      priority: 200,
      body: "Hello {{name}}, welcome to {{place}}.",
      requiredVariables: ["name", "place"],
    });
    expect(t.render("greet", { name: "Ada", place: "Kyoto" })).toContain("Ada");
    const frag = t.toFragment("greet", { name: "Ada", place: "Kyoto" });
    expect(frag.kind).toBe("mission");
    expect(frag.content).toContain("Kyoto");
  });
  it("throws on missing required variables", () => {
    const t = new PromptTemplateRegistry();
    t.register({
      id: "x", category: "mission", role: "system", order: 10, priority: 100,
      body: "{{name}}", requiredVariables: ["name"],
    });
    expect(() => t.render("x", {})).toThrow(TemplateError);
  });
});

// ─── budget ──────────────────────────────────────────────────────────────────
describe("PromptBudgetManager", () => {
  it("passes through when under soft budget", () => {
    const m = new PromptBudgetManager({ hard: 1000, soft: 800, reservedOutput: 100, adaptiveSlack: 50 });
    const plan = m.enforce([fragment("a", { content: "short" })]);
    expect(plan.overflow).toBe(false);
    expect(plan.droppedIds).toEqual([]);
  });
  it("drops lowest-priority fragments when over hard budget", () => {
    const m = new PromptBudgetManager({ hard: 60, soft: 50, reservedOutput: 10, adaptiveSlack: 0 });
    const big = "x".repeat(400);
    const plan = m.enforce([
      fragment("keep", { priority: 200, content: big }),
      fragment("drop", { priority: 10, content: big }),
    ]);
    expect(plan.droppedIds).toContain("drop");
  });
  it("raises ContextOverflowError when protected fragments cannot fit", () => {
    const m = new PromptBudgetManager({ hard: 40, soft: 30, reservedOutput: 10, adaptiveSlack: 0 });
    const big = "x".repeat(2_000);
    expect(() => m.enforce([
      fragment("critical", { priority: 200, content: big }),
    ])).toThrow(ContextOverflowError);
  });
  it("throws BudgetExceededError when hard budget is invalid", () => {
    const m = new PromptBudgetManager({ hard: 5, soft: 3, reservedOutput: 10, adaptiveSlack: 0 });
    expect(() => m.enforce([fragment("a")])).toThrow(BudgetExceededError);
  });
});

// ─── validator + repair ─────────────────────────────────────────────────────
describe("PromptValidator + PromptRepairEngine", () => {
  const validator = new PromptValidator();
  const schema = {
    name: "answer",
    schema: { type: "object", required: ["ok"], properties: { ok: { type: "boolean" }, count: { type: "integer" } } },
  };
  it("validates good JSON", () => {
    expect(validator.validateStructured('{"ok":true,"count":3}', schema)).toEqual({ ok: true, count: 3 });
  });
  it("rejects mismatched schema", () => {
    expect(() => validator.validateStructured('{"ok":"yes"}', schema)).toThrow(ValidationError);
  });
  it("repairs fenced JSON", () => {
    const repair = new PromptRepairEngine(validator);
    const result = repair.repair("Here it is:\n```json\n{\"ok\": true, \"count\": 1}\n```", schema);
    expect(result.value).toEqual({ ok: true, count: 1 });
    expect(result.repaired).toBe(true);
  });
  it("repairs trailing-comma JSON", () => {
    const repair = new PromptRepairEngine(validator);
    const result = repair.repair('{"ok":true,"count":2,}', schema);
    expect(result.value).toEqual({ ok: true, count: 2 });
  });
});

// ─── cache ───────────────────────────────────────────────────────────────────
describe("PromptCache", () => {
  it("stores and evicts LRU entries", async () => {
    const c = new PromptCache({
      compiled: { enabled: true, ttlMs: 60_000, maxEntries: 2 },
      semantic: { enabled: true, ttlMs: 60_000, maxEntries: 2 },
      context: { enabled: true, ttlMs: 60_000, maxEntries: 2 },
      template: { enabled: true, ttlMs: 60_000, maxEntries: 2 },
    });
    c.semantic.set("a", { content: "a", cachedAt: Date.now() });
    c.semantic.set("b", { content: "b", cachedAt: Date.now() });
    c.semantic.set("c", { content: "c", cachedAt: Date.now() });
    expect(c.semantic.get("a")).toBeUndefined();
    expect(c.semantic.get("c")).toBeDefined();
  });
  it("invalidates by prompt id/version", () => {
    const c = new PromptCache(DEFAULT_PROMPT_CONFIG.cache);
    const compiled = {
      promptId: "p", version: "1.0.0", fingerprint: "abc",
      messages: [], estimatedTokens: 0, budget: DEFAULT_BUDGET,
      metadata: { correlationId: "c1", createdAt: 0, templateFingerprint: "t" },
    } as never;
    c.compiled.set(c.compiledKey("p", "1.0.0", "abc"), compiled);
    expect(c.invalidateByPrompt("p", "1.0.0")).toBe(1);
  });
});

// ─── assembler + compiler ────────────────────────────────────────────────────
describe("PromptAssembler + PromptCompiler", () => {
  it("assembles fragments deterministically and compiles", () => {
    const assembler = new PromptAssembler();
    const compiler = new PromptCompiler();
    const entry = {
      promptId: "p", version: "1.0.0", status: "active" as const,
      fragments: [fragment("mission1", { kind: "mission", order: 10, content: "Be helpful." })],
      createdAt: 0,
    };
    const request: PromptRequest = {
      promptId: "p",
      correlationId: "c1",
      userInput: "Plan a trip",
      contextOverrides: {
        identity: { userId: "u1", displayName: "Ada", locale: "en-GB" },
        goal: { primary: "Weekend in Rome" },
      },
    };
    const { ir } = assembler.assemble(entry, {
      identity: request.contextOverrides!.identity,
      goal: request.contextOverrides!.goal,
      timeline: { now: Date.now() },
    }, request);
    expect(ir.fragments.some((f) => f.id === "user:input")).toBe(true);
    expect(ir.fragments.some((f) => f.id === "ctx:identity")).toBe(true);
    const compiled = compiler.compile(ir, { budget: DEFAULT_BUDGET });
    expect(compiled.fingerprint).toHaveLength(16);
    // Deterministic — identical IR yields identical fingerprint.
    const compiled2 = compiler.compile(ir, { budget: DEFAULT_BUDGET });
    expect(compiled2.fingerprint).toBe(compiled.fingerprint);
  });
});

// ─── context assembler (with memory port) ────────────────────────────────────
describe("PromptContextAssembler with MemoryPort", () => {
  it("uses the memory port for retrieval", async () => {
    const memory: MemoryPort = {
      async retrieve(): Promise<MemoryPortResult> {
        return {
          items: [
            { memoryId: "m1", class: "preference", content: "loves espresso", confidence: 0.9, createdAt: Date.now() },
          ],
        };
      },
    };
    const ca = new PromptContextAssembler({ memory, ownerId: "u1" });
    const ctx = await ca.assemble({
      request: { promptId: "p", correlationId: "c1", userInput: "?" },
    });
    expect(ctx.memory?.items[0].content).toContain("espresso");
    expect(ctx.timeline?.now).toBeGreaterThan(0);
  });
});

// ─── event publisher ─────────────────────────────────────────────────────────
describe("InMemoryPromptEventPublisher", () => {
  it("delivers to global and typed subscribers", () => {
    const p = new InMemoryPromptEventPublisher();
    const seen: string[] = [];
    p.subscribe((e) => seen.push(`all:${e.type}`));
    p.subscribeTo("PromptRequested", (e) => seen.push(`req:${e.type}`));
    p.publish("PromptRequested", { promptId: "p" }, { correlationId: "c" });
    p.publish("PromptCompleted", {}, { correlationId: "c" });
    expect(seen).toContain("all:PromptRequested");
    expect(seen).toContain("req:PromptRequested");
    expect(seen).toContain("all:PromptCompleted");
    expect(seen).not.toContain("req:PromptCompleted");
  });
});

// ─── end-to-end pipeline via PromptRuntime ───────────────────────────────────
describe("PromptRuntime end-to-end", () => {
  function runtime(providerOverride?: Partial<ProviderAdapter>) {
    const p: ProviderAdapter = { ...stubProvider, ...providerOverride };
    const rt = new PromptRuntime({ provider: p });
    rt.registry.register({
      promptId: "trip",
      version: "1.0.0",
      fragments: [
        fragment("mission", { kind: "mission", order: 10, content: "You are a travel concierge." }),
        fragment("safety", { kind: "safety", order: 20, content: "Never invent flight numbers." }),
      ],
    });
    rt.registry.activate("trip", "1.0.0");
    return rt;
  }

  it("runs a full lifecycle and completes", async () => {
    const rt = runtime();
    const events: string[] = [];
    rt.publisher.subscribe((e) => events.push(e.type));
    const result = await rt.run({
      promptId: "trip",
      correlationId: "c-e2e",
      userInput: "Plan two nights in Lisbon.",
    });
    expect(result.content).toContain("echo:");
    expect(events).toContain("PromptRequested");
    expect(events).toContain("PromptContextBuilt");
    expect(events).toContain("PromptCompiled");
    expect(events).toContain("PromptExecuted");
    expect(events).toContain("PromptCompleted");
  });

  it("hits semantic cache on second identical run", async () => {
    const rt = runtime();
    const req = { promptId: "trip", correlationId: "c1", userInput: "Same input" };
    await rt.run(req);
    const events: string[] = [];
    rt.publisher.subscribe((e) => events.push(e.type));
    const r2 = await rt.run({ ...req, correlationId: "c2" });
    expect(r2.cached).toBe(true);
    expect(events).toContain("PromptCacheHit");
  });

  it("retries failing execution and eventually errors", async () => {
    let calls = 0;
    const rt = runtime({
      async execute() {
        calls++;
        throw new Error("provider down");
      },
    });
    await expect(rt.run({ promptId: "trip", correlationId: "c-err", userInput: "x" })).rejects.toThrow(RetryExceededError);
    expect(calls).toBe(DEFAULT_PROMPT_CONFIG.retry.maxAttempts);
  });

  it("propagates cancellation", async () => {
    const rt = runtime({
      async execute() {
        await new Promise((r) => setTimeout(r, 50));
        return { content: "late", usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }, finishReason: "stop" };
      },
    });
    const ac = new AbortController();
    const pr = rt.run({ promptId: "trip", correlationId: "c-cancel", userInput: "x", signal: ac.signal });
    ac.abort();
    await expect(pr).rejects.toThrow(CancellationError);
  });

  it("reports health", async () => {
    const rt = runtime();
    const h = await rt.health.check();
    expect(h.status === "healthy" || h.status === "degraded").toBe(true);
  });
});

// ─── benchmark (soft target) ─────────────────────────────────────────────────
describe("Prompt runtime performance (soft benchmark)", () => {
  it("compiles a small IR quickly", async () => {
    const rt = new PromptRuntime({ provider: stubProvider });
    rt.registry.register({
      promptId: "bench",
      version: "1.0.0",
      fragments: Array.from({ length: 10 }, (_, i) => fragment(`f${i}`, { content: `body ${i} `.repeat(20) })),
    });
    rt.registry.activate("bench", "1.0.0");
    const start = Date.now();
    for (let i = 0; i < 100; i++) {
      await rt.run({ promptId: "bench", correlationId: `b${i}`, userInput: `input ${i}` });
    }
    const elapsed = Date.now() - start;
    // Extremely generous ceiling — real workloads should be much faster.
    expect(elapsed).toBeLessThan(5_000);
  });
});
