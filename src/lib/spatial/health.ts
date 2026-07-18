/** Spatial Intelligence Engine — health checks. */
import type { SpatialManager } from "./manager";
import type {
  SpatialDecisionPort, SpatialGoalPort, SpatialGraphPort, SpatialJourneyPort,
  SpatialMemoryPort, SpatialPromptPort, SpatialProviderPort, SpatialTrustPort,
} from "./ports";

export interface SpatialHealthDeps {
  readonly memory?: SpatialMemoryPort;
  readonly journey?: SpatialJourneyPort;
  readonly decision?: SpatialDecisionPort;
  readonly goal?: SpatialGoalPort;
  readonly trust?: SpatialTrustPort;
  readonly graph?: SpatialGraphPort;
  readonly prompt?: SpatialPromptPort;
  readonly provider?: SpatialProviderPort;
}

export interface SpatialHealthReport {
  readonly ok: boolean;
  readonly places: number;
  readonly regions: number;
  readonly indexValid: boolean;
  readonly ports: Readonly<Record<string, boolean>>;
}

export async function collectSpatialHealth(mgr: SpatialManager, deps: SpatialHealthDeps): Promise<SpatialHealthReport> {
  const validation = mgr.index.validate();
  const entries: [string, boolean][] = [];
  for (const [name, port] of Object.entries(deps)) {
    if (!port) continue;
    try { entries.push([name, await (port as { healthy: () => Promise<boolean> }).healthy()]); }
    catch { entries.push([name, false]); }
  }
  const ports = Object.freeze(Object.fromEntries(entries));
  const portsOk = entries.every(([, ok]) => ok);
  return Object.freeze({
    ok: validation.ok && portsOk,
    places: mgr.placeCount(),
    regions: mgr.regions.size(),
    indexValid: validation.ok,
    ports,
  });
}
