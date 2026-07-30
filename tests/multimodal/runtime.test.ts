import { describe, expect, it } from "vitest";
import {
  createMultiModalTravelRuntime, createAllMockProviders,
  MULTIMODAL_CAPABILITY_IDS, MULTIMODAL_CONTRACTS, MULTIMODAL_CONTRACT_LIST,
  MULTIMODAL_TRAVEL_ENGINE_CONTRACT, MULTIMODAL_TRAVEL_CAPABILITY_MANIFEST,
  MULTIMODAL_CTOR_CONTRACTS, MULTIMODAL_CTOR_CAPABILITY_IDS,
  multiModalContractSource, multiModalToolDescriptors, registerMultiModalCapabilities,
  ctorCapabilityId, travelSummary,
  MULTIMODAL_WORKFLOW_BLUEPRINTS, MULTIMODAL_WORKFLOW_IDS, blueprintCapabilityIds,
  multiModalWorkflowBlueprint,
  buildTravelPresentation, makeFlightCard, makeTravelCostCard, makeTravelTimelineCard,
  TRAVEL_CARD_KINDS,
  normalizeTravelPayload,
  type MultiModalTravelRuntime,
  type NormalizedFlight, type NormalizedAirport, type NormalizedHotel,
  type NormalizedWeather, type NormalizedTransit, type NormalizedTravelSegment,
} from "@/lib/multimodal";
import { createCapabilityRuntime, makeTool } from "@/lib/ctor";
import { createWorkflowRuntime, makeWorkflowDefinition, makeWorkflowStep } from "@/lib/workflow";

async function bootRuntime(): Promise<MultiModalTravelRuntime> {
  const runtime = createMultiModalTravelRuntime();
  for (const p of createAllMockProviders()) await runtime.registerProvider(p);
  return runtime;
}

describe("MTIP — capability contracts", () => {
  it("publishes a contract for every capability id", () => {
    expect(MULTIMODAL_CONTRACT_LIST.length).toBe(MULTIMODAL_CAPABILITY_IDS.length);
    for (const id of MULTIMODAL_CAPABILITY_IDS) {
      const c = MULTIMODAL_CONTRACTS[id];
      expect(c.id).toBe(id);
      expect(c.version).toBe("1.0.0");
      expect(Object.isFrozen(c)).toBe(true);
    }
  });

  it("publishes engine contract and capability manifest", () => {
    expect(MULTIMODAL_TRAVEL_ENGINE_CONTRACT.id).toBe("multimodal.travel.platform");
    expect(MULTIMODAL_TRAVEL_CAPABILITY_MANIFEST.capabilities.length).toBe(MULTIMODAL_CAPABILITY_IDS.length);
    expect(MULTIMODAL_TRAVEL_ENGINE_CONTRACT.ownership.doesNotOwn).toContain("payments");
  });
});

describe("MTIP — CTOR capability registration", () => {
  it("exposes a CTOR contract per capability plus travel_summary", () => {
    expect(MULTIMODAL_CTOR_CONTRACTS.length).toBe(MULTIMODAL_CAPABILITY_IDS.length + 1);
    expect(MULTIMODAL_CTOR_CAPABILITY_IDS).toContain("multimodal.travel_summary");
    for (const id of ["search_flights", "search_airports", "flight_status", "search_hotels",
      "hotel_availability", "search_places", "geocode", "reverse_geocode", "route",
      "weather", "forecast_hourly", "local_transport", "currency_convert", "timezone_lookup"]) {
      expect(MULTIMODAL_CTOR_CAPABILITY_IDS).toContain(ctorCapabilityId(id));
    }
  });

  it("registers and discovers every capability in CTOR", async () => {
    const runtime = await bootRuntime();
    const ctor = createCapabilityRuntime();
    const result = await registerMultiModalCapabilities(
      {
        capabilities: ctor.manager.capabilities,
        registerTool: (tool, impl) => ctor.manager.registerTool(makeTool({
          id: tool.id, name: tool.name, version: tool.version,
          schema: { input: tool.schema.input, output: tool.schema.output },
          contract: tool.contract, tags: [...tool.metadata.tags],
          description: tool.metadata.description,
        }), impl),
      },
      runtime,
    );
    expect(result.capabilityIds.length).toBe(MULTIMODAL_CTOR_CONTRACTS.length);
    expect(result.toolIds.length).toBe(MULTIMODAL_CTOR_CONTRACTS.length);
    // runtime discovery
    const discovered = ctor.manager.capabilities.list().map((c) => c.id);
    expect(discovered).toContain(ctorCapabilityId("search_flights"));
    // metadata + version compatibility
    const cap = ctor.manager.capabilities.get(ctorCapabilityId("weather"));
    expect(cap.owner.engine).toBe("multimodal.travel.platform");
    expect(cap.contract.ports).toContain("ipcf");
    expect(ctor.manager.capabilities.isVersionCompatible(cap.id, "1.0.0")).toBe(true);
    expect(ctor.manager.capabilities.isVersionCompatible(cap.id, "^2.0.0")).toBe(false);
    runtime.shutdown();
    ctor.shutdown();
  });

  it("executes a multimodal tool through CTOR", async () => {
    const runtime = await bootRuntime();
    const ctor = createCapabilityRuntime();
    const descriptors = multiModalToolDescriptors(runtime);
    const airports = descriptors.find((d) => d.id === ctorCapabilityId("search_airports"))!;
    ctor.manager.registerTool(
      makeTool({
        id: airports.id, name: airports.name, version: airports.version,
        schema: airports.schema, contract: { idempotent: airports.idempotent, sideEffects: false },
      }),
      airports.impl,
    );
    const out = await ctor.manager.invoker.invoke(airports.id, { query: "a", limit: 3 }) as {
      ok: boolean; data: readonly NormalizedAirport[];
    };
    expect(out.ok).toBe(true);
    expect(out.data.length).toBeGreaterThan(0);
    expect(typeof out.data[0].code).toBe("string");
    runtime.shutdown();
    ctor.shutdown();
  });

  it("filters discovery by mode", async () => {
    const source = multiModalContractSource(["currency"]);
    const contracts = await source.discover();
    expect(contracts.length).toBeGreaterThan(0);
    expect(contracts.every((c) => c.features?.includes("currency"))).toBe(true);
  });
});

