/**
 * Provider Runtime — Router.
 * Produces an ordered fallback chain from the selector's candidates.
 */
import type { ProviderSelector, SelectionCandidate } from "./selector";
import type { FallbackPolicy } from "./config";
import type { ExecutionRequest, ProviderId } from "./types";

export interface RoutingPlan {
  primary: SelectionCandidate;
  fallbacks: readonly SelectionCandidate[];
  all: readonly SelectionCandidate[];
}

export class ProviderRouter {
  constructor(
    private readonly selector: ProviderSelector,
    private readonly fallback: FallbackPolicy,
  ) {}

  plan(request: ExecutionRequest, excludeProviders: readonly ProviderId[] = []): RoutingPlan {
    const ordered = this.selector.select(request, excludeProviders);
    const maxFallbacks = this.fallback.enabled ? this.fallback.maxFallbacks : 0;
    const seenProviders = new Set<ProviderId>();
    const deduped: SelectionCandidate[] = [];
    for (const c of ordered) {
      if (seenProviders.has(c.providerId)) continue;
      seenProviders.add(c.providerId);
      deduped.push(c);
      if (deduped.length > maxFallbacks + 1) break;
    }
    const [primary, ...fallbacks] = deduped;
    return { primary: primary!, fallbacks, all: deduped };
  }
}
