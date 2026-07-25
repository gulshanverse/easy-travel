/** IPCF — health checks. */
import type { IntegrationDeps } from "./factory";

export interface IntegrationHealthReport {
  readonly status: "healthy" | "degraded" | "unhealthy";
  readonly checks: Readonly<Record<string, { ok: boolean; message?: string }>>;
  readonly at: number;
  readonly counts: {
    readonly connectors: number;
    readonly webhooks: number;
    readonly polling: number;
    readonly dlq: number;
  };
}

export async function collectIntegrationHealth(deps: IntegrationDeps): Promise<IntegrationHealthReport> {
  const checks: Record<string, { ok: boolean; message?: string }> = {};
  for (const [name, p] of [
    ["kernel", deps.kernel] as const,
    ["agent", deps.agent] as const,
    ["ctor", deps.ctor] as const,
    ["provider", deps.provider] as const,
  ]) {
    try {
      const ok = await p.healthy();
      checks[name] = { ok, message: ok ? undefined : `${name} port unhealthy` };
    } catch (e) {
      checks[name] = { ok: false, message: (e as Error).message };
    }
  }
  checks.registry = { ok: true, message: `${deps.registry.size()} connectors` };
  const failed = Object.values(checks).filter(c => !c.ok).length;
  const status = failed === 0 ? "healthy" : failed === Object.keys(checks).length ? "unhealthy" : "degraded";
  return Object.freeze({
    status, checks: Object.freeze(checks), at: Date.now(),
    counts: {
      connectors: deps.registry.size(),
      webhooks: deps.webhookRegistry.size(),
      polling: deps.pollingRegistry.size(),
      dlq: deps.dlq.size(),
    },
  });
}
