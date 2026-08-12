/** Provider Gateway (P-1.4) — adapter contract + deterministic mock providers.
 *  Provider-specific code lives ONLY behind this contract. Adapters with no
 *  credentials/API access stay fail-closed; nothing is fabricated.
 */
import type { AppliedAuthentication } from "./credentials";
import { ProviderUnavailableError } from "./errors";
import type {
  Provider,
  ProviderCapability,
  ProviderEnvironment,
  ProviderHealth,
  ProviderId,
} from "./types";

export interface AdapterInvocation {
  readonly capability: string;
  readonly operation: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly correlationId: string;
  readonly auth: AppliedAuthentication;
  readonly signal?: AbortSignal;
  readonly timeoutMs: number;
}

export interface ProviderAdapter {
  readonly provider: Provider;
  /** Raw provider result — normalized by the gateway before it escapes. */
  execute(invocation: AdapterInvocation): Promise<unknown>;
  healthCheck(): Promise<ProviderHealth>;
  /** Actual cost when the provider reports it. */
  actualCost?(raw: unknown): number | undefined;
  onRegister?(): Promise<void> | void;
  onDispose?(): Promise<void> | void;
}

/** Adapter that refuses to run because credentials/API access are absent. */
export class FailClosedAdapter implements ProviderAdapter {
  constructor(
    readonly provider: Provider,
    private readonly reason = "provider credentials or API access unavailable",
  ) {}
  async execute(): Promise<never> {
    throw new ProviderUnavailableError(`${this.provider.id}: ${this.reason}`, {
      providerId: this.provider.id,
    });
  }
  async healthCheck(): Promise<ProviderHealth> {
    return Object.freeze({
      status: "unhealthy" as const,
      availability: "unavailable" as const,
      circuit: "closed" as const,
      failureStreak: 0,
      successStreak: 0,
      lastCheckedAt: Date.now(),
      reason: this.reason,
    });
  }
}

/* ------------------------------------------------------------------ */
/* Mock providers                                                      */
/* ------------------------------------------------------------------ */

export interface MockBehaviour {
  /** Deterministic simulated latency in ms (no real waiting by default). */
  readonly latencyMs?: number;
  readonly failEveryNth?: number;
  readonly timeoutEveryNth?: number;
  readonly rateLimitEveryNth?: number;
  readonly degradeAfter?: number;
}

const ENVIRONMENTS: readonly ProviderEnvironment[] = ["test", "sandbox"];

export function mockCapability(
  id: string,
  category: Provider["category"],
  overrides: Partial<ProviderCapability> = {},
): ProviderCapability {
  return Object.freeze({
    id,
    category,
    version: "1.0.0",
    operations: ["search"],
    inputFields: ["query"],
    outputFields: ["results"],
    idempotent: true,
    cacheable: true,
    requiresAuth: false,
    environments: ENVIRONMENTS,
    limits: {},
    ...overrides,
  });
}

/** Deterministic, network-free, credential-free mock provider. */
export class MockProviderAdapter implements ProviderAdapter {
  private calls = 0;
  constructor(
    readonly provider: Provider,
    private readonly behaviour: MockBehaviour = {},
    private readonly datasetFactory?: (inv: AdapterInvocation) => unknown,
  ) {}

  callCount(): number {
    return this.calls;
  }

  async execute(invocation: AdapterInvocation): Promise<unknown> {
    this.calls++;
    const n = this.calls;
    const b = this.behaviour;
    if (b.rateLimitEveryNth && n % b.rateLimitEveryNth === 0)
      throw new (await import("./errors")).ProviderRateLimitedError(
        `${this.provider.id} simulated rate limit`,
        { providerId: this.provider.id },
      );
    if (b.timeoutEveryNth && n % b.timeoutEveryNth === 0)
      throw new (await import("./errors")).ProviderTimeoutError(
        `${this.provider.id} simulated timeout`,
        { providerId: this.provider.id },
      );
    if (b.failEveryNth && n % b.failEveryNth === 0)
      throw new (await import("./errors")).ProviderTemporaryFailureError(
        `${this.provider.id} simulated failure`,
        { providerId: this.provider.id },
      );
    if (b.latencyMs) await new Promise((r) => setTimeout(r, b.latencyMs));
    if (this.datasetFactory) return this.datasetFactory(invocation);
    const query = invocation.payload["query"] ?? null;
    return {
      query,
      results: [
        {
          id: `${this.provider.id}-1`,
          capability: invocation.capability,
          operation: invocation.operation,
          score: 1,
        },
        {
          id: `${this.provider.id}-2`,
          capability: invocation.capability,
          operation: invocation.operation,
          score: 2,
        },
      ],
    };
  }

  async healthCheck(): Promise<ProviderHealth> {
    const degraded = this.behaviour.degradeAfter !== undefined && this.calls > this.behaviour.degradeAfter;
    return Object.freeze({
      status: degraded ? ("degraded" as const) : ("healthy" as const),
      availability: degraded ? ("limited" as const) : ("available" as const),
      circuit: "closed" as const,
      failureStreak: 0,
      successStreak: this.calls,
      lastCheckedAt: Date.now(),
    });
  }
}

export const MOCK_PROVIDER_IDS: readonly ProviderId[] = Object.freeze([
  "mock-railway",
  "mock-flight",
  "mock-hotel",
  "mock-maps",
  "mock-weather",
  "mock-currency",
  "mock-timezone",
  "mock-transit",
]);
