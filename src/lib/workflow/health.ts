/** WAR — health checks. */
import type { WorkflowManager } from "./manager";
import type { WorkflowAgentPort, WorkflowCtorPort, WorkflowIntegrationPort } from "./ports";

export interface WorkflowHealthReport {
  readonly status: "healthy" | "degraded" | "unhealthy";
  readonly checks: Readonly<Record<string, boolean>>;
  readonly definitions: number;
  readonly instances: number;
  readonly pendingSchedules: number;
  readonly at: number;
}

export async function collectWorkflowHealth(
  manager: WorkflowManager,
  ports: { ctor: WorkflowCtorPort; agent: WorkflowAgentPort; integration: WorkflowIntegrationPort },
  now: () => number = Date.now,
): Promise<WorkflowHealthReport> {
  const safe = async (p: Promise<boolean>) => { try { return await p; } catch { return false; } };
  const checks = {
    registry: manager.registry.size() >= 0,
    scheduler: manager.scheduler.pending() >= 0,
    ctor: await safe(ports.ctor.healthy()),
    agent: await safe(ports.agent.healthy()),
    integration: await safe(ports.integration.healthy()),
  };
  const failed = Object.values(checks).filter(v => !v).length;
  return Object.freeze({
    status: failed === 0 ? "healthy" : failed <= 1 ? "degraded" : "unhealthy",
    checks: Object.freeze(checks),
    definitions: manager.registry.size(),
    instances: manager.list().length,
    pendingSchedules: manager.scheduler.pending(),
    at: now(),
  });
}