describe("MTIP — capability invocation through IPCF", () => {
  it("invokes one capability per mode and returns normalized data", async () => {
    const runtime = await bootRuntime();
    const flights = await runtime.invoke<readonly NormalizedFlight[]>("search_flights", {
      fromCode: (await runtime.invoke<readonly NormalizedAirport[]>("search_airports", { query: "a", limit: 2 })).data![0].code,
      toCode: (await runtime.invoke<readonly NormalizedAirport[]>("search_airports", { query: "b", limit: 2 })).data![0].code,
    });
    expect(flights.ok).toBe(true);
    const hotels = await runtime.invoke<readonly NormalizedHotel[]>("search_hotels", { limit: 3 });
    expect(hotels.ok).toBe(true);
    const weather = await runtime.invoke<NormalizedWeather>("weather", { place: "Paris" });
    expect(weather.data!.place).toBe("Paris");
    const transit = await runtime.invoke<readonly NormalizedTransit[]>("local_transport", { from: "A", to: "B" });
    expect(transit.ok).toBe(true);
    const rate = await runtime.invoke("exchange_rate", { from: "USD", to: "EUR" });
    expect(rate.ok).toBe(true);
    const tz = await runtime.invoke("timezone_lookup", { place: "Paris" });
    expect(tz.ok).toBe(true);
    const geo = await runtime.invoke("geocode", { query: "Paris" });
    expect(geo.ok).toBe(true);
    runtime.shutdown();
  });

  it("rejects missing required inputs", async () => {
    const runtime = await bootRuntime();
    await expect(runtime.invoke("flight_status", {})).rejects.toThrow(/required/);
    runtime.shutdown();
  });

  it("produces deterministic results across runtimes", async () => {
    const a = await bootRuntime();
    const b = await bootRuntime();
    const ra = await a.invoke<NormalizedWeather>("weather", { place: "Kyoto" });
    const rb = await b.invoke<NormalizedWeather>("weather", { place: "Kyoto" });
    expect(ra.data!.condition).toBe(rb.data!.condition);
    expect(ra.data!.temperatureC).toBe(rb.data!.temperatureC);
    a.shutdown(); b.shutdown();
  });

  it("aggregates a travel summary from multiple modes", async () => {
    const runtime = await bootRuntime();
    const summary = await travelSummary(runtime, {
      place: "Lisbon", homeCurrency: "USD", destinationCurrency: "EUR",
    });
    expect(summary.place).toBe("Lisbon");
    expect(summary.weather).toBeDefined();
    expect(summary.timezone).toBeDefined();
    expect(summary.currency).toBeDefined();
    runtime.shutdown();
  });

  it("normalizes raw payloads and rejects malformed ones", () => {
    expect(() => normalizeTravelPayload("search_airports", null)).toThrow();
    const ok = normalizeTravelPayload("hotel_amenities", { amenities: ["wifi"] }) as readonly string[];
    expect(ok).toEqual(["wifi"]);
  });
});

