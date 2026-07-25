/**
 * IPCF — Sprint I-014 test suite.
 * Unit, integration, registry, auth, normalization, webhook, polling,
 * retry, governance, concurrency, stress, and architecture fitness.
 */
import { describe, expect, it, beforeEach } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  IntegrationRuntime, createIntegrationRuntime, IntegrationRuntimeFacade,
  ConnectorRegistry, AuthenticationRegistry, RateLimiter, ConcurrencyLimiter,
  CircuitBreaker, DeadLetterQueue, EventRouter, EventNormalizer,
  WebhookRegistry, WebhookManager, PollingRegistry, PollingScheduler,
  makeCapability, makeContract, makeManifest, makeDefinition, makePolicy,
  makeRetryPolicy, makeCircuitPolicy, makeRateLimit, makeMetadata,
  makeAuthentication, makeCredentialRef, makeRequest, makeConnector,
  makeWebhookEndpoint, makePollingJob,
  normalizeResponse, withRetry, computeBackoff,
  canTransition, assertTransition, requireCapability, requireVersionCompatible,
  CONNECTOR_CATEGORIES, isKnownCategory,
  INTEGRATION_ENGINE_CONTRACT, INTEGRATION_CAPABILITY_MANIFEST,
  IntegrationValidationError, IntegrationLifecycleError, IntegrationRateLimitError,
  IntegrationCircuitOpenError, IntegrationPolicyError, IntegrationVersionError,
  IntegrationDuplicateError, IntegrationNotFoundError, IntegrationAuthenticationError,
  type ConnectorDefinition, type ConnectorExecutor,
} from "@/lib/integration";

function definition(id: string, overrides: { category?: "maps" | "flight" | "custom"; tags?: string[]; policy?: ReturnType<typeof makePolicy> } = {}): ConnectorDefinition {
  const caps = [makeCapability({ id: "search", name: "Search" }), makeCapability({ id: "detail", name: "Detail" })];
  return makeDefinition({
    manifest: makeManifest({
      id,
      name: `Connector ${id}`,
      category: overrides.category ?? "custom",
      contract: makeContract({ id: `${id}.contract`, category: overrides.category ?? "custom", capabilities: caps, authentication: ["anonymous"] }),
      capabilities: caps,
      authentication: makeAuthentication({ kind: "anonymous" }),
      metadata: makeMetadata({ tags: overrides.tags ?? ["test"] }),
    }),
    policy: overrides.policy ?? makePolicy(),
  });
}

async function enabled(rt: IntegrationRuntime, id: string) {
  await rt.manager.register(definition(id));
  rt.manager.validate(id);
  return rt.manager.enable(id);
}

describe("configuration & manifests", () => {
  it("publishes a frozen engine contract", () => {
    expect(Object.isFrozen(INTEGRATION_ENGINE_CONTRACT)).toBe(true);
    expect(INTEGRATION_ENGINE_CONTRACT.id).toBe("integration.runtime");
    expect(INTEGRATION_ENGINE_CONTRACT.adr).toEqual(["ADR-008", "ADR-009", "ADR-010"]);
    expect(INTEGRATION_ENGINE_CONTRACT.ownership.doesNotOwn).toContain("business-logic");
  });
  it("publishes a capability manifest covering all categories", () => {
    expect(INTEGRATION_CAPABILITY_MANIFEST.supportedConnectorCategories).toEqual(CONNECTOR_CATEGORIES);
    expect(INTEGRATION_CAPABILITY_MANIFEST.authenticationMethods).toContain("oauth2-pkce");
    expect(isKnownCategory("railway")).toBe(true);
    expect(isKnownCategory("nope")).toBe(false);
  });
});

describe("connector domain model", () => {
  it("creates deeply immutable connectors", () => {
    const c = makeConnector({ definition: definition("c1") });
    expect(Object.isFrozen(c)).toBe(true);
    expect(Object.isFrozen(c.definition)).toBe(true);
    expect(Object.isFrozen(c.definition.manifest.capabilities)).toBe(true);
    expect(c.status).toBe("registered");
    expect(c.history).toHaveLength(1);
  });
  it("rejects invalid manifests", async () => {
    const rt = createIntegrationRuntime();
    const bad = makeDefinition({
      manifest: makeManifest({
        id: "bad", name: "bad", category: "custom", version: "not-semver",
        contract: makeContract({ id: "x", category: "custom", capabilities: [], authentication: [] }),
        capabilities: [],
      }),
    });
    await expect(rt.manager.register(bad)).rejects.toThrow(IntegrationValidationError);
  });
  it("rejects invalid policies", () => {
    expect(() => makePolicy({ rateLimit: makeRateLimit(0) }) && null).not.toThrow();
    const rt = createIntegrationRuntime();
    const d = definition("badpol", { policy: makePolicy({ concurrency: 0 }) });
    return expect(rt.manager.register(d)).rejects.toThrow(IntegrationValidationError);
  });
});

