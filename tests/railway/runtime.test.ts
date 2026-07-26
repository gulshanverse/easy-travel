import { describe, it, expect, beforeEach } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createRailwayConnectorRuntime, createMockRailProvider,
  createNationalEnquiryProvider, createNationalReservationProvider,
  InternationalRailProvider, InMemoryRailwayTelemetry,
  RAILWAY_CAPABILITY_IDS, RAILWAY_CONTRACTS, RAILWAY_CONTRACT_LIST,
  RAILWAY_CONNECTOR_ENGINE_CONTRACT, RAILWAY_CONNECTOR_CAPABILITY_MANIFEST,
  normalizeRailwayPayload, mockDataset, MOCK_STATION_COUNT, MOCK_TRAIN_COUNT,
  RailwayValidationError, RailwayResolutionError,
  type NormalizedStation, type NormalizedTrain, type NormalizedSchedule,
  type NormalizedPNR, type NormalizedLiveStatus, type NormalizedJourney,
  type NormalizedFare, type NormalizedSeatAvailability, type NormalizedAlert,
} from "@/lib/railway";

async function suite(opts: Parameters<typeof createMockRailProvider>[0] = {}) {
  const telemetry = new InMemoryRailwayTelemetry();
  const rt = createRailwayConnectorRuntime({ telemetry });
  const mock = createMockRailProvider(opts);
  await rt.registerProvider(mock, 10);
  return { rt, mock, telemetry };
}

const firstTrain = () => mockDataset().trains[0];

describe("mock provider dataset", () => {
  it("provides 1000+ stations and 500+ trains deterministically", () => {
    const a = mockDataset();
    const b = mockDataset();
    expect(a.stations.length).toBeGreaterThanOrEqual(1000);
    expect(a.trains.length).toBeGreaterThanOrEqual(500);
    expect(MOCK_STATION_COUNT).toBe(a.stations.length);
    expect(MOCK_TRAIN_COUNT).toBe(b.trains.length);
    expect(a.stations[42]).toBe(b.stations[42]);
  });
  it("gives every train an ordered schedule with growing distance", () => {
    for (const t of mockDataset().trains.slice(0, 25)) {
      expect(t.stops.length).toBeGreaterThanOrEqual(5);
      for (let i = 1; i < t.stops.length; i += 1) {
        expect(t.stops[i].distanceKm).toBeGreaterThan(t.stops[i - 1].distanceKm);
        expect(t.stops[i].seq).toBe(t.stops[i - 1].seq + 1);
      }
    }
  });
});

