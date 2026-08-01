/**
 * Identity Platform — health checks.
 */
import type { IdentityManager } from "./manager";
import type { IdentityPorts } from "./ports";

export interface IdentityHealthReport {
  readonly healthy: boolean;
  readonly checks: Readonly<Record<string, boolean>>;
  readonly sizes: {
    readonly users: number;
    readonly favorites: number;
    readonly journeys: number;
    readonly sessions: number;
    readonly travelProfiles: number;
  };
}

export async function collectIdentityHealth(
  manager: IdentityManager,
  ports: IdentityPorts = {},
  travelProfiles = 0,
): Promise<IdentityHealthReport> {
  const [memory, agent, workflow, studio] = await Promise.all([
    ports.memory ? ports.memory.healthy() : Promise.resolve(true),
    ports.agent ? ports.agent.healthy() : Promise.resolve(true),
    ports.workflow ? ports.workflow.healthy() : Promise.resolve(true),
    ports.studio ? ports.studio.healthy() : Promise.resolve(true),
  ]);
  const checks = Object.freeze({
    registry: true, memory, agent, workflow, studio, kernel: true,
  });
  return Object.freeze({
    healthy: Object.values(checks).every(Boolean),
    checks,
    sizes: Object.freeze({
      users: manager.users.size(),
      favorites: manager.favorites.size(),
      journeys: manager.journeys.size(),
      sessions: manager.sessions.size(),
      travelProfiles,
    }),
  });
}
