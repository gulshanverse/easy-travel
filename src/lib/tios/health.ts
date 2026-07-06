/**
 * TIOS Platform Health (Milestone 5.3).
 * Read-only health interfaces that future admin dashboards will consume.
 * Aggregates capability, workflow, provider, memory, AI, and DB health.
 */
import { listCapabilities } from "./registry";
import { snapshotMatrix } from "./provider-matrix";
import { readMetricsSnapshot } from "./observability";
import type { HealthStatus } from "./types";

export interface HealthCheck {
  id: string;
  status: HealthStatus;
  message?: string;
  lastCheckedAt: number;
}

export interface PlatformHealth {
  overall: HealthStatus;
  checkedAt: number;
  capabilities: HealthCheck[];
  providers: HealthCheck[];
  workflow: HealthCheck;
  memory: HealthCheck;
  ai: HealthCheck;
  database: HealthCheck;
  summary: { total: number; healthy: number; degraded: number; down: number; unknown: number };
}

type Probe = () => Promise<HealthCheck> | HealthCheck;

const probes = new Map<string, Probe>();

export function registerHealthProbe(id: string, probe: Probe): void {
  probes.set(id, probe);
}

async function runProbe(id: string, fallback: HealthCheck): Promise<HealthCheck> {
  const p = probes.get(id);
  if (!p) return fallback;
  try { return await p(); }
  catch (err) {
    return {
      id, status: "down",
      message: err instanceof Error ? err.message : String(err),
      lastCheckedAt: Date.now(),
    };
  }
}

function worst(...s: HealthStatus[]): HealthStatus {
  const order: HealthStatus[] = ["down", "degraded", "unknown", "healthy"];
  for (const level of order) if (s.includes(level)) return level;
  return "healthy";
}

export async function readPlatformHealth(): Promise<PlatformHealth> {
  const now = Date.now();
  const capabilities: HealthCheck[] = listCapabilities().map((c) => ({
    id: `capability:${c.manifest.id}`,
    status: c.health,
    lastCheckedAt: c.registeredAt,
  }));
  const providers: HealthCheck[] = snapshotMatrix().map((e) => ({
    id: `provider:${e.capability}:${e.provider.id}`,
    status: e.health,
    lastCheckedAt: now,
  }));
  const workflow = await runProbe("workflow", { id: "workflow", status: "healthy", lastCheckedAt: now });
  const memory = await runProbe("memory", { id: "memory", status: "unknown", lastCheckedAt: now });
  const ai = await runProbe("ai", { id: "ai", status: "healthy", lastCheckedAt: now });
  const database = await runProbe("database", { id: "database", status: "unknown", lastCheckedAt: now });

  const all = [...capabilities, ...providers, workflow, memory, ai, database];
  const summary = {
    total: all.length,
    healthy: all.filter((c) => c.status === "healthy").length,
    degraded: all.filter((c) => c.status === "degraded").length,
    down: all.filter((c) => c.status === "down").length,
    unknown: all.filter((c) => c.status === "unknown").length,
  };
  const overall = worst(...all.map((c) => c.status));

  // Touch the observability snapshot so health reports "warm" services.
  void readMetricsSnapshot();

  return { overall, checkedAt: now, capabilities, providers, workflow, memory, ai, database, summary };
}