describe("MTIP — workflow blueprints", () => {
  it("ships the seven required blueprints", () => {
    expect(MULTIMODAL_WORKFLOW_BLUEPRINTS.length).toBe(7);
    expect(MULTIMODAL_WORKFLOW_IDS).toContain("multimodal.workflow.flight-monitoring");
    expect(MULTIMODAL_WORKFLOW_IDS).toContain("multimodal.workflow.travel-replanning");
    for (const b of MULTIMODAL_WORKFLOW_BLUEPRINTS) {
      expect(Object.isFrozen(b)).toBe(true);
      expect(b.steps.length).toBeGreaterThan(1);
    }
  });

  it("references only registered CTOR capability ids", () => {
    for (const b of MULTIMODAL_WORKFLOW_BLUEPRINTS) {
      for (const capId of blueprintCapabilityIds(b)) {
        expect(MULTIMODAL_CTOR_CAPABILITY_IDS).toContain(capId);
      }
    }
  });

  it("registers and executes through Workflow Runtime → CTOR → IPCF", async () => {
    const runtime = await bootRuntime();
    const ctor = createCapabilityRuntime();
    await registerMultiModalCapabilities(
      {
        capabilities: ctor.manager.capabilities,
        registerTool: (tool, impl) => ctor.manager.registerTool(makeTool({
          id: tool.id, name: tool.name, version: tool.version,
          schema: { input: tool.schema.input, output: tool.schema.output },
          contract: tool.contract,
        }), impl),
      },
      runtime,
    );

    const executed: string[] = [];
    const war = createWorkflowRuntime({
      registerBuiltins: false,
      ports: {
        ctor: {
          async healthy() { return true; },
          async invokeCapability({ capabilityId, input }) {
            executed.push(capabilityId);
            if (!capabilityId.startsWith("multimodal.")) return { ok: true };
            return ctor.manager.invoker.invoke(capabilityId, input);
          },
        },
      },
    });

    const bp = multiModalWorkflowBlueprint("multimodal.workflow.weather-monitoring")!;
    const def = makeWorkflowDefinition({
      id: bp.id, name: bp.name, version: bp.version, description: bp.description,
      triggers: [{ kind: "manual" }],
      steps: bp.steps.map((s) => makeWorkflowStep({
        id: s.id, name: s.name, kind: s.kind === "signal" ? "capability" : s.kind,
        dependsOn: [...s.dependsOn],
        capabilityId: s.capabilityId ?? "workflow.noop",
        input: { place: "Paris", lat: 48.85, lon: 2.35 },
        delayMs: 0,
      })),
    });
    war.register(def);
    const execution = await war.run(def.id, { place: "Paris" });
    expect(["completed", "failed"]).toContain(execution.status);
    expect(executed.some((c) => c.startsWith("multimodal."))).toBe(true);
    runtime.shutdown();
    ctor.shutdown();
  });
});

describe("MTIP — Journey Studio presentation models", () => {
  const flight: NormalizedFlight = Object.freeze({
    flightNumber: "XX100", carrier: "XX", fromCode: "AAA", toCode: "BBB",
    departureMinutes: 480, arrivalMinutes: 600, durationMinutes: 120, stops: 0,
    aircraft: "A320", cabins: ["economy"],
    cost: Object.freeze({ amount: 100, currency: "USD", kind: "fare", estimated: false }),
  }) as NormalizedFlight;

  const segment: NormalizedTravelSegment = Object.freeze({
    id: "seg1", mode: "flight", from: "AAA", to: "BBB",
    startAt: 1_000, endAt: 2_000,
    duration: Object.freeze({ minutes: 120, mode: "flight", confidence: 0.9 }),
    cost: Object.freeze({ amount: 100, currency: "USD", kind: "fare", estimated: false }),
    reference: "XX100",
  }) as NormalizedTravelSegment;

  it("declares the ten required card kinds", () => {
    expect(TRAVEL_CARD_KINDS.length).toBe(10);
  });

  it("builds immutable cards", () => {
    const card = makeFlightCard(flight);
    expect(card.kind).toBe("flight");
    expect(Object.isFrozen(card)).toBe(true);
    expect(() => { (card as unknown as { title: string }).title = "x"; }).toThrow();
  });

  it("totals a cost breakdown", () => {
    const card = makeTravelCostCard([
      { label: "Flight", cost: flight.cost },
      { label: "Hotel", cost: { amount: 50, currency: "USD", kind: "nightly", estimated: false } as never },
    ]);
    expect(card.data.total).toBe(150);
  });

  it("orders timeline items by start time", () => {
    const later = { ...segment, id: "seg2", startAt: 5_000, endAt: 6_000 } as NormalizedTravelSegment;
    const card = makeTravelTimelineCard([later, segment]);
    expect(card.items[0].id).toBe("tli_seg1");
    expect(card.items[1].order).toBe(1);
  });

  it("builds a full presentation set", () => {
    const cards = buildTravelPresentation({
      place: "Lisbon",
      flights: [flight],
      segments: [segment],
      weather: Object.freeze({
        place: "Lisbon", condition: "clear", temperatureC: 22, feelsLikeC: 21, humidity: 40,
        windKph: 8, windBearing: 90, visibilityM: 10_000, rainProbability: 0.1,
        airQualityIndex: 30, observedAt: 1,
      }) as NormalizedWeather,
    });
    const kinds = cards.map((c) => c.kind);
    expect(kinds).toContain("flight");
    expect(kinds).toContain("weather");
    expect(kinds).toContain("travel-segment");
    expect(kinds).toContain("travel-timeline");
    expect(kinds).toContain("travel-cost");
    expect(kinds).toContain("travel-summary");
  });
});

