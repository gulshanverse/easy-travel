/**
 * Provider Runtime — Unit, integration, routing, failover, health,
 * circuit breaker, budget, retry, concurrency, and benchmark tests.
 *
 * Uses in-memory adapters exclusively; never imports vendor SDKs.
 */
import { describe, expect, it, beforeEach } from "vitest";
import {
  ProviderRuntime,
  ModelRegistry,
  ProviderHealthManager,
  ProviderSelector,
  ProviderRouter,
  ProviderRegistry,
  InMemoryProviderEventPublisher,
  InMemoryProviderMetrics,
  NoopProviderTelemetry,
  UsageTracker,
  ExecutionPipeline,
  loadProviderConfiguration,
  createProviderAdapter,
  ProviderUnavailableError,
  ProviderRoutingError,
  ProviderBudgetError,
  ProviderCircuitOpenError,
  withRetry,
  estimateTokens,
  estimatePayloadTokens,
  computeCost,
  assertBudget,
  matchesCapabilities,
  InMemorySecretProvider,
  CredentialManager,
  newRequestId,
  newCorrelationId,
  type ProviderAdapter,
  type AdapterContext,
  type ProviderConfig,
  type ExecutionRequest,
  type ExecutionResult,
  type ModelDescriptor,
  type TokenUsage,
  type ProviderHealthSnapshot,
} from "@/lib/provider";

// ---------- In-memory test adapter ----------

interface TestAdapterOptions {
  latencyMs?: number;
  fail?: boolean;
  failN?: number;
  retryable?: boolean;
  usage?: TokenUsage;
}

class TestAdapter implements ProviderAdapter {
  private calls = 0;
  constructor(readonly config: ProviderConfig, private readonly models: ModelDescriptor[], private readonly opts: TestAdapterOptions = {}) {}
  async listModels(): Promise<readonly ModelDescriptor[]> { return this.models; }
  async ping(): Promise<ProviderHealthSnapshot> {
    return {
      providerId: this.config.id,
      state: this.opts.fail ? "unavailable" : "healthy",
      circuit: "closed", successStreak: 0, failureStreak: 0,
      lastCheckedAt: Date.now(),
    };
  }
  estimateUsage(): TokenUsage {
    return this.opts.usage ?? { inputTokens: 10, outputTokens: 20, totalTokens: 30 };
  }
  async execute<T = unknown>(model: ModelDescriptor, request: ExecutionRequest, _ctx: AdapterContext): Promise<ExecutionResult<T>> {
    this.calls += 1;
    if (this.opts.latencyMs) await new Promise((r) => setTimeout(r, this.opts.latencyMs));
    if (this.opts.fail || (this.opts.failN && this.calls <= this.opts.failN)) {
      throw new ProviderUnavailableError("test failure", { retryable: this.opts.retryable ?? true });
    }
    const usage = this.opts.usage ?? { inputTokens: 10, outputTokens: 20, totalTokens: 30 };
    return {
      requestId: request.requestId,
      correlationId: request.correlationId,
      executionId: "",
      providerId: this.config.id,
      modelId: model.id,
      output: ("ok-" + this.config.id) as unknown as T,
      usage,
      latencyMs: this.opts.latencyMs ?? 0,
      attempts: 1,
      fallbacks: 0,
      streamed: false,
    };
  }
  get callCount() { return this.calls; }
}

// ---------- helpers ----------

function makeModel(id: string, providerId: string, overrides: Partial<ModelDescriptor> = {}): ModelDescriptor {
  return {
    id, providerId, providerKind: "custom", version: "1.0",
    contextWindow: 8000,
    inputTypes: ["text"], outputTypes: ["text"],
    capabilities: {
      streaming: true, jsonOutput: true, toolCalling: true, functionCalling: true,
      vision: false, speech: false, embeddings: false,
    },
    latencyTier: "low", costTier: "cheap",
    availability: "ga", status: "active", lifecycle: "released",
    pricing: { inputPer1kTokens: 0.001, outputPer1kTokens: 0.002 },
    ...overrides,
  };
}

function makeConfig(id: string, overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    id, kind: "custom", displayName: id, enabled: true,
    weight: 1, priority: 1,
    capabilities: {
      streaming: true, jsonOutput: true, toolCalling: true, functionCalling: true,
      vision: false, speech: false, embeddings: false,
    },
    ...overrides,
  };
}

function makeRequest(overrides: Partial<ExecutionRequest> = {}): ExecutionRequest {
  return {
    requestId: newRequestId(),
    correlationId: newCorrelationId(),
    requires: { streaming: true },
    payload: { prompt: "hello world" },
    ...overrides,
  };
}

