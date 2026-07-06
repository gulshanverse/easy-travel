/**
 * TIOS Provider Capability Matrix (Milestone 5.3).
 * Capabilities never know providers directly. This matrix maps
 * (capability → providers) with priority and health, and drives selection.
 */
import { emitTIOSEvent } from "./events";
import type { CapabilityId, HealthStatus } from "./types";

export interface ProviderDescriptor {
  id: string;
  displayName: string;
  vendor?: string;
  region?: string;
  costCategory?: "free" | "low" | "medium" | "high";
  supportsStreaming?: boolean;
}

export interface MatrixEntry {
  capability: CapabilityId;
  provider: ProviderDescriptor;
  priority: number;                  // higher wins
  health: HealthStatus;
  enabled: boolean;
}

const matrix: MatrixEntry[] = [];

export function addProviderToMatrix(entry: Omit<MatrixEntry, "health" | "enabled"> & {
  health?: HealthStatus; enabled?: boolean;
}): void {
  const existing = matrix.find(
    (e) => e.capability === entry.capability && e.provider.id === entry.provider.id,
  );
  if (existing) {
    existing.priority = entry.priority;
    existing.provider = entry.provider;
    if (entry.health) existing.health = entry.health;
    if (typeof entry.enabled === "boolean") existing.enabled = entry.enabled;
    return;
  }
  matrix.push({
    ...entry,
    health: entry.health ?? "unknown",
    enabled: entry.enabled ?? true,
  });
}

export function removeProviderFromMatrix(capability: CapabilityId, providerId: string): void {
  const idx = matrix.findIndex(
    (e) => e.capability === capability && e.provider.id === providerId,
  );
  if (idx >= 0) matrix.splice(idx, 1);
}

export function listProvidersForCapability(capability: CapabilityId): MatrixEntry[] {
  return matrix
    .filter((e) => e.capability === capability && e.enabled)
    .sort((a, b) => b.priority - a.priority);
}

export function selectProvider(
  capability: CapabilityId,
  filter?: (e: MatrixEntry) => boolean,
): MatrixEntry | undefined {
  const candidates = listProvidersForCapability(capability)
    .filter((e) => e.health !== "down")
    .filter((e) => (filter ? filter(e) : true));
  const chosen = candidates[0];
  if (chosen) {
    emitTIOSEvent({
      name: "PROVIDER_SELECTED",
      requestId: `select_${Date.now().toString(36)}`,
      timestamp: Date.now(),
      capability,
      data: { providerId: chosen.provider.id },
    });
  }
  return chosen;
}

export function setMatrixHealth(
  capability: CapabilityId, providerId: string, health: HealthStatus,
): void {
  const e = matrix.find(
    (m) => m.capability === capability && m.provider.id === providerId,
  );
  if (e) e.health = health;
}

export function snapshotMatrix(): MatrixEntry[] {
  return matrix.map((e) => ({ ...e, provider: { ...e.provider } }));
}

// -------- Seed known provider ↔ capability mappings (interface only) --------
addProviderToMatrix({ capability: "planner", provider: { id: "gemini", displayName: "Gemini", vendor: "Google", costCategory: "low", supportsStreaming: true }, priority: 90 });
addProviderToMatrix({ capability: "planner", provider: { id: "openai", displayName: "OpenAI", vendor: "OpenAI", costCategory: "medium", supportsStreaming: true }, priority: 80 });
addProviderToMatrix({ capability: "planner", provider: { id: "claude", displayName: "Claude", vendor: "Anthropic", costCategory: "medium", supportsStreaming: true }, priority: 70 });
addProviderToMatrix({ capability: "planner", provider: { id: "local", displayName: "Local Model", vendor: "self-hosted", costCategory: "free" }, priority: 40 });

addProviderToMatrix({ capability: "weather", provider: { id: "open-meteo", displayName: "Open-Meteo", costCategory: "free" }, priority: 80 });
addProviderToMatrix({ capability: "weather", provider: { id: "openweather", displayName: "OpenWeather", costCategory: "low" }, priority: 70 });
addProviderToMatrix({ capability: "weather", provider: { id: "tomorrow", displayName: "Tomorrow.io", costCategory: "medium" }, priority: 60 });
addProviderToMatrix({ capability: "weather", provider: { id: "weatherapi", displayName: "WeatherAPI", costCategory: "low" }, priority: 50 });

addProviderToMatrix({ capability: "flights", provider: { id: "amadeus", displayName: "Amadeus", costCategory: "high" }, priority: 80 });
addProviderToMatrix({ capability: "flights", provider: { id: "duffel", displayName: "Duffel", costCategory: "high" }, priority: 70 });

addProviderToMatrix({ capability: "maps", provider: { id: "mapbox", displayName: "Mapbox", costCategory: "medium" }, priority: 80 });
addProviderToMatrix({ capability: "maps", provider: { id: "osm", displayName: "OpenStreetMap", costCategory: "free" }, priority: 60 });
