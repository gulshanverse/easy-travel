/**
 * Provider Runtime — Health monitoring + Circuit breaker.
 */
import type { CircuitBreakerPolicy, HealthPolicy } from "./config";
import { defaultProviderEventPublisher, type ProviderEventPublisher } from "./events";
import type { ProviderRegistry } from "./registry";
import type { ProviderHealthSnapshot, ProviderHealthState, ProviderId } from "./types";

type CircuitState = "closed" | "open" | "half-open";

interface HealthEntry {
  providerId: ProviderId;
  state: ProviderHealthState;
  circuit: CircuitState;
  successStreak: number;
  failureStreak: number;
  lastLatencyMs?: number;
  lastCheckedAt: number;
  cooldownUntil?: number;
  halfOpenProbesRemaining: number;
  reason?: string;
}

export class ProviderHealthManager {
  private readonly entries = new Map<ProviderId, HealthEntry>();
  private readonly now: () => number;

  constructor(
    private readonly health: HealthPolicy,
    private readonly circuit: CircuitBreakerPolicy,
    private readonly publisher: ProviderEventPublisher = defaultProviderEventPublisher,
    now?: () => number,
  ) {
    this.now = now ?? (() => Date.now());
  }

  ensure(id: ProviderId): HealthEntry {
    let e = this.entries.get(id);
    if (!e) {
      e = {
        providerId: id,
        state: "unknown",
        circuit: "closed",
        successStreak: 0,
        failureStreak: 0,
        lastCheckedAt: 0,
        halfOpenProbesRemaining: 0,
      };
      this.entries.set(id, e);
    }
    return e;
  }

  snapshot(id: ProviderId): ProviderHealthSnapshot {
    const e = this.ensure(id);
    return {
      providerId: e.providerId,
      state: e.state,
      circuit: e.circuit,
      successStreak: e.successStreak,
      failureStreak: e.failureStreak,
      lastLatencyMs: e.lastLatencyMs,
      lastCheckedAt: e.lastCheckedAt,
      cooldownUntil: e.cooldownUntil,
      reason: e.reason,
    };
  }

  snapshotAll(): readonly ProviderHealthSnapshot[] {
    return [...this.entries.values()].map((e) => this.snapshot(e.providerId));
  }

  isAvailable(id: ProviderId): boolean {
    const e = this.ensure(id);
    this.maybeExitCooldown(e);
    if (e.circuit === "open") return false;
    return e.state !== "unavailable";
  }

  async recordSuccess(id: ProviderId, latencyMs: number): Promise<void> {
    const e = this.ensure(id);
    const prev = e.state;
    e.lastLatencyMs = latencyMs;
    e.lastCheckedAt = this.now();
    e.failureStreak = 0;
    e.successStreak += 1;
    e.reason = undefined;

    if (e.circuit === "half-open") {
      if (e.successStreak >= this.circuit.successThreshold) {
        e.circuit = "closed";
        e.halfOpenProbesRemaining = 0;
        await this.publisher.publish({
          name: "CircuitClosed",
          correlationId: id,
          data: { providerId: id },
        });
      }
    }

    let next: ProviderHealthState = "healthy";
    if (latencyMs >= this.health.latencyUnavailableMs) next = "unavailable";
    else if (latencyMs >= this.health.latencyDegradedMs) next = "degraded";

    if (next !== prev) {
      e.state = next;
      await this.publisher.publish({
        name: next === "healthy" || next === "degraded" ? "ProviderRecovered" : "HealthChanged",
        correlationId: id,
        data: { providerId: id, previous: prev, next },
      });
    } else {
      e.state = next;
    }
  }

  async recordFailure(id: ProviderId, reason: string, latencyMs?: number): Promise<void> {
    const e = this.ensure(id);
    const prev = e.state;
    e.lastLatencyMs = latencyMs;
    e.lastCheckedAt = this.now();
    e.successStreak = 0;
    e.failureStreak += 1;
    e.reason = reason;

    if (e.circuit === "closed" && e.failureStreak >= this.circuit.failureThreshold) {
      e.circuit = "open";
      e.cooldownUntil = this.now() + this.circuit.openCooldownMs;
      e.state = "unavailable";
      await this.publisher.publish({
        name: "CircuitOpened",
        correlationId: id,
        data: { providerId: id, reason, cooldownUntil: e.cooldownUntil },
      });
      await this.publisher.publish({
        name: "ProviderUnavailable",
        correlationId: id,
        data: { providerId: id, previous: prev, next: e.state, reason },
      });
      return;
    }

    if (e.circuit === "half-open") {
      e.circuit = "open";
      e.cooldownUntil = this.now() + this.circuit.openCooldownMs;
      e.state = "unavailable";
      await this.publisher.publish({
        name: "CircuitOpened",
        correlationId: id,
        data: { providerId: id, reason, cooldownUntil: e.cooldownUntil },
      });
      return;
    }

    const next: ProviderHealthState = "degraded";
    if (next !== prev) {
      e.state = next;
      await this.publisher.publish({
        name: "HealthChanged",
        correlationId: id,
        data: { providerId: id, previous: prev, next, reason },
      });
    }
  }

  private maybeExitCooldown(e: HealthEntry): void {
    if (e.circuit === "open" && e.cooldownUntil && this.now() >= e.cooldownUntil) {
      e.circuit = "half-open";
      e.halfOpenProbesRemaining = this.circuit.halfOpenProbes;
      e.cooldownUntil = undefined;
      void this.publisher.publish({
        name: "CircuitHalfOpen",
        correlationId: e.providerId,
        data: { providerId: e.providerId },
      });
    }
  }

  /** Force a state (test hook). */
  reset(id?: ProviderId): void {
    if (id) this.entries.delete(id);
    else this.entries.clear();
  }

  async heartbeat(registry: ProviderRegistry): Promise<void> {
    for (const entry of registry.list()) {
      const started = this.now();
      try {
        const snap = await entry.adapter.ping({});
        const latency = (snap.lastLatencyMs ?? this.now() - started);
        if (snap.state === "unavailable") {
          await this.recordFailure(entry.config.id, snap.reason ?? "ping unavailable", latency);
        } else if (snap.state === "unknown") {
          this.ensure(entry.config.id).lastCheckedAt = this.now();
        } else {
          await this.recordSuccess(entry.config.id, latency);
        }
      } catch (err) {
        await this.recordFailure(entry.config.id, (err as Error).message, this.now() - started);
      }
    }
  }
}