// ---------- Tests ----------

describe("provider configuration", () => {
  it("loads defaults + freezes", () => {
    const cfg = loadProviderConfiguration();
    expect(cfg.retry.maxAttempts).toBeGreaterThanOrEqual(1);
    expect(Object.isFrozen(cfg)).toBe(true);
    expect(Object.isFrozen(cfg.retry)).toBe(true);
  });
  it("rejects invalid config", () => {
    expect(() => loadProviderConfiguration({ retry: { maxAttempts: 0 } as never })).toThrow();
  });
});

describe("ids", () => {
  it("generates unique correlation ids", () => {
    const set = new Set<string>();
    for (let i = 0; i < 1000; i++) set.add(newCorrelationId());
    expect(set.size).toBe(1000);
  });
});

describe("token accounting + cost", () => {
  it("estimates tokens", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimatePayloadTokens({ x: "hello world" })).toBeGreaterThan(0);
  });
  it("computes cost from pricing", () => {
    const m = makeModel("m", "p");
    const cost = computeCost(m, { inputTokens: 1000, outputTokens: 1000, totalTokens: 2000 });
    expect(cost).toBeCloseTo(0.003);
  });
  it("asserts budget", () => {
    const m = makeModel("m", "p");
    expect(() => assertBudget(m, { inputTokens: 5, outputTokens: 5, totalTokens: 10 }, { maxTotalTokens: 5 })).toThrow(ProviderBudgetError);
    expect(() => assertBudget(m, { inputTokens: 5, outputTokens: 5, totalTokens: 10 }, { maxTotalTokens: 20 })).not.toThrow();
  });
});

describe("capabilities", () => {
  it("matches required capability flags", () => {
    const m = makeModel("m", "p");
    expect(matchesCapabilities(m, { streaming: true })).toBe(true);
    expect(matchesCapabilities(m, { vision: true })).toBe(false);
  });
});

describe("model registry", () => {
  it("registers/looks up/discovers models", () => {
    const r = new ModelRegistry();
    r.register(makeModel("a", "p1"));
    r.register(makeModel("b", "p1", { capabilities: { streaming: true, jsonOutput: false, toolCalling: false, functionCalling: false, vision: true, speech: false, embeddings: false } }));
    expect(r.size()).toBe(2);
    expect(r.require("a").id).toBe("a");
    expect(r.discover({ requires: { vision: true } })).toHaveLength(1);
    expect(r.discover({ providerId: "p1" })).toHaveLength(2);
  });
  it("validates compatibility", () => {
    const r = new ModelRegistry();
    r.register(makeModel("a", "p1"));
    expect(() => r.validateCompatibility("a", { vision: true })).toThrow();
    expect(r.validateCompatibility("a", { streaming: true }).id).toBe("a");
  });
});

describe("provider registry + factory", () => {
  it("registers a provider via factory (stub) and lists it", async () => {
    const reg = new ProviderRegistry();
    const adapter = createProviderAdapter(makeConfig("openai-x", { kind: "openai" }));
    await reg.register(adapter.config, adapter);
    expect(reg.size()).toBe(1);
    expect(reg.discover({ kind: "openai" })).toHaveLength(1);
  });
  it("rejects duplicate registrations", async () => {
    const reg = new ProviderRegistry();
    const cfg = makeConfig("p", { kind: "openai" });
    const a1 = createProviderAdapter(cfg);
    await reg.register(cfg, a1);
    await expect(reg.register(cfg, a1)).rejects.toThrow();
  });
});

describe("health + circuit breaker", () => {
  let health: ProviderHealthManager;
  beforeEach(() => {
    const cfg = loadProviderConfiguration({
      circuitBreaker: { failureThreshold: 3, successThreshold: 2, openCooldownMs: 20, halfOpenProbes: 1 },
      health: { heartbeatIntervalMs: 1000, latencyDegradedMs: 100, latencyUnavailableMs: 1000, recoveryProbeSuccesses: 2 },
    });
    health = new ProviderHealthManager(cfg.health, cfg.circuitBreaker);
  });

  it("opens circuit after failure threshold", async () => {
    for (let i = 0; i < 3; i++) await health.recordFailure("p", "boom");
    expect(health.isAvailable("p")).toBe(false);
    expect(health.snapshot("p").circuit).toBe("open");
  });

  it("half-opens after cooldown and closes after successes", async () => {
    for (let i = 0; i < 3; i++) await health.recordFailure("p", "boom");
    await new Promise((r) => setTimeout(r, 30));
    // trigger cooldown expiry
    void health.isAvailable("p");
    await health.recordSuccess("p", 10);
    await health.recordSuccess("p", 10);
    expect(health.snapshot("p").circuit).toBe("closed");
    expect(health.isAvailable("p")).toBe(true);
  });

  it("marks degraded on high latency", async () => {
    await health.recordSuccess("p", 500);
    expect(health.snapshot("p").state).toBe("degraded");
  });
});

