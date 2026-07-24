/** JSR — health probe. */
import type { JourneyStudioFactoryDeps } from "./factory";

export interface StudioHealthReport {
  readonly status: "healthy" | "degraded" | "unhealthy";
  readonly checks: Readonly<Record<string, { ok: boolean; message?: string }>>;
  readonly at: number;
}

export async function collectStudioHealth(deps: JourneyStudioFactoryDeps): Promise<StudioHealthReport> {
  const checks: Record<string, { ok: boolean; message?: string }> = {};
  try {
    const agentOk = await deps.agent.healthy();
    checks.agent = { ok: agentOk, message: agentOk ? undefined : "agent port unhealthy" };
  } catch (e) {
    checks.agent = { ok: false, message: (e as Error).message };
  }
  checks.registry = { ok: true, message: `${deps.registry.size()} sessions` };
  checks.presentation = { ok: !!deps.presentation };
  const failed = Object.values(checks).filter(c => !c.ok).length;
  const status = failed === 0 ? "healthy" : failed === Object.keys(checks).length ? "unhealthy" : "degraded";
  return Object.freeze({ status, checks: Object.freeze(checks), at: Date.now() });
}