describe("contracts", () => {
  it("publishes 18+ provider-independent contracts", () => {
    expect(RAILWAY_CAPABILITY_IDS.length).toBeGreaterThanOrEqual(18);
    expect(RAILWAY_CONTRACT_LIST.length).toBe(RAILWAY_CAPABILITY_IDS.length);
    for (const c of RAILWAY_CONTRACT_LIST) {
      expect(c.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(Object.isFrozen(c)).toBe(true);
      expect(c.output.startsWith("Normalized")).toBe(true);
    }
  });
  it("contracts name no provider", () => {
    const text = JSON.stringify(RAILWAY_CONTRACTS).toLowerCase();
    for (const p of ["irctc", "ntes", "railmadad", "amadeus", "sabre"]) {
      expect(text.includes(p)).toBe(false);
    }
  });
});

describe("registry and capability discovery", () => {
  it("registers connectors and exposes discoverable capabilities", async () => {
    const { rt } = await suite();
    expect(rt.registry.size()).toBe(1);
    const caps = rt.discoverCapabilities();
    expect(caps.length).toBe(RAILWAY_CAPABILITY_IDS.length);
    expect(caps.every((c) => c.providers.includes("mock-rail"))).toBe(true);
    expect(rt.integration.registry.discover({ category: "railway" }).length).toBe(1);
  });
  it("rejects duplicate registration", async () => {
    const { rt } = await suite();
    await expect(rt.registerProvider(createMockRailProvider())).rejects.toBeTruthy();
  });
  it("orders resolution by priority with the preferred provider first", async () => {
    const { rt } = await suite();
    await rt.registerProvider(createNationalEnquiryProvider(), 1);
    const records = rt.resolver.resolve("live_status");
    expect(records[0].adapter.profile.id).toBe("mock-rail");
    expect(rt.resolver.resolve("live_status", "national-enquiry")[0].adapter.profile.id).toBe("national-enquiry");
  });
});

describe("agent → CTOR → IPCF → railway connector", () => {
  it("advertises every capability to CTOR through IPCF", async () => {
    const advertised: string[] = [];
    const notified: string[] = [];
    const { createIntegrationRuntime } = await import("@/lib/integration");
    const integration = createIntegrationRuntime({
      ctor: {
        async healthy() { return true; },
        async advertiseCapability(i) { advertised.push(i.capabilityId); },
        async withdrawCapability() { /* noop */ },
      },
      agent: {
        async healthy() { return true; },
        async notifyConnectorEvent(e) { notified.push(e.kind); },
      },
    });
    const rt = createRailwayConnectorRuntime({ integration });
    await rt.registerProvider(createMockRailProvider());
    expect(new Set(advertised).size).toBe(RAILWAY_CAPABILITY_IDS.length);
    await rt.invoke("search_station", { query: "Nor" });
    expect(notified).toContain("invoked");
  });
});

describe("capability invocation and normalization", () => {
  let rt: Awaited<ReturnType<typeof suite>>["rt"];
  beforeEach(async () => { rt = (await suite()).rt; });

  it("search_station returns normalized stations", async () => {
    const res = await rt.invoke<readonly NormalizedStation[]>("search_station", { query: "Nor", limit: 5 });
    expect(res.ok).toBe(true);
    expect(res.data!.length).toBe(5);
    const st = res.data![0];
    expect(st.code).toMatch(/^S/);
    expect(typeof st.coordinates.latitude).toBe("number");
    expect(Object.isFrozen(st)).toBe(true);
    expect(JSON.stringify(st)).not.toContain("stn_code");
  });

  it("search_train, schedule and route stay consistent", async () => {
    const t = firstTrain();
    const trains = await rt.invoke<readonly NormalizedTrain[]>("search_train", {
      fromCode: t.stops[0].stationCode, toCode: t.stops[t.stops.length - 1].stationCode,
    });
    expect(trains.ok).toBe(true);
    expect(trains.data!.length).toBeGreaterThan(0);

    const sched = await rt.invoke<NormalizedSchedule>("train_schedule", { trainNumber: t.number });
    expect(sched.data!.stops.length).toBe(t.stops.length);
    expect(sched.data!.stops[0].arrival).toBeUndefined();

    const route = await rt.invoke<{ totalDistanceKm: number; legs: unknown[] }>("route_lookup", { trainNumber: t.number });
    expect(route.data!.legs.length).toBe(t.stops.length - 1);
    expect(route.data!.totalDistanceKm).toBeGreaterThan(0);
  });

  it("plans journeys between two stations", async () => {
    const t = firstTrain();
    const res = await rt.invoke<readonly NormalizedJourney[]>("plan_route", {
      fromCode: t.stops[0].stationCode,
      toCode: t.stops[2].stationCode,
      date: "2026-03-01",
    });
    expect(res.ok).toBe(true);
    expect(res.data!.length).toBeGreaterThan(0);
    expect(res.data![0].segments[0].trainNumber).toBeTruthy();
    expect(res.data![0].transfers).toBe(0);
  });

  it("returns fares, availability, coach layout and platform data", async () => {
    const t = firstTrain();
    const fare = await rt.invoke<NormalizedFare>("fare_information", { trainNumber: t.number });
    expect(fare.data!.totalMinor).toBeGreaterThan(0);
    expect(fare.data!.components.length).toBe(4);

    const avl = await rt.invoke<NormalizedSeatAvailability>("seat_availability", { trainNumber: t.number, date: "2026-03-01" });
    expect(["available", "waitlist", "regret", "unknown"]).toContain(avl.data!.status);
    expect(avl.data!.confirmationProbability).toBeLessThanOrEqual(1);

    const coach = await rt.invoke<{ seats: unknown[] }>("coach_layout", { trainNumber: t.number, coach: "B2" });
    expect(coach.data!.seats.length).toBe(64);

    const pf = await rt.invoke<{ platform: string }>("platform_information", {
      trainNumber: t.number, stationCode: t.stops[1].stationCode,
    });
    expect(pf.data!.platform).toBeTruthy();
  });

  it("returns PNR, history, live status, alerts, delays, cancellations and diversions", async () => {
    const t = firstTrain();
    const pnr = await rt.invoke<NormalizedPNR>("check_pnr", { pnr: "1234567890" });
    expect(pnr.data!.passengers.length).toBeGreaterThan(0);

    const hist = await rt.invoke<{ entries: unknown[] }>("journey_history", { reference: "trav-1", limit: 3 });
    expect(hist.data!.entries.length).toBe(3);

    const live = await rt.invoke<NormalizedLiveStatus>("live_status", { trainNumber: t.number, date: "2026-03-01" });
    expect(live.data!.positionPercent).toBeGreaterThan(0);

    const alerts = await rt.invoke<readonly NormalizedAlert[]>("service_alerts", { scope: "station", reference: "S000" });
    expect(alerts.data!.every((a) => ["info", "warning", "critical"].includes(a.severity))).toBe(true);

    for (const cap of ["delay_information", "cancellation_information", "diversion_information"] as const) {
      const r = await rt.invoke(cap, { trainNumber: t.number, date: "2026-03-01" });
      expect(r.ok).toBe(true);
    }
  });

  it("is deterministic across calls", async () => {
    const a = await rt.invoke("live_status", { trainNumber: firstTrain().number, date: "2026-03-01" });
    const b = await rt.invoke("live_status", { trainNumber: firstTrain().number, date: "2026-03-01" });
    expect(a.data).toEqual(b.data);
  });

  it("rejects malformed provider payloads during normalization", () => {
    expect(() => normalizeRailwayPayload("train_schedule", { train_no: "1", schedule: "nope" })).toThrow();
  });
});

describe("error, retry and fallback behaviour", () => {
  it("validates required contract inputs before touching IPCF", async () => {
    const { rt } = await suite();
    await expect(rt.invoke("check_pnr", {})).rejects.toBeInstanceOf(RailwayValidationError);
  });
  it("surfaces provider errors as normalized failures", async () => {
    const { rt } = await suite({ failCapabilities: ["live_status"] });
    const res = await rt.invoke("live_status", { trainNumber: firstTrain().number });
    expect(res.ok).toBe(false);
    expect(res.error!.code).toBe("provider_error");
  });
  it("surfaces retryable transient failures and recovers on a later attempt", async () => {
    const { rt, mock } = await suite({ transientFailures: 1 });
    const first = await rt.invoke("search_station", { query: "Nor" });
    const second = await rt.invoke("search_station", { query: "Nor" });
    expect(second.ok).toBe(true);
    expect(mock.attemptCount).toBeGreaterThanOrEqual(2);
    expect(first.ok || second.ok).toBe(true);
  });
  it("falls back to another connector when the preferred one fails", async () => {
    const { rt } = await suite({ failCapabilities: ["service_alerts"] });
    await rt.registerProvider(createMockRailProvider({ id: "mock-rail-2" }), 5); // healthy secondary
    const res = await rt.invoke("service_alerts", { scope: "network" });
    expect(res.ok).toBe(true);
    expect(rt.metricsSnapshot().fallbacks).toBe(1);
  });
  it("stub providers fail closed and never execute", async () => {
    const { createIntegrationRuntime } = await import("@/lib/integration");
    const rt = createRailwayConnectorRuntime({ integration: createIntegrationRuntime() });
    await rt.registerProvider(createNationalReservationProvider());
    const res = await rt.invoke("check_pnr", { pnr: "1234567890" }).catch((e) => e);
    expect(res.ok === false || res instanceof Error).toBe(true);
  });
  it("throws when no connector provides a capability", async () => {
    const { createIntegrationRuntime } = await import("@/lib/integration");
    const rt = createRailwayConnectorRuntime({ integration: createIntegrationRuntime() });
    await rt.registerProvider(new InternationalRailProvider("eu-rail", "EU Rail", "EU", ["search_station"]));
    await expect(rt.invoke("check_pnr", { pnr: "1234567890" })).rejects.toBeInstanceOf(RailwayResolutionError);
  });
});

describe("observability", () => {
  it("records request, response, normalization and latency metrics", async () => {
    const { rt, telemetry } = await suite();
    await rt.invoke("search_station", { query: "Nor" });
    await rt.invoke("train_metadata", { trainNumber: firstTrain().number });
    const m = rt.metricsSnapshot();
    expect(m.connectorsRegistered).toBe(1);
    expect(m.requests).toBe(2);
    expect(m.responsesOk).toBe(2);
    expect(m.normalizations).toBe(2);
    expect(m.normalizationFailures).toBe(0);
    expect(m.latency.count).toBe(2);
    expect(m.byProvider["mock-rail"].successes).toBe(2);
    expect(m.byCapability.search_station.requests).toBe(1);
    expect(telemetry.records.some((r) => r.event === "railway.invoke")).toBe(true);
  });
  it("reports health across connectors and IPCF", async () => {
    const { rt } = await suite();
    await rt.registerProvider(createNationalEnquiryProvider());
    const report = await rt.healthReport();
    expect(report.healthy).toBe(true);
    expect(report.integrationHealthy).toBe(true);
    expect(report.connectors.find((c) => c.providerId === "mock-rail")!.healthy).toBe(true);
    expect(report.connectors.find((c) => c.providerId === "national-enquiry")!.healthy).toBe(false);
    expect(report.capabilities.length).toBe(RAILWAY_CAPABILITY_IDS.length);
  });
});

describe("manifest and engine contract", () => {
  it("publishes a frozen engine contract and capability manifest", () => {
    expect(Object.isFrozen(RAILWAY_CONNECTOR_ENGINE_CONTRACT)).toBe(true);
    expect(Object.isFrozen(RAILWAY_CONNECTOR_CAPABILITY_MANIFEST)).toBe(true);
    expect(RAILWAY_CONNECTOR_ENGINE_CONTRACT.dependencies.frozenEngines).toEqual(["integration.runtime"]);
    expect(RAILWAY_CONNECTOR_CAPABILITY_MANIFEST.capabilities.length).toBe(RAILWAY_CAPABILITY_IDS.length);
    expect(RAILWAY_CONNECTOR_ENGINE_CONTRACT.adr).toContain("ADR-011");
    expect(RAILWAY_CONNECTOR_ENGINE_CONTRACT.adr).toContain("ADR-012");
  });
});

describe("stress and performance", () => {
  it("handles 200 parallel invocations", async () => {
    const { rt } = await suite();
    const started = Date.now();
    const results = await Promise.all(
      Array.from({ length: 200 }, (_, i) => rt.invoke("search_station", { query: `Nor`, limit: 1 + (i % 5) })),
    );
    expect(results.every((r) => r.ok)).toBe(true);
    expect(Date.now() - started).toBeLessThan(5000);
  });
  it("normalizes 1000 schedules in under 3s", async () => {
    const { rt } = await suite();
    const started = Date.now();
    const trains = mockDataset().trains.slice(0, 1000);
    for (const t of trains) {
      const r = await rt.invoke<NormalizedSchedule>("train_schedule", { trainNumber: t.number });
      expect(r.ok).toBe(true);
    }
    expect(Date.now() - started).toBeLessThan(3000);
  });
});

describe("architecture fitness", () => {
  const dir = join(process.cwd(), "src/lib/railway");
  const files: { f: string; src: string }[] = [];
  const walk = (d: string, prefix = "") => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(join(d, e.name), `${prefix}${e.name}/`);
      else if (e.name.endsWith(".ts")) files.push({ f: `${prefix}${e.name}`, src: readFileSync(join(d, e.name), "utf8") });
    }
  };
  walk(dir);

  it("imports no domain engine", () => {
    const forbidden = [
      "@/lib/memory", "@/lib/prompt", "@/lib/runtime", "@/lib/provider", "@/lib/graph",
      "@/lib/journey", "@/lib/decision", "@/lib/trust", "@/lib/goal", "@/lib/spatial",
      "@/lib/ctor", "@/lib/agent", "@/lib/studio", "@/lib/ai", "@/lib/tie",
      "@/integrations/supabase",
    ];
    for (const { f, src } of files) {
      for (const p of forbidden) {
        expect(src.includes(p), `${f} imports ${p}`).toBe(false);
      }
    }
  });
  it("communicates with the platform only through IPCF", () => {
    const external = files.filter(({ src }) => src.includes("@/lib/"));
    expect(external.length).toBeGreaterThan(0);
    for (const { f, src } of external) {
      const imports = [...src.matchAll(/^import[^;]*from "(@\/[^"]+)";/gm)].map((m) => m[1]);
      for (const i of imports) {
        expect(i, `${f} imports ${i}`).toBe("@/lib/integration");
      }
    }
  });
  it("makes no direct provider or network calls", () => {
    for (const { f, src } of files) {
      for (const bad of ["fetch(", "XMLHttpRequest", "axios", "node-fetch", "WebSocket", "https://", "http://"]) {
        expect(src.includes(bad), `${f} uses ${bad}`).toBe(false);
      }
    }
  });
  it("keeps real provider vocabulary out of the suite", () => {
    for (const { f, src } of files) {
      const lower = src.toLowerCase();
      for (const p of ["irctc", "ntes", "railmadad", "trainman", "amadeus"]) {
        expect(lower.includes(p), `${f} names provider ${p}`).toBe(false);
      }
    }
  });
  it("returns immutable models", async () => {
    const { rt } = await suite();
    const res = await rt.invoke<readonly NormalizedStation[]>("search_station", { query: "Nor" });
    expect(Object.isFrozen(res.data)).toBe(true);
    expect(Object.isFrozen(res.data![0])).toBe(true);
    expect(() => {
      (res.data![0] as { code: string }).code = "HACK";
    }).toThrow();
  });
});