describe("selector + router", () => {
  it("selects highest-scoring model", async () => {
    const reg = new ProviderRegistry();
    const models = new ModelRegistry();
    const cfg = loadProviderConfiguration();
    const health = new ProviderHealthManager(cfg.health, cfg.circuitBreaker);

    const cfgA = makeConfig("A", { priority: 1, weight: 1 });
    const cfgB = makeConfig("B", { priority: 10, weight: 5 });
    await reg.register(cfgA, new TestAdapter(cfgA, [makeModel("mA", "A")]));
    await reg.register(cfgB, new TestAdapter(cfgB, [makeModel("mB", "B")]));
    models.register(makeModel("mA", "A"));
    models.register(makeModel("mB", "B"));

    await health.recordSuccess("A", 10);
    await health.recordSuccess("B", 10);

    const selector = new ProviderSelector(reg, models, health);
    const candidates = selector.select(makeRequest());
    expect(candidates[0]!.providerId).toBe("B");
  });

  it("router produces primary + fallbacks", async () => {
    const reg = new ProviderRegistry();
    const models = new ModelRegistry();
    const cfg = loadProviderConfiguration();
    const health = new ProviderHealthManager(cfg.health, cfg.circuitBreaker);
    for (const id of ["A", "B", "C"]) {
      const c = makeConfig(id);
      await reg.register(c, new TestAdapter(c, [makeModel("m" + id, id)]));
      models.register(makeModel("m" + id, id));
      await health.recordSuccess(id, 10);
    }
    const selector = new ProviderSelector(reg, models, health);
    const router = new ProviderRouter(selector, cfg.fallback);
    const plan = router.plan(makeRequest());
    expect(plan.primary).toBeDefined();
    expect(plan.fallbacks.length).toBeGreaterThanOrEqual(1);
  });

  it("throws when no candidates match", async () => {
    const reg = new ProviderRegistry();
    const models = new ModelRegistry();
    const cfg = loadProviderConfiguration();
    const health = new ProviderHealthManager(cfg.health, cfg.circuitBreaker);
    const selector = new ProviderSelector(reg, models, health);
    expect(() => selector.select(makeRequest())).toThrow(ProviderRoutingError);
  });
});

describe("retry runtime", () => {
  it("retries a retryable error then succeeds", async () => {
    const cfg = loadProviderConfiguration({ retry: { maxAttempts: 3, initialDelayMs: 1, maxDelayMs: 2, multiplier: 1, jitter: false, retryBudgetMs: 500 } });
    let calls = 0;
    const outcome = await withRetry(async () => {
      calls++;
      if (calls < 3) throw new ProviderUnavailableError("nope");
      return 42;
    }, { policy: cfg.retry });
    expect(outcome.value).toBe(42);
    expect(outcome.attempts).toBe(3);
  });
  it("does not retry non-retryable errors", async () => {
    const cfg = loadProviderConfiguration();
    await expect(withRetry(async () => { throw new ProviderCircuitOpenError("open"); }, { policy: cfg.retry })).rejects.toThrow();
  });
});

describe("credentials", () => {
  it("resolves secrets via SecretProvider", async () => {
    const sp = new InMemorySecretProvider();
    sp.register({ ref: "openai", scheme: "api-key", token: "abcdefghi" });
    const mgr = new CredentialManager(sp);
    const cred = await mgr.get({ ref: "openai" });
    expect(cred.token).toBe("abcdefghi");
    await mgr.rotate("openai"); // clears cache
  });
});