describe("connector registry & discovery", () => {
  let reg: ConnectorRegistry;
  beforeEach(() => { reg = new ConnectorRegistry(); });

  it("registers, indexes and discovers", () => {
    reg.register(makeConnector({ definition: definition("a", { category: "maps", tags: ["geo"] }) }));
    reg.register(makeConnector({ definition: definition("b", { category: "flight", tags: ["travel"] }) }));
    expect(reg.size()).toBe(2);
    expect(reg.discover({ category: "maps" }).map(c => c.id)).toEqual(["a"]);
    expect(reg.discover({ tag: "travel" }).map(c => c.id)).toEqual(["b"]);
    expect(reg.discover({ capabilityId: "search" })).toHaveLength(2);
    expect(reg.discover({ capabilityId: "missing" })).toHaveLength(0);
  });
  it("rejects duplicates and unknown lookups", () => {
    reg.register(makeConnector({ definition: definition("a") }));
    expect(() => reg.register(makeConnector({ definition: definition("a") }))).toThrow(IntegrationDuplicateError);
    expect(() => reg.require("zzz")).toThrow(IntegrationNotFoundError);
  });
  it("validates dependencies", () => {
    const withDep = makeDefinition({
      manifest: makeManifest({
        id: "dep-consumer", name: "c", category: "custom",
        contract: makeContract({ id: "c", category: "custom", capabilities: [], authentication: [] }),
        capabilities: [makeCapability({ id: "x", name: "X" })],
        dependencies: [{ connectorId: "missing-dep" }],
      }),
    });
    const c = makeConnector({ definition: withDep });
    reg.register(c);
    expect(() => reg.validateDependencies(c)).toThrow();
  });
});

describe("connector lifecycle", () => {
  it("enforces the state machine", () => {
    expect(canTransition("registered", "validated")).toBe(true);
    expect(canTransition("registered", "enabled")).toBe(false);
    expect(canTransition("retired", "enabled")).toBe(false);
    expect(() => assertTransition("retired", "enabled")).toThrow(IntegrationLifecycleError);
  });
  it("drives register → validate → enable → disable → retire", async () => {
    const rt = createIntegrationRuntime();
    await rt.manager.register(definition("lc"));
    expect(rt.manager.validate("lc").status).toBe("validated");
    expect(rt.manager.enable("lc").status).toBe("enabled");
    expect(rt.manager.disable("lc").status).toBe("disabled");
    expect(rt.manager.retire("lc").status).toBe("retired");
    const names = rt.events.history().map(e => e.name);
    expect(names).toContain("ConnectorRegistered");
    expect(names).toContain("ConnectorValidated");
    expect(names).toContain("ConnectorEnabled");
    expect(names).toContain("ConnectorRetired");
  });
});

describe("authentication abstractions", () => {
  it("builds credential references without storing secrets", () => {
    const ref = makeCredentialRef({ ref: "secret://maps-key", kind: "api-key", scopes: ["read"] });
    expect(ref.ref).toBe("secret://maps-key");
    expect(Object.isFrozen(ref)).toBe(true);
    expect(JSON.stringify(ref)).not.toContain("value");
  });
  it("requires a credential ref for non-anonymous kinds", () => {
    expect(() => makeAuthentication({ kind: "oauth2" })).toThrow(IntegrationAuthenticationError);
    expect(makeAuthentication({ kind: "anonymous" }).kind).toBe("anonymous");
  });
  it("applies registered hooks and falls back deterministically", async () => {
    const reg = new AuthenticationRegistry();
    const auth = makeAuthentication({ kind: "bearer", credentialRef: makeCredentialRef({ ref: "secret://tok", kind: "bearer" }) });
    const fallback = await reg.apply(auth, { connectorId: "c", at: 0 });
    expect(fallback.headers["x-connector-auth-kind"]).toBe("bearer");

    reg.registerHook({
      kind: "bearer",
      async apply() {
        return { kind: "bearer", headers: Object.freeze({ authorization: "Bearer <ref>" }), query: Object.freeze({}), metadata: Object.freeze({}) };
      },
    });
    const applied = await reg.apply(auth, { connectorId: "c", at: 0 });
    expect(applied.headers.authorization).toBe("Bearer <ref>");
  });
  it("supports all ten authentication kinds in the manifest", () => {
    expect(INTEGRATION_CAPABILITY_MANIFEST.authenticationMethods).toHaveLength(10);
  });
});

