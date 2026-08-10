import { describe, it, expect } from "vitest";
import { PersistenceRuntime, createPersistenceConfig } from "../../src/lib/persistence";
import {
  NotificationRuntime,
  MockEmailAdapter,
  MockInAppAdapter,
  MockPushAdapter,
  MockSmsAdapter,
  DEFAULT_PREFERENCES,
  SECURITY_BRIDGE_TEMPLATES,
  securityNotifyInput,
  bridgeIamSecurityEvents,
  preferencesFromIdentitySettings,
  identityPortFromIdentity,
  workflowSignalBridge,
  unsubscribeToken,
  templateFingerprint,
  escapeHtml,
  redact,
  makeTemplate,
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
          phoneNumber: "+15551234567",
          pushTokens: ["tok-1"],
        };
      },
      async preferences() {
        return DEFAULT_PREFERENCES;
      },
    },
  };
}

function runtime() {
  return new NotificationRuntime({
    ports: ports(),
    adapters: [
      new MockInAppAdapter(),
      new MockEmailAdapter(),
      new MockPushAdapter(),
      new MockSmsAdapter(),
    ],
    templates: SECURITY_BRIDGE_TEMPLATES,
  });
}

describe("ncp subscriptions", () => {
  it("suppresses notifications for unsubscribed topics", async () => {
    const rt = runtime();
    await rt.setSubscription("u1", "price", false);
    const n = await rt.notify({
      userId: "u1",
      type: "journey.price_drop",
      category: "price",
      variables: { route: "DEL-BOM", amount: 42 },
    });
    expect(n.suppression).toBe("unsubscribed");
    expect(n.state).toBe("suppressed");
  });

  it("never allows unsubscribing from security or account topics", async () => {
    const rt = runtime();
    await rt.setSubscription("u1", "security", false);
    const n = await rt.notify({
      userId: "u1",
      type: "security.login_alert",
      category: "security",
      variables: { device: "iPhone", city: "Delhi" },
    });
    expect(n.suppression).toBeNull();
  });

  it("honours deterministic one-click unsubscribe tokens", async () => {
    const rt = runtime();
    const token = rt.unsubscribeToken("u1", "marketing");
    expect(token).toBe(unsubscribeToken("u1", "marketing"));
    expect(await rt.unsubscribeByToken("u1", "marketing", "wrong")).toBeUndefined();
    const record = await rt.unsubscribeByToken("u1", "marketing", token);
    expect(record?.subscribed).toBe(false);
    const list = await rt.subscriptions("u1");
    expect(list).toHaveLength(1);
  });
});

describe("ncp template versioning", () => {
  it("records an immutable version row per registered template", async () => {
    const rt = runtime();
    const count = await rt.bootstrap();
    expect(count).toBeGreaterThan(0);
    const template = makeTemplate({
      id: "custom.alert",
      category: "system",
      requiredVariables: ["title"],
      channels: { in_app: { subject: "{{title}}", body: "{{title}}" } },
    });
    await rt.registerTemplate(template);
    await rt.registerTemplate(template);
    const history = await rt.templateHistory("custom.alert", "en");
    expect(history.length).toBeGreaterThanOrEqual(2);
    expect(history[0].version).toBeLessThan(history[history.length - 1].version);
  });

  it("fingerprints templates deterministically", () => {
    const t = makeTemplate({
      id: "x",
      category: "system",
      channels: { in_app: { body: "hello" } },
    });
    expect(templateFingerprint(t)).toBe(templateFingerprint(t));
  });
});

describe("ncp integration bridges", () => {
  it("maps IAM security events onto notify inputs", () => {
    const input = securityNotifyInput({ kind: "AccountLocked", at: 5, subjectId: "u1" });
    expect(input?.category).toBe("security");
    expect(input?.priority).toBe("critical");
    expect(securityNotifyInput({ kind: "LoginSucceeded", at: 5, subjectId: "u1" })).toBeNull();
    expect(securityNotifyInput({ kind: "AccountLocked", at: 5, subjectId: null })).toBeNull();
  });

  it("delivers bridged IAM security events end to end", async () => {
    const rt = runtime();
    const listeners: ((e: { kind: string; at: number; subjectId: string | null }) => void)[] = [];
    const stop = bridgeIamSecurityEvents(
      {
        on(listener) {
          listeners.push(listener);
          return () => {};
        },
      },
      { notify: (input) => rt.notify(input) },
    );
    listeners[0]({ kind: "PasswordChanged", at: 1, subjectId: "u1" });
    await new Promise((r) => setTimeout(r, 0));
    await rt.dispatchDue();
    expect(await rt.unreadCount("u1")).toBe(1);
    stop();
  });

  it("translates identity settings into preference records", async () => {
    const prefs = preferencesFromIdentitySettings({
      email: true,
      sms: false,
      push: true,
      inApp: true,
      reminders: true,
      workflowAlerts: false,
      delayAlerts: true,
      priceAlerts: false,
      weatherAlerts: false,
      frequency: "instant",
      quietHours: null,
    });
    expect(prefs.channels).toEqual(["in_app", "email", "push"]);
    expect(prefs.categories.workflow).toBe(false);
    expect(prefs.categories.marketing).toBe(false);

    const port = identityPortFromIdentity({
      async recipient(userId) {
        return { userId };
      },
      async settings() {
        return {
          email: true,
          sms: true,
          push: false,
          inApp: true,
          reminders: false,
          workflowAlerts: true,
          delayAlerts: true,
          priceAlerts: true,
          weatherAlerts: true,
          frequency: "daily",
          quietHours: { startHour: 22, endHour: 7 },
        };
      },
    });
    const resolved = await port.preferences("u1");
    expect(resolved?.frequency).toBe("daily");
    expect(resolved?.quietHours?.startHour).toBe(22);
  });

  it("signals the workflow runtime on terminal outcomes", async () => {
    const rt = runtime();
    const signals: string[] = [];
    workflowSignalBridge(
      {
        async signal(name) {
          signals.push(name);
        },
      },
      { on: (l) => rt.on((e) => l(e)) },
    );
    await rt.notify({
      userId: "u1",
      type: "booking.confirmed",
      category: "booking",
      variables: { reference: "ET-9", destination: "Oslo" },
    });
    await rt.dispatchDue();
    expect(signals.length).toBeGreaterThan(0);
  });
});

describe("ncp security hardening", () => {
  it("escapes HTML and redacts PII", () => {
    expect(escapeHtml("<script>x</script>")).not.toContain("<script>");
    const masked = redact({ email: "traveller@example.com", token: "secret" });
    expect(JSON.stringify(masked)).not.toContain("secret");
  });
});