describe("pipeline end-to-end", () => {
  it("routes to primary and returns result with usage/cost", async () => {
    const rt = new ProviderRuntime({ config: { retry: { maxAttempts: 1, initialDelayMs: 1, maxDelayMs: 2, multiplier: 1, jitter: false, retryBudgetMs: 100 } } });
    const cfgA = makeConfig("A");
    const modelA = makeModel("mA", "A");
    await rt.manager.registerWithAdapter(cfgA, new TestAdapter(cfgA, [modelA]));
    rt.models.register(modelA);
    await rt.health.recordSuccess("A", 5);

    const result = await rt.execute(makeRequest());
    expect(result.providerId).toBe("A");
    expect(result.usage.totalTokens).toBeGreaterThan(0);
    expect(result.usage.costEstimate).toBeGreaterThanOrEqual(0);
    expect(result.executionId).toBeTruthy();
  });

  it("fails over to next provider when primary fails", async () => {
    const rt = new ProviderRuntime({
      config: { retry: { maxAttempts: 1, initialDelayMs: 1, maxDelayMs: 2, multiplier: 1, jitter: false, retryBudgetMs: 100 } },
    });
    const cfgA = makeConfig("A", { priority: 10 });
    const cfgB = makeConfig("B", { priority: 1 });
    const modelA = makeModel("mA", "A");
    const modelB = makeModel("mB", "B");
    await rt.manager.registerWithAdapter(cfgA, new TestAdapter(cfgA, [modelA], { fail: true, retryable: true }));
    await rt.manager.registerWithAdapter(cfgB, new TestAdapter(cfgB, [modelB]));
    rt.models.register(modelA); rt.models.register(modelB);
    await rt.health.recordSuccess("A", 5); await rt.health.recordSuccess("B", 5);

    const result = await rt.execute(makeRequest());
    expect(result.providerId).toBe("B");
    expect(result.fallbacks).toBeGreaterThan(0);
  });

  it("enforces context window", async () => {
    const rt = new ProviderRuntime({ config: { retry: { maxAttempts: 1, initialDelayMs: 1, maxDelayMs: 2, multiplier: 1, jitter: false, retryBudgetMs: 100 } } });
    const cfg = makeConfig("A");
    const model = makeModel("mA", "A", { contextWindow: 5 });
    await rt.manager.registerWithAdapter(cfg, new TestAdapter(cfg, [model], { usage: { inputTokens: 100, outputTokens: 100, totalTokens: 200 } }));
    rt.models.register(model);
    await rt.health.recordSuccess("A", 5);

    await expect(rt.execute(makeRequest())).rejects.toThrow(ProviderBudgetError);
  });

  it("emits lifecycle events", async () => {
    const publisher = new InMemoryProviderEventPublisher();
    const rt = new ProviderRuntime({ publisher, config: { retry: { maxAttempts: 1, initialDelayMs: 1, maxDelayMs: 2, multiplier: 1, jitter: false, retryBudgetMs: 100 } } });
    const cfg = makeConfig("A");
    const model = makeModel("mA", "A");
    await rt.manager.registerWithAdapter(cfg, new TestAdapter(cfg, [model]));
    rt.models.register(model);
    await rt.health.recordSuccess("A", 5);

    await rt.execute(makeRequest());
    const names = publisher.snapshot().map((e) => e.name);
    expect(names).toContain("ExecutionStarted");
    expect(names).toContain("ProviderSelected");
    expect(names).toContain("ModelSelected");
    expect(names).toContain("ExecutionCompleted");
    expect(names).toContain("CostCalculated");
  });

  it("cancels via AbortSignal", async () => {
    const rt = new ProviderRuntime({ config: { retry: { maxAttempts: 1, initialDelayMs: 1, maxDelayMs: 2, multiplier: 1, jitter: false, retryBudgetMs: 100 }, execution: { defaultTimeoutMs: 500, streamingTimeoutMs: 500, maxConcurrent: 16, backpressureQueueSize: 32 } } });
    const cfg = makeConfig("A");
    const model = makeModel("mA", "A");
    await rt.manager.registerWithAdapter(cfg, new TestAdapter(cfg, [model], { latencyMs: 200 }));
    rt.models.register(model);
    await rt.health.recordSuccess("A", 5);

    const ac = new AbortController();
    setTimeout(() => ac.abort(), 20);
    await expect(rt.execute(makeRequest({ signal: ac.signal }))).rejects.toThrow();
  });
});

describe("health checks", () => {
  it("aggregates runtime health", async () => {
    const rt = new ProviderRuntime();
    const cfg = makeConfig("A");
    const model = makeModel("mA", "A");
    await rt.manager.registerWithAdapter(cfg, new TestAdapter(cfg, [model]));
    rt.models.register(model);
    await rt.health.recordSuccess("A", 5);
    const h = rt.healthChecks.check();
    expect(h.providers).toBe(1);
    expect(h.models).toBe(1);
    expect(h.ready).toBe(1);
    expect(["ok", "degraded"]).toContain(h.status);
  });
});