describe("request pipeline & normalization", () => {
  it("runs the full pipeline with the stub executor", async () => {
    const rt = createIntegrationRuntime();
    await enabled(rt, "p1");
    const res = await rt.manager.invoke(makeRequest({ connectorId: "p1", capabilityId: "search", payload: { q: "x" } }));
    expect(res.ok).toBe(true);
    expect(res.metadata.connectorId).toBe("p1");
    expect(res.diagnostics.attempts).toBe(1);
    expect(Object.isFrozen(res)).toBe(true);
  });
  it("applies request and response transformations", async () => {
    const rt = createIntegrationRuntime();
    const base = definition("t1");
    const withT = makeDefinition({ manifest: base.manifest, policy: base.policy, transformation: { requestName: "rq", responseName: "rs" } });
    await rt.manager.register(withT);
    rt.manager.validate("t1"); rt.manager.enable("t1");
    rt.hooks.requestTransformers.set("rq", (req) => ({ ...req, metadata: { transformed: true } }));
    rt.hooks.responseTransformers.set("rs", (raw) => ({ ...raw, data: { wrapped: true } }));
    const res = await rt.manager.invoke(makeRequest({ connectorId: "t1", capabilityId: "search", payload: {} }));
    expect(res.data).toEqual({ wrapped: true });
    expect(res.diagnostics.transformationApplied).toBe(true);
  });
  it("rejects unadvertised capabilities and mismatched connector ids", async () => {
    const rt = createIntegrationRuntime();
    await enabled(rt, "p2");
    await expect(rt.manager.invoke(makeRequest({ connectorId: "p2", capabilityId: "nope", payload: {} }))).rejects.toThrow(IntegrationPolicyError);
  });
  it("normalizes error results deterministically", () => {
    const req = makeRequest({ connectorId: "c", capabilityId: "k", payload: {} });
    const res = normalizeResponse({ ok: false, error: { code: "boom", message: "bad", retryable: true } }, {
      request: req, connectorVersion: "1.0.0", latencyMs: 5, attempts: 2,
      circuitState: "closed", transformationApplied: false,
    });
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("boom");
    expect(res.diagnostics.retried).toBe(true);
  });
  it("propagates pagination and rate-limit metadata", async () => {
    const executor: ConnectorExecutor = async () => ({
      ok: true, data: [1, 2],
      pagination: { page: 1, pageSize: 2, hasMore: true },
      rateLimit: { limit: 100, remaining: 99 },
    });
    const rt = createIntegrationRuntime({ defaultExecutor: executor });
    await enabled(rt, "p3");
    const res = await rt.manager.invoke(makeRequest({ connectorId: "p3", capabilityId: "search", payload: {} }));
    expect(res.pagination?.hasMore).toBe(true);
    expect(res.rateLimit?.remaining).toBe(99);
  });
});

