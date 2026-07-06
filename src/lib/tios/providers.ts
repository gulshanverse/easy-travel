/**
 * TIOS Provider Abstraction.
 * External providers (flights APIs, hotels APIs, weather, maps, etc.) must
 * register here. TIOS selects a provider by capability + policy + health and
 * emits failover events when the primary is down.
 */
import { emitTIOSEvent, makeRequestId } from "./events";
import type { CapabilityId, HealthStatus } from "./types";

export interface ProviderAdapter<TInput = unknown, TOutput = unknown> {
  id: string;
  capability: CapabilityId;
  priority: number;                 // higher wins
  health: HealthStatus;
  call: (input: TInput) => Promise<TOutput>;
}

const providers = new Map<string, ProviderAdapter>();

export function registerProvider<TIn, TOut>(p: ProviderAdapter<TIn, TOut>): void {
  providers.set(p.id, p as unknown as ProviderAdapter);
}

export function unregisterProvider(id: string): void {
  providers.delete(id);
}

export function listProviders(capability?: CapabilityId): ProviderAdapter[] {
  return Array.from(providers.values())
    .filter((p) => !capability || p.capability === capability)
    .sort((a, b) => b.priority - a.priority);
}

export function setProviderHealth(id: string, health: HealthStatus): void {
  const p = providers.get(id);
  if (p) p.health = health;
}

/**
 * Call the highest-priority healthy provider for a capability.
 * Falls back through the ordered list and emits FAILOVER_OCCURRED on retry.
 */
export async function callCapabilityProvider<TIn, TOut>(
  capability: CapabilityId,
  input: TIn,
  requestId = makeRequestId("prov"),
): Promise<TOut> {
  const candidates = listProviders(capability).filter((p) => p.health !== "down");
  if (candidates.length === 0) throw new Error(`TIOS: no provider available for ${capability}`);

  let lastError: unknown;
  for (let i = 0; i < candidates.length; i++) {
    const p = candidates[i] as ProviderAdapter<TIn, TOut>;
    try {
      emitTIOSEvent({
        name: "PROVIDER_SELECTED",
        requestId,
        timestamp: Date.now(),
        capability,
        data: { providerId: p.id, attempt: i + 1 },
      });
      return await p.call(input);
    } catch (err) {
      lastError = err;
      setProviderHealth(p.id, "degraded");
      if (i < candidates.length - 1) {
        emitTIOSEvent({
          name: "FAILOVER_OCCURRED",
          requestId,
          timestamp: Date.now(),
          capability,
          data: { failed: p.id, next: candidates[i + 1]?.id },
        });
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