describe("concurrency", () => {
  it("handles parallel executions", async () => {
    const rt = new ProviderRuntime({ config: { retry: { maxAttempts: 1, initialDelayMs: 1, maxDelayMs: 2, multiplier: 1, jitter: false, retryBudgetMs: 100 } } });
    const cfg = makeConfig("A");
    const model = makeModel("mA", "A");
    await rt.manager.registerWithAdapter(cfg, new TestAdapter(cfg, [model], { latencyMs: 5 }));
    rt.models.register(model);
    await rt.health.recordSuccess("A", 5);

    const results = await Promise.all(Array.from({ length: 25 }, () => rt.execute(makeRequest())));
    expect(results).toHaveLength(25);
    for (const r of results) expect(r.providerId).toBe("A");
  });
});

describe("benchmark (smoke)", () => {
  it("completes a batch under a soft threshold", async () => {
    const rt = new ProviderRuntime({ config: { retry: { maxAttempts: 1, initialDelayMs: 1, maxDelayMs: 2, multiplier: 1, jitter: false, retryBudgetMs: 100 } } });
    const cfg = makeConfig("A");
    const model = makeModel("mA", "A");
    await rt.manager.registerWithAdapter(cfg, new TestAdapter(cfg, [model]));
    rt.models.register(model);
    await rt.health.recordSuccess("A", 5);

    const N = 50;
    const started = Date.now();
    await Promise.all(Array.from({ length: N }, () => rt.execute(makeRequest())));
    const perOpMs = (Date.now() - started) / N;
    // Soft SLO: in-memory pipeline < 25ms/op on CI.
    expect(perOpMs).toBeLessThan(50);
  });
});

describe("metrics + telemetry", () => {
  it("records execution metrics", async () => {
    const metrics = new InMemoryProviderMetrics();
    const telemetry = new NoopProviderTelemetry();
    const rt = new ProviderRuntime({ metrics, telemetry, config: { retry: { maxAttempts: 1, initialDelayMs: 1, maxDelayMs: 2, multiplier: 1, jitter: false, retryBudgetMs: 100 } } });
    const cfg = makeConfig("A");
    const model = makeModel("mA", "A");
    await rt.manager.registerWithAdapter(cfg, new TestAdapter(cfg, [model]));
    rt.models.register(model);
    await rt.health.recordSuccess("A", 5);

    await rt.execute(makeRequest());
    const snap = metrics.snapshot();
    expect(Object.keys(snap.counters).some((k) => k.startsWith("provider.execution"))).toBe(true);
    expect(Object.keys(snap.histograms).some((k) => k.startsWith("provider.latency_ms"))).toBe(true);
  });
});

describe("usage tracker", () => {
  it("aggregates per-provider and per-model", () => {
    const u = new UsageTracker();
    u.record("A", "mA", { inputTokens: 10, outputTokens: 20, totalTokens: 30, costEstimate: 0.01 });
    u.record("A", "mA", { inputTokens: 5, outputTokens: 5, totalTokens: 10, costEstimate: 0.005 });
    const s = u.snapshot();
    expect(s.totalRequests).toBe(2);
    expect(s.perProvider.A?.requests).toBe(2);
    expect(s.perModel.mA?.tokens).toBe(40);
  });
});

describe("standalone ExecutionPipeline", () => {
  it("can be constructed and run with explicit deps (dependency inversion)", async () => {
    const publisher = new InMemoryProviderEventPublisher();
    const metrics = new InMemoryProviderMetrics();
    const telemetry = new NoopProviderTelemetry();
    const providers = new ProviderRegistry(publisher);
    const models = new ModelRegistry();
    const config = loadProviderConfiguration({ retry: { maxAttempts: 1, initialDelayMs: 1, maxDelayMs: 2, multiplier: 1, jitter: false, retryBudgetMs: 100 } });
    const health = new ProviderHealthManager(config.health, config.circuitBreaker, publisher);
    const selector = new ProviderSelector(providers, models, health);
    const router = new ProviderRouter(selector, config.fallback);
    const usage = new UsageTracker();
    const pipeline = new ExecutionPipeline({ config, registry: providers, models, router, health, publisher, telemetry, metrics, usage });

    const cfg = makeConfig("A");
    const model = makeModel("mA", "A");
    await providers.register(cfg, new TestAdapter(cfg, [model]));
    models.register(model);
    await health.recordSuccess("A", 5);
    const result = await pipeline.run(makeRequest());
    expect(result.providerId).toBe("A");
  });
});