describe("governance", () => {
  it("enforces rate limits", () => {
    const rl = new RateLimiter();
    const policy = makePolicy({ rateLimit: makeRateLimit(2) });
    rl.check("c", policy); rl.check("c", policy);
    expect(() => rl.check("c", policy)).toThrow(IntegrationRateLimitError);
  });
  it("enforces concurrency limits", () => {
    const cl = new ConcurrencyLimiter();
    const policy = makePolicy({ concurrency: 1 });
    cl.acquire("c", policy);
    expect(() => cl.acquire("c", policy)).toThrow(IntegrationPolicyError);
    cl.release("c");
    expect(() => cl.acquire("c", policy)).not.toThrow();
  });
  it("opens, half-opens and closes the circuit", () => {
    const cb = new CircuitBreaker();
    const policy = makePolicy({ circuit: makeCircuitPolicy({ failureThreshold: 2, openCooldownMs: 10 }) });
    cb.recordFailure("c", policy);
    cb.recordFailure("c", policy, 1000);
    expect(cb.snapshot("c").state).toBe("open");
    expect(() => cb.ensureClosed("c", policy, 1001)).toThrow(IntegrationCircuitOpenError);
    expect(cb.ensureClosed("c", policy, 1100).state).toBe("half-open");
    cb.recordSuccess("c");
    expect(cb.snapshot("c").state).toBe("closed");
  });
  it("validates capability and version compatibility", () => {
    const c = makeConnector({ definition: definition("g1") });
    expect(requireCapability(c, "search").id).toBe("search");
    expect(() => requireCapability(c, "ghost")).toThrow(IntegrationPolicyError);
    expect(() => requireVersionCompatible("1.0.0", "2.0.0")).toThrow(IntegrationVersionError);
    expect(() => requireVersionCompatible("2.1.0", "2.0.0", "3.0.0")).not.toThrow();
  });
  it("rate-limits through the runtime pipeline", async () => {
    const rt = createIntegrationRuntime();
    const d = definition("rlx", { policy: makePolicy({ rateLimit: makeRateLimit(1) }) });
    await rt.manager.register(d); rt.manager.validate("rlx"); rt.manager.enable("rlx");
    await rt.manager.invoke(makeRequest({ connectorId: "rlx", capabilityId: "search", payload: {} }));
    await expect(rt.manager.invoke(makeRequest({ connectorId: "rlx", capabilityId: "search", payload: {} }))).rejects.toThrow(IntegrationRateLimitError);
  });
});

describe("retry runtime", () => {
  it("retries then succeeds", async () => {
    let calls = 0;
    const out = await withRetry(async () => {
      calls++;
      if (calls < 3) throw new Error("transient");
      return "ok";
    }, { policy: makeRetryPolicy({ maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 2, jitter: false }), sleep: async () => {} });
    expect(out.value).toBe("ok");
    expect(out.attempts).toBe(3);
  });
  it("respects non-retryable predicate", async () => {
    await expect(withRetry(async () => { throw new Error("fatal"); }, {
      policy: makeRetryPolicy({ maxAttempts: 5, baseDelayMs: 1, maxDelayMs: 2, jitter: false }),
      isRetryable: () => false, sleep: async () => {},
    })).rejects.toThrow("fatal");
  });
  it("computes bounded exponential backoff", () => {
    const p = makeRetryPolicy({ baseDelayMs: 100, maxDelayMs: 400, jitter: false });
    expect(computeBackoff(p, 1)).toBe(100);
    expect(computeBackoff(p, 2)).toBe(200);
    expect(computeBackoff(p, 9)).toBe(400);
  });
});

describe("webhook runtime", () => {
  it("registers and receives normalized deliveries", () => {
    const reg = new WebhookRegistry();
    const mgr = new WebhookManager(reg);
    reg.register(makeWebhookEndpoint({ connectorId: "c1", path: "/hooks/c1" }));
    const d = mgr.receive({ path: "/hooks/c1", payload: { event: "ping" }, headers: { "x-sig": "abc" } });
    expect(d.ok).toBe(true);
    expect(d.normalized?.kind).toBe("webhook");
    expect(mgr.history()).toHaveLength(1);
  });
  it("fails unknown or disabled paths", () => {
    const reg = new WebhookRegistry();
    const mgr = new WebhookManager(reg);
    expect(mgr.receive({ path: "/nope", payload: {} }).ok).toBe(false);
    reg.register(makeWebhookEndpoint({ connectorId: "c", path: "/off", enabled: false }));
    expect(mgr.receive({ path: "/off", payload: {} }).ok).toBe(false);
  });
  it("rejects duplicate paths", () => {
    const reg = new WebhookRegistry();
    reg.register(makeWebhookEndpoint({ connectorId: "c", path: "/dup" }));
    expect(() => reg.register(makeWebhookEndpoint({ connectorId: "c", path: "/dup" }))).toThrow(IntegrationValidationError);
  });
});

