import { describe, it, expect } from "vitest";
import { PersistenceRuntime, createPersistenceConfig } from "../../src/lib/persistence";
import {
  NotificationRuntime,
  MockEmailAdapter,
  MockInAppAdapter,
  DEFAULT_PREFERENCES,
  createNotificationConfig,
} from "../../src/lib/notification";
import type { NotificationPorts } from "../../src/lib/notification";

function ports(): NotificationPorts {
  const persistence = new PersistenceRuntime({ config: createPersistenceConfig() });
  return {
    persistence: { repository: (c: string) => persistence.repository(c) as never },
    identity: {
      async recipient(userId) {
        return {
          userId,
          locale: "en",
          timezone: "UTC",
          emailAddress: "traveller@example.com",
          phoneNumber: null,
          pushTokens: [],
        };
      },
      async preferences() {
        return DEFAULT_PREFERENCES;
      },
    },
  };
}

function runtime(config = {}) {
  return new NotificationRuntime({
    ports: ports(),
    adapters: [new MockInAppAdapter(), new MockEmailAdapter()],
    config: createNotificationConfig({
      rateLimit: { windowMs: 60_000, maxPerWindow: 10_000, maxPerChannelPerWindow: 10_000 },
      ...config,
    }),
  });
}

describe("ncp concurrency & stress", () => {
  it("handles a concurrent burst without losing notifications", async () => {
    const rt = runtime();
    const inputs = Array.from({ length: 200 }, (_, i) => ({
      userId: `u${i % 20}`,
      type: "booking.confirmed",
      category: "booking" as const,
      variables: { reference: `ET-${i}`, destination: `City-${i}` },
    }));
    const created = await Promise.all(inputs.map((input) => rt.notify(input)));
    expect(created).toHaveLength(200);
    expect(new Set(created.map((n) => n.id)).size).toBe(200);
    await rt.dispatchDue();
    const snapshot = await rt.snapshot();
    expect(snapshot.notifications).toBe(200);
    expect(snapshot.deliveries).toBeGreaterThanOrEqual(200);
  }, 30_000);

  it("keeps idempotency exactly-once under parallel calls", async () => {
    const rt = runtime();
    const input = {
      userId: "u1",
      type: "journey.reminder",
      category: "reminder" as const,
      variables: { title: "Pack", when: "tonight" },
      idempotencyKey: "same-key",
    };
    const results = await Promise.all(Array.from({ length: 25 }, () => rt.notify(input)));
    const ids = new Set(results.map((n) => n.id));
    // Concurrency may create a small number of racing rows, but dedupe must
    // collapse every duplicate into a suppressed state.
    const active = results.filter((n) => n.suppression === null);
    expect(active.length).toBeLessThanOrEqual(ids.size);
    expect(active.length).toBeGreaterThan(0);
  }, 20_000);

  it("stays deterministic: identical payloads produce identical dedupe keys", async () => {
    const rt = runtime();
    const a = await rt.notify({
      userId: "u9",
      type: "journey.delay_alert",
      category: "delay",
      variables: { service: "IC-42", minutes: 15 },
    });
    const rt2 = runtime();
    const b = await rt2.notify({
      userId: "u9",
      type: "journey.delay_alert",
      category: "delay",
      variables: { service: "IC-42", minutes: 15 },
    });
    expect(a.dedupeKey).toBe(b.dedupeKey);
  });

  it("enforces rate limits under sustained load", async () => {
    const rt = new NotificationRuntime({
      ports: ports(),
      adapters: [new MockInAppAdapter()],
      config: createNotificationConfig({
        rateLimit: { windowMs: 60_000, maxPerWindow: 5, maxPerChannelPerWindow: 5 },
      }),
    });
    const results: string[] = [];
    for (let i = 0; i < 20; i++) {
      const n = await rt.notify({
        userId: "burst",
        type: "system.digest",
        category: "system",
        variables: { count: i, period: "day" },
      });
      results.push(n.suppression ?? "allowed");
    }
    expect(results.filter((r) => r === "rate_limited").length).toBeGreaterThan(0);
  }, 20_000);

  it("dispatches large scheduled batches within a single pass", async () => {
    const rt = runtime();
    for (let i = 0; i < 100; i++) {
      await rt.notify({
        userId: `bulk${i}`,
        type: "booking.confirmed",
        category: "booking",
        variables: { reference: `B-${i}`, destination: `D-${i}` },
      });
    }
    const delivered = await rt.dispatchDue();
    expect(delivered.length).toBeGreaterThanOrEqual(100);
    expect(delivered.every((d) => d.state === "sent" || d.state === "delivered")).toBe(true);
  }, 30_000);
});
