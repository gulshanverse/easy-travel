import { describe, it, expect } from "vitest";
import { PersistenceRuntime, createPersistenceConfig } from "../../src/lib/persistence";
import {
  NotificationRuntime,
  MockEmailAdapter,
  MockInAppAdapter,
  MockPushAdapter,
  MockSmsAdapter,
  DEFAULT_PREFERENCES,
  route,
  backoffDelayMs,
  createNotificationConfig,
  renderTemplate,
  TemplateRegistry,
  BUILT_IN_TEMPLATES,
  MissingVariableError,
} from "../../src/lib/notification";
import type { NotificationPorts } from "../../src/lib/notification";

function ports(overrides: Partial<NotificationPorts> = {}): NotificationPorts {
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
          phoneNumber: "+15551234567",
          pushTokens: ["tok-1"],
        };
      },
      async preferences() {
        return DEFAULT_PREFERENCES;
      },
    },
    ...overrides,
  };
}

function runtime(adapters = [new MockInAppAdapter(), new MockEmailAdapter(), new MockPushAdapter(), new MockSmsAdapter()]) {
  return new NotificationRuntime({ ports: ports(), adapters });
}

describe("notification runtime", () => {
  it("creates, queues and delivers across channels", async () => {
    const rt = runtime();
    const n = await rt.notify({
      userId: "u1",
      type: "booking.confirmed",
      category: "booking",
      variables: { reference: "ET-1", destination: "Kyoto" },
    });
    expect(n.state).toBe("queued");
    expect(n.channels).toContain("in_app");
    const delivered = await rt.dispatchDue();
    expect(delivered.every((d) => d.state === "sent")).toBe(true);
    expect(await rt.unreadCount("u1")).toBe(1);
  });

  it("deduplicates identical notifications inside the window", async () => {
    const rt = runtime();
    const input = {
      userId: "u1",
      type: "journey.delay_alert",
      category: "delay" as const,
      variables: { service: "Shinkansen", minutes: 12 },
    };
    await rt.notify(input);
    const second = await rt.notify(input);
    expect(second.suppression).toBe("duplicate");
    expect(second.state).toBe("suppressed");
  });

  it("returns the same notification for a repeated idempotency key", async () => {
    const rt = runtime();
    const a = await rt.notify({
      userId: "u1", type: "journey.reminder", category: "reminder",
      variables: { title: "Pack", when: "tonight" }, idempotencyKey: "k1",
    });
    const b = await rt.notify({
      userId: "u1", type: "journey.reminder", category: "reminder",
      variables: { title: "Pack", when: "tonight" }, idempotencyKey: "k1",
    });
    expect(b.id).toBe(a.id);
  });

  it("marks in-app items read", async () => {
    const rt = runtime();
    await rt.notify({
      userId: "u1", type: "agent.suggestion", category: "agent",
      variables: { headline: "Try the night train" },
    });
    await rt.dispatchDue();
    const [item] = await rt.inbox("u1");
    await rt.markRead("u1", item.id);
    expect(await rt.unreadCount("u1")).toBe(0);
  });

  it("retries transient failures then dead-letters", async () => {
    const rt = new NotificationRuntime({
      ports: ports(),
      config: { retry: { maxAttempts: 2, baseDelayMs: 0, maxDelayMs: 0, factor: 1, jitterRatio: 0 } },
      adapters: [new MockInAppAdapter({ failEvery: 1, failureKind: "transient" })],
    });
    const n = await rt.notify({
      userId: "u1", type: "workflow.status", category: "workflow",
      channels: ["in_app"], variables: { workflow: "Rebooking", status: "running" },
    });
    await rt.dispatchDue();
    await rt.dispatchDue();
    const [delivery] = await rt.deliveries(n.id);
    expect(delivery.state).toBe("dead_lettered");
    expect(delivery.attempts).toHaveLength(2);
  });

  it("honours quiet hours except for critical priority", async () => {
    const quiet = { ...DEFAULT_PREFERENCES, quietHours: { startHour: 22, endHour: 7 } };
    const normal = route({
      preferences: quiet, category: "price", priority: "normal",
      requestedChannels: ["push"], enabledChannels: ["in_app", "push"],
      availableChannels: ["in_app", "push"], quietHoursBypass: ["critical"], hour: 23,
    });
    expect(normal.suppression).toBe("quiet_hours");
    const critical = route({
      preferences: quiet, category: "security", priority: "critical",
      requestedChannels: ["push"], enabledChannels: ["in_app", "push"],
      availableChannels: ["in_app", "push"], quietHoursBypass: ["critical"], hour: 23,
    });
    expect(critical.allowed).toBe(true);
  });

  it("never suppresses mandatory security categories", () => {
    const off = { ...DEFAULT_PREFERENCES, categories: { security: false } };
    const decision = route({
      preferences: off, category: "security", priority: "critical",
      requestedChannels: [], enabledChannels: ["in_app", "email"],
      availableChannels: ["in_app", "email"], quietHoursBypass: ["critical"], hour: 10,
    });
    expect(decision.allowed).toBe(true);
  });

  it("renders deterministically and enforces required variables", () => {
    const registry = new TemplateRegistry("en", BUILT_IN_TEMPLATES);
    const template = registry.resolve("security.login_alert", "en");
    const a = renderTemplate({ template, channel: "email", variables: { device: "iPhone", city: "Oslo" } });
    const b = renderTemplate({ template, channel: "email", variables: { device: "iPhone", city: "Oslo" } });
    expect(a.fingerprint).toBe(b.fingerprint);
    expect(() => renderTemplate({ template, channel: "email", variables: { device: "iPhone" } }))
      .toThrow(MissingVariableError);
  });

  it("falls back to the default locale when a translation is missing", () => {
    const registry = new TemplateRegistry("en", BUILT_IN_TEMPLATES);
    expect(registry.resolve("booking.confirmed", "hi").locale).toBe("en");
    expect(registry.resolve("security.login_alert", "hi").locale).toBe("hi");
  });

  it("computes deterministic backoff", () => {
    const config = createNotificationConfig().retry;
    expect(backoffDelayMs(config, 1, "d1")).toBe(backoffDelayMs(config, 1, "d1"));
    expect(backoffDelayMs(config, 3, "d1")).toBeGreaterThan(backoffDelayMs(config, 1, "d1"));
  });

  it("rate limits floods of low-priority notifications", async () => {
    const rt = new NotificationRuntime({
      ports: ports(),
      config: { rateLimit: { windowMs: 60_000, maxPerWindow: 2, maxPerChannelPerWindow: 2 } },
      adapters: [new MockInAppAdapter()],
    });
    const results = [];
    for (let i = 0; i < 4; i++) {
      results.push(
        await rt.notify({
          userId: "u1", type: "journey.price_drop", category: "price",
          channels: ["in_app"], variables: { route: `R${i}`, price: `$${i}` },
        }),
      );
    }
    expect(results.filter((r) => r.suppression === "rate_limited").length).toBeGreaterThan(0);
  });

  it("reports health across templates and channels", async () => {
    const report = await runtime().health();
    expect(report.healthy).toBe(true);
    expect(report.checks.some((c) => c.name === "channel:mock.email")).toBe(true);
  });

  it("cancels a queued notification", async () => {
    const rt = runtime();
    const n = await rt.notify({
      userId: "u1", type: "system.digest", category: "system", variables: { count: 3 },
    });
    const cancelled = await rt.cancel(n.id);
    expect(cancelled?.state).toBe("cancelled");
    expect((await rt.dispatchDue()).length).toBe(0);
  });
});
