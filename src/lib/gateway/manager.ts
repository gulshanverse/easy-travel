import { GatewayPipeline } from "./pipeline";
import { ProviderGatewayError } from "./errors";
import type { ProviderRegistry, ProviderResolver } from "./registry";
import type { ProviderRequest, ProviderResponse } from "./types";

export interface GatewayManagerDependencies {
  readonly registry: ProviderRegistry;
  readonly resolver: ProviderResolver;
  readonly pipeline: GatewayPipeline;
}

export interface GatewayInvocationResult {
  readonly response: ProviderResponse;
  readonly providerId: string;
  readonly attempts: number;
}

export class ProviderGatewayManager {
  constructor(private readonly deps: GatewayManagerDependencies) {}

  async invoke(request: ProviderRequest): Promise<GatewayInvocationResult> {
    const environment = request.environment ?? "test";
    const route = this.deps.resolver.route({
      capability: request.capability,
      environment,
      ...(request.region ? { region: request.region } : {}),
      ...(request.providerId ? { providerId: request.providerId } : {}),
      sandboxOnly: request.sandbox ?? environment !== "production",
    });

    const candidates = [route.primary, ...route.fallbacks];
    let lastError: unknown;

    for (let index = 0; index < candidates.length; index++) {
      const providerId = candidates[index]!;
      const entry = this.deps.registry.require(providerId);
      const fallback = index > 0;
      const capability = entry.provider.capabilities.find((cap) => cap.id === request.capability);
      const idempotent = capability?.idempotent ?? false;

      if (fallback && !entry.provider.policy.failoverAllowed) continue;
      if (fallback && !idempotent && !entry.provider.policy.allowNonIdempotentFailover) continue;

      try {
        const outcome = await this.deps.pipeline.run(entry, request, { fallbackUsed: fallback });
        return { response: outcome.response, providerId, attempts: outcome.attempts };
      } catch (error) {
        lastError = error;
        if (!(error instanceof ProviderGatewayError && error.retryable)) break;
      }
    }

    if (lastError instanceof ProviderGatewayError) throw lastError;
    throw new ProviderGatewayError("provider gateway request failed");
  }
}
