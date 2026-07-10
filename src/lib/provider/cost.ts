/**
 * Provider Runtime — Token & cost accounting.
 */
import { ProviderBudgetError } from "./errors";
import type { ModelDescriptor, TokenBudget, TokenUsage } from "./types";

/** Rough token estimator (~4 chars/token for latin). Replaced by tokenizer-backed estimator later. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

export function estimatePayloadTokens(payload: unknown): number {
  if (payload == null) return 0;
  if (typeof payload === "string") return estimateTokens(payload);
  try {
    return estimateTokens(JSON.stringify(payload));
  } catch {
    return 0;
  }
}

export function computeCost(model: ModelDescriptor, usage: TokenUsage): number | undefined {
  const pricing = model.pricing;
  if (!pricing) return undefined;
  const inputCost = (usage.inputTokens / 1000) * pricing.inputPer1kTokens;
  const outputCost = (usage.outputTokens / 1000) * pricing.outputPer1kTokens;
  return Number((inputCost + outputCost).toFixed(6));
}

export function assertBudget(model: ModelDescriptor, usage: TokenUsage, budget?: TokenBudget): void {
  if (!budget) return;
  if (budget.maxInputTokens != null && usage.inputTokens > budget.maxInputTokens) {
    throw new ProviderBudgetError(`Input tokens ${usage.inputTokens} exceed budget ${budget.maxInputTokens}`);
  }
  if (budget.maxOutputTokens != null && usage.outputTokens > budget.maxOutputTokens) {
    throw new ProviderBudgetError(`Output tokens ${usage.outputTokens} exceed budget ${budget.maxOutputTokens}`);
  }
  if (budget.maxTotalTokens != null && usage.totalTokens > budget.maxTotalTokens) {
    throw new ProviderBudgetError(`Total tokens ${usage.totalTokens} exceed budget ${budget.maxTotalTokens}`);
  }
  if (budget.maxCost != null) {
    const cost = computeCost(model, usage);
    if (cost != null && cost > budget.maxCost) {
      throw new ProviderBudgetError(`Cost ${cost} exceeds budget ${budget.maxCost}`);
    }
  }
}

export function assertUsageWithinContextWindow(model: ModelDescriptor, usage: TokenUsage): void {
  if (usage.totalTokens > model.contextWindow) {
    throw new ProviderBudgetError(
      `Estimated tokens ${usage.totalTokens} exceed context window ${model.contextWindow} for model '${model.id}'`,
    );
  }
}

export interface UsageStats {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCost: number;
  perProvider: Record<string, { requests: number; tokens: number; cost: number }>;
  perModel: Record<string, { requests: number; tokens: number; cost: number }>;
}

export class UsageTracker {
  private stats: UsageStats = {
    totalRequests: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalTokens: 0,
    totalCost: 0,
    perProvider: {},
    perModel: {},
  };

  record(providerId: string, modelId: string, usage: TokenUsage): void {
    this.stats.totalRequests += 1;
    this.stats.totalInputTokens += usage.inputTokens;
    this.stats.totalOutputTokens += usage.outputTokens;
    this.stats.totalTokens += usage.totalTokens;
    if (usage.costEstimate) this.stats.totalCost += usage.costEstimate;

    const p = this.stats.perProvider[providerId] ?? { requests: 0, tokens: 0, cost: 0 };
    p.requests += 1; p.tokens += usage.totalTokens; p.cost += usage.costEstimate ?? 0;
    this.stats.perProvider[providerId] = p;

    const m = this.stats.perModel[modelId] ?? { requests: 0, tokens: 0, cost: 0 };
    m.requests += 1; m.tokens += usage.totalTokens; m.cost += usage.costEstimate ?? 0;
    this.stats.perModel[modelId] = m;
  }

  snapshot(): UsageStats {
    return JSON.parse(JSON.stringify(this.stats)) as UsageStats;
  }

  forecast(perRequestUsage: TokenUsage, expectedRequests: number, model?: ModelDescriptor): number {
    const cost = model ? computeCost(model, perRequestUsage) : perRequestUsage.costEstimate;
    return (cost ?? 0) * expectedRequests;
  }
}