describe("polling runtime", () => {
  it("schedules deterministically", () => {
    const reg = new PollingRegistry();
    const sch = new PollingScheduler(reg, 100);
    const job = makePollingJob({ connectorId: "c", capabilityId: "search", intervalMs: 1000 });
    reg.register(job);
    expect(sch.due(job.nextRunAt - 1)).toHaveLength(0);
    expect(sch.due(job.nextRunAt)).toHaveLength(1);
    const ran = sch.markRun(job.id, job.nextRunAt);
    expect(ran.runs).toBe(1);
    expect(ran.nextRunAt).toBe(job.nextRunAt + 1000);
    expect(sch.disable(job.id).enabled).toBe(false);
    expect(sch.due(Number.MAX_SAFE_INTEGER)).toHaveLength(0);
    expect(sch.enable(job.id).enabled).toBe(true);
  });
  it("rejects intervals below the floor", () => {
    const reg = new PollingRegistry();
    const sch = new PollingScheduler(reg, 500);
    const job = makePollingJob({ connectorId: "c", capabilityId: "k", intervalMs: 100 });
    reg.register(job);
    expect(() => sch.markRun(job.id)).toThrow(IntegrationValidationError);
  });
});

describe("event runtime", () => {
  it("normalizes and routes events", async () => {
    const norm = new EventNormalizer();
    const router = new EventRouter();
    const seen: string[] = [];
    router.on("webhook", e => { seen.push(`w:${e.connectorId}`); });
    router.on("*", e => { seen.push(`*:${e.kind}`); });
    await router.route(norm.normalize({ connectorId: "c", kind: "webhook", payload: {} }));
    expect(seen).toEqual(["w:c", "*:webhook"]);
  });
  it("queues dead letters with a bounded buffer", () => {
    const dlq = new DeadLetterQueue(2);
    for (let i = 0; i < 5; i++) dlq.enqueue({ connectorId: "c", kind: "request", attempts: 3, reason: "fail", payload: i });
    expect(dlq.size()).toBe(2);
    expect(dlq.drain()).toHaveLength(2);
    expect(dlq.size()).toBe(0);
  });
});

describe("observability & health", () => {
  it("records metrics across the pipeline", async () => {
    const rt = createIntegrationRuntime();
    await enabled(rt, "m1");
    await rt.manager.invoke(makeRequest({ connectorId: "m1", capabilityId: "search", payload: {} }));
    const s = rt.metricsSnapshot();
    expect(s.connectors.registered).toBe(1);
    expect(s.invocations.total).toBe(1);
    expect(s.invocations.ok).toBe(1);
    expect(s.normalizations.response).toBe(1);
    expect(Object.isFrozen(s)).toBe(true);
  });
  it("reports health across all ports", async () => {
    const rt = createIntegrationRuntime();
    await enabled(rt, "h1");
    const h = await rt.health();
    expect(h.status).toBe("healthy");
    expect(h.counts.connectors).toBe(1);
    expect(Object.keys(h.checks)).toEqual(expect.arrayContaining(["kernel", "agent", "ctor", "provider", "registry"]));
  });
  it("emits events with correlation, causation, timestamp and version", async () => {
    const rt = createIntegrationRuntime();
    await enabled(rt, "e1");
    await rt.manager.invoke(makeRequest({ connectorId: "e1", capabilityId: "search", payload: {} }));
    const evt = rt.events.filter("ConnectorInvoked")[0]!;
    expect(evt.correlationId).toBeTruthy();
    expect(evt.causationId).toBeTruthy();
    expect(evt.version).toBe(1);
    expect(evt.timestamp).toBeGreaterThan(0);
    expect(Object.isFrozen(evt)).toBe(true);
  });
});

describe("cross-platform ports", () => {
  it("advertises capabilities to CTOR and notifies the Agent Runtime", async () => {
    const advertised: string[] = [];
    const notified: string[] = [];
    const rt = createIntegrationRuntime({
      ctor: {
        async healthy() { return true; },
        async advertiseCapability(i) { advertised.push(`${i.connectorId}:${i.capabilityId}`); },
        async withdrawCapability() {},
      },
      agent: {
        async healthy() { return true; },
        async notifyConnectorEvent(e) { notified.push(e.kind); },
      },
    });
    await enabled(rt, "x1");
    await rt.manager.invoke(makeRequest({ connectorId: "x1", capabilityId: "search", payload: {} }));
    expect(advertised).toEqual(["x1:search", "x1:detail"]);
    expect(notified).toEqual(["invoked"]);
  });
});