describe("MTIP — architecture fitness", () => {
  const files = import.meta.glob("../../src/lib/multimodal/**/*.ts", { as: "raw", eager: true }) as Record<string, string>;

  it("loads the multimodal source tree", () => {
    expect(Object.keys(files).length).toBeGreaterThan(10);
  });

  it("imports no other domain engine", () => {
    const forbidden = [
      "@/lib/ctor", "@/lib/workflow", "@/lib/journey", "@/lib/decision", "@/lib/agent",
      "@/lib/studio", "@/lib/memory", "@/lib/graph", "@/lib/prompt", "@/lib/trust",
      "@/lib/goal", "@/lib/spatial", "@/lib/railway", "@/lib/provider", "@/lib/tios",
    ];
    for (const [path, src] of Object.entries(files)) {
      for (const f of forbidden) {
        expect(`${path}:${src.includes(`from "${f}`)}`).toBe(`${path}:false`);
      }
    }
  });

  it("only reaches the outside world through IPCF", () => {
    for (const [path, src] of Object.entries(files)) {
      expect(`${path}:${/\bfetch\(|XMLHttpRequest|axios/.test(src)}`).toBe(`${path}:false`);
    }
    const runtimeSrc = files[Object.keys(files).find((k) => k.endsWith("multimodal/runtime.ts"))!];
    expect(runtimeSrc).toContain("@/lib/integration");
  });

  it("keeps providers out of non-provider modules", () => {
    for (const [path, src] of Object.entries(files)) {
      if (path.includes("/providers/") || path.endsWith("index.ts")) continue;
      expect(`${path}:${src.includes("./providers/mock-providers")}`).toBe(`${path}:false`);
    }
  });

  it("has no React or UI imports", () => {
    for (const [path, src] of Object.entries(files)) {
      expect(`${path}:${/from "react"|\.tsx"/.test(src)}`).toBe(`${path}:false`);
    }
  });
});

describe("MTIP — concurrency, stress and benchmarks", () => {
  it("handles 200 concurrent invocations", async () => {
    const runtime = await bootRuntime();
    const started = Date.now();
    const results = await Promise.all(
      Array.from({ length: 200 }, (_, i) => runtime.invoke("weather", { place: `city-${i % 25}` })),
    );
    expect(results.every((r) => r.ok)).toBe(true);
    expect(Date.now() - started).toBeLessThan(5_000);
    const snapshot = runtime.metricsSnapshot();
    expect(snapshot.requests).toBeGreaterThanOrEqual(200);
    runtime.shutdown();
  });

  it("stress-builds 2000 presentation cards", () => {
    const started = Date.now();
    const segments: NormalizedTravelSegment[] = Array.from({ length: 2_000 }, (_, i) => ({
      id: `seg${i}`, mode: "transit", from: "A", to: "B",
      startAt: i, endAt: i + 10,
      duration: { minutes: 10, mode: "transit", confidence: 0.9 },
      cost: { amount: 2, currency: "USD", kind: "fare", estimated: false },
      reference: `r${i}`,
    })) as NormalizedTravelSegment[];
    const card = makeTravelTimelineCard(segments);
    expect(card.items.length).toBe(2_000);
    expect(Date.now() - started).toBeLessThan(3_000);
  });

  it("benchmarks capability resolution", async () => {
    const runtime = await bootRuntime();
    const started = Date.now();
    for (let i = 0; i < 500; i += 1) runtime.resolver.resolve("weather");
    expect(Date.now() - started).toBeLessThan(1_000);
    runtime.shutdown();
  });
});
