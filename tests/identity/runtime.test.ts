import { describe, expect, it } from "vitest";
import {
  createIdentityRuntime, makeConfidencePreference, mergeConfidencePreference,
  resolveProfileBundle, builtInTravelProfiles, computeTravelStatistics,
  defaultPreferenceResolutionEngine, IDENTITY_ENGINE_CONTRACT,
} from "@/lib/identity";

function seed() {
  const rt = createIdentityRuntime();
  const user = rt.createUser({ handle: "ada", email: "ada@example.com" });
  return { rt, user };
}

describe("travel profiles", () => {
  it("exposes 8 read-only built-in bundles", () => {
    const profiles = builtInTravelProfiles(0);
    expect(profiles).toHaveLength(8);
    expect(profiles.every((p) => p.metadata.builtIn)).toBe(true);
    expect(Object.isFrozen(profiles[0]!.preferences)).toBe(true);
  });

  it("adopts and edits an owned copy", () => {
    const { rt, user } = seed();
    const adopted = rt.adoptProfile(user.id, "business");
    expect(adopted.userId).toBe(user.id);
    const updated = rt.updateTravelProfile(adopted.id, { name: "Work trips" });
    expect(updated.name).toBe("Work trips");
    expect(updated.revision).toBe(2);
  });

  it("flattens multiple profiles deterministically", () => {
    const bundle = resolveProfileBundle(builtInTravelProfiles(0).slice(0, 2));
    const again = resolveProfileBundle(builtInTravelProfiles(0).slice(0, 2));
    expect(bundle.map((p) => p.key)).toEqual(again.map((p) => p.key));
  });
});

describe("preference confidence (ADR-024)", () => {
  it("never lets observed overwrite explicit", () => {
    const explicit = makeConfidencePreference({ key: "preferredSeat", value: "window", source: "explicit" });
    const observed = makeConfidencePreference({ key: "preferredSeat", value: "aisle", source: "observed", confidence: 1 });
    expect(mergeConfidencePreference(explicit, observed).value).toBe("window");
    expect(mergeConfidencePreference(observed, explicit).value).toBe("window");
  });
});

describe("preference resolution", () => {
  it("falls back when the preferred value is unavailable and explains why", () => {
    const r = defaultPreferenceResolutionEngine.resolve("preferredSeat", {
      candidates: [makeConfidencePreference({ key: "preferredSeat", value: "window", source: "explicit" })],
      availability: (_k, v) => v !== "window",
    });
    expect(r.value).toBe("lower");
    expect(r.satisfied).toBe(true);
    expect(r.explanation.join(" ")).toContain("unavailable");
  });

  it("records conflicts between competing sources", () => {
    const r = defaultPreferenceResolutionEngine.resolve("preferredSeat", {
      candidates: [
        makeConfidencePreference({ key: "preferredSeat", value: "window", source: "explicit" }),
        makeConfidencePreference({ key: "preferredSeat", value: "aisle", source: "learned" }),
      ],
    });
    expect(r.value).toBe("window");
    expect(r.conflicts).toHaveLength(1);
  });
});

describe("travel statistics", () => {
  it("only counts completed journeys", () => {
    const { rt, user } = seed();
    rt.saveJourney({ userId: user.id, title: "Kyoto", status: "completed", startDate: "2026-01-01", endDate: "2026-01-05", payload: { countries: ["JP"], cities: ["Kyoto"], modes: ["train"], hotelNights: 4 } });
    rt.saveJourney({ userId: user.id, title: "Draft", status: "draft" });
    const stats = rt.statisticsFor(user.id);
    expect(stats.tripsCompleted).toBe(1);
    expect(stats.countriesVisited).toBe(1);
    expect(stats.railTrips).toBe(1);
    expect(stats.averageDurationDays).toBe(5);
    expect(stats.travelScore).toBeGreaterThan(0);
  });

  it("is empty for a user with no journeys", () => {
    const stats = computeTravelStatistics({ userId: "u", journeys: [], at: 0 });
    expect(stats.travelScore).toBe(0);
  });
});

describe("personalization context", () => {
  it("is versioned, fingerprinted and deterministic", () => {
    const { rt, user } = seed();
    rt.adoptProfile(user.id, "luxury");
    const a = rt.personalizationContext(user.id);
    const b = rt.personalizationContext(user.id);
    expect(b.version).toBe(a.version + 1);
    expect(b.fingerprint).toBe(a.fingerprint);
    expect(a.activeProfiles).toContain("luxury");
    expect(rt.contextHistoryFor(user.id)).toHaveLength(2);
  });

  it("suppresses resolved data when personalization is off", () => {
    const { rt, user } = seed();
    rt.manager.updatePrivacySettings(user.id, { allowPersonalization: false });
    const ctx = rt.personalizationContext(user.id);
    expect(ctx.suppressed).toBe(true);
    expect(Object.keys(ctx.resolved)).toHaveLength(0);
  });

  it("derives hard accessibility constraints", () => {
    const { rt, user } = seed();
    rt.updatePreferences(user.id, { accessibility: { wheelchairAccess: true } });
    const ctx = rt.personalizationContext(user.id);
    expect(ctx.constraints.some((c) => c.key === "wheelchairAccess" && c.hard)).toBe(true);
  });
});

describe("presentation & contract", () => {
  it("builds UI-independent cards", () => {
    const { rt, user } = seed();
    rt.adoptProfile(user.id, "family");
    const cards = rt.cards(user.id);
    expect(cards.map((c) => c.kind)).toContain("identity.travel_profile");
    expect(cards.every((c) => Object.isFrozen(c))).toBe(true);
  });

  it("declares prohibited dependencies", () => {
    expect(IDENTITY_ENGINE_CONTRACT.prohibited).toContain("connector.*");
    expect(IDENTITY_ENGINE_CONTRACT.dependencies).not.toContain("railway");
  });

  it("reports health", async () => {
    const { rt } = seed();
    await expect(rt.health()).resolves.toMatchObject({ healthy: true });
  });
});