describe("concurrency", () => {
  it("handles 50 parallel invocations", async () => {
    const rt = createIntegrationRuntime();
    const d = definition("cc", { policy: makePolicy({ concurrency: 64, rateLimit: makeRateLimit(10_000) }) });
    await rt.manager.register(d); rt.manager.validate("cc"); rt.manager.enable("cc");
    const results = await Promise.all(Array.from({ length: 50 }, () =>
      rt.manager.invoke(makeRequest({ connectorId: "cc", capabilityId: "search", payload: {} }))));
    expect(results).toHaveLength(50);
    expect(results.every(r => r.ok)).toBe(true);
  });
});

describe("stress & benchmarks", () => {
  it("registers 500 connectors in under 2s", async () => {
    const rt = createIntegrationRuntime();
    const started = Date.now();
    for (let i = 0; i < 500; i++) await rt.manager.register(definition(`s${i}`));
    expect(rt.registry.size()).toBe(500);
    expect(Date.now() - started).toBeLessThan(2000);
  });
  it("executes 1000 pipeline invocations in under 3s", async () => {
    const rt = createIntegrationRuntime();
    const d = definition("bench", { policy: makePolicy({ concurrency: 256, rateLimit: makeRateLimit(100_000) }) });
    await rt.manager.register(d); rt.manager.validate("bench"); rt.manager.enable("bench");
    const started = Date.now();
    for (let i = 0; i < 1000; i++) {
      await rt.manager.invoke(makeRequest({ connectorId: "bench", capabilityId: "search", payload: { i } }));
    }
    const elapsed = Date.now() - started;
    expect(elapsed).toBeLessThan(3000);
    expect(rt.metricsSnapshot().invocations.total).toBe(1000);
  });
  it("handles 2000 webhook deliveries within the bounded buffer", () => {
    const reg = new WebhookRegistry();
    const mgr = new WebhookManager(reg, 512);
    reg.register(makeWebhookEndpoint({ connectorId: "c", path: "/bulk" }));
    const started = Date.now();
    for (let i = 0; i < 2000; i++) mgr.receive({ path: "/bulk", payload: { i } });
    expect(mgr.history()).toHaveLength(512);
    expect(Date.now() - started).toBeLessThan(2000);
  });
});

describe("architecture fitness", () => {
  const dir = join(process.cwd(), "src/lib/integration");
  const files = readdirSync(dir).filter(f => f.endsWith(".ts"));
  const sources = files.map(f => ({ f, src: readFileSync(join(dir, f), "utf8") }));

  it("never imports forbidden domain engines", () => {
    const banned = ["memory", "journey", "decision", "trust", "goal", "spatial", "studio", "graph", "prompt"];
    for (const { f, src } of sources) {
      for (const b of banned) {
        expect(src.includes(`@/lib/${b}`), `${f} imports @/lib/${b}`).toBe(false);
      }
    }
  });
  it("makes no direct external calls and imports no external SDKs", () => {
    for (const { f, src } of sources) {
      expect(/\bfetch\s*\(/.test(src), `${f} calls fetch`).toBe(false);
      expect(src.includes("XMLHttpRequest"), `${f} uses XHR`).toBe(false);
      expect(src.includes("node:http"), `${f} uses node:http`).toBe(false);
      expect(src.includes("axios"), `${f} uses axios`).toBe(false);
      expect(src.includes("supabase"), `${f} uses supabase`).toBe(false);
    }
  });
  it("contains no provider-specific implementations", () => {
    const providers = ["irctc", "mapbox", "openstreetmap", "googlemaps", "stripe", "twilio", "sendgrid", "amadeus"];
    for (const { f, src } of sources) {
      const lower = src.toLowerCase();
      for (const p of providers) {
        expect(lower.includes(p), `${f} references provider ${p}`).toBe(false);
      }
    }
  });
  it("only depends on Runtime/Agent/CTOR/Provider ports", () => {
    const ports = readFileSync(join(dir, "ports.ts"), "utf8");
    for (const p of ["IntegrationKernelPort", "IntegrationAgentPort", "IntegrationCtorPort", "IntegrationProviderPort"]) {
      expect(ports).toContain(p);
    }
  });
  it("exposes a stable public surface via index.ts", () => {
    const index = readFileSync(join(dir, "index.ts"), "utf8");
    for (const f of files) {
      if (f === "index.ts") continue;
      expect(index, `index.ts does not export ./${f}`).toContain(`./${f.replace(/\.ts$/, "")}`);
    }
    expect(IntegrationRuntimeFacade).toBe(IntegrationRuntime);
  });
});
