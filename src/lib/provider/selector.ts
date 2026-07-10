/**
 * Provider Runtime — Provider + Model selection.
 * Deterministic scoring based on capability, health, latency, cost, weight, affinity.
 */
import { matchesCapabilities } from "./capabilities";
import type { ProviderHealthManager } from "./health";
import type { ModelRegistry } from "./model-registry";
import type { ProviderRegistry } from "./registry";
import { ProviderRoutingError } from "./errors";
import type {
  ExecutionRequest,
  LatencyTier,
  ModelDescriptor,
  ProviderId,
} from "./types";

export interface SelectionCandidate {
  providerId: ProviderId;
  model: ModelDescriptor;
  score: number;
  reasons: string[];
}

const LATENCY_SCORE: Record<LatencyTier, number> = { realtime: 100, low: 80, medium: 60, high: 30 };
const COST_SCORE: Record<string, number> = { free: 100, cheap: 80, standard: 60, premium: 30, enterprise: 15 };

export class ProviderSelector {
  constructor(
    private readonly providers: ProviderRegistry,
    private readonly models: ModelRegistry,
    private readonly health: ProviderHealthManager,
  ) {}

  select(request: ExecutionRequest, excludeProviders: readonly ProviderId[] = []): readonly SelectionCandidate[] {
    const excluded = new Set(excludeProviders);
    const candidates: SelectionCandidate[] = [];

    const stickyKey = request.sessionId;
    const explicitModel = request.requestedModel ? this.models.get(request.requestedModel) : undefined;

    for (const p of this.providers.list()) {
      if (excluded.has(p.config.id)) continue;
      if (p.state !== "ready") continue;
      if (p.config.enabled === false) continue;
      if (!this.health.isAvailable(p.config.id)) continue;
      if (request.requestedProvider && request.requestedProvider !== p.config.id) continue;

      const providerModels = explicitModel
        ? (explicitModel.providerId === p.config.id ? [explicitModel] : [])
        : this.models.listByProvider(p.config.id);

      for (const model of providerModels) {
        if (model.status !== "active") continue;
        if (!matchesCapabilities(model, request.requires)) continue;
        if (request.minContextWindow && model.contextWindow < request.minContextWindow) continue;

        const reasons: string[] = [];
        let score = 0;

        score += LATENCY_SCORE[model.latencyTier] ?? 50;
        score += COST_SCORE[model.costTier] ?? 50;
        score += (p.config.weight ?? 1) * 10;
        score += (p.config.priority ?? 0) * 5;

        const snap = this.health.snapshot(p.config.id);
        if (snap.state === "healthy") { score += 25; reasons.push("healthy"); }
        else if (snap.state === "degraded") { score -= 15; reasons.push("degraded"); }

        if (stickyKey && p.config.metadata && (p.config.metadata as Record<string, unknown>).affinity === stickyKey) {
          score += 40; reasons.push("sticky-affinity");
        }

        for (const rule of request.routing ?? []) {
          if (rule.preferProviders?.includes(p.config.id)) { score += (rule.weight ?? 30); reasons.push(`prefer:${rule.id}`); }
          if (rule.preferModels?.includes(model.id)) { score += (rule.weight ?? 30); reasons.push(`preferModel:${rule.id}`); }
          if (rule.strategy === "latency" && LATENCY_SCORE[model.latencyTier] >= 80) { score += 10; }
          if (rule.strategy === "cost" && (COST_SCORE[model.costTier] ?? 0) >= 80) { score += 10; }
          if (rule.strategy === "weighted") { score += (rule.weight ?? 0); }
        }

        candidates.push({ providerId: p.config.id, model, score, reasons });
      }
    }

    if (candidates.length === 0) {
      throw new ProviderRoutingError("No compatible provider available for request", {
        metadata: { requires: request.requires, requestedProvider: request.requestedProvider },
      });
    }

    return candidates.sort((a, b) => b.score - a.score);
  }
}
