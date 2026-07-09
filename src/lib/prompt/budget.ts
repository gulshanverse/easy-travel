/**
 * PromptBudgetManager — trims and compresses fragments to fit token budgets.
 * Provider-independent. Uses estimateTokens() as a rough proxy.
 */
import { BudgetExceededError, ContextOverflowError } from "./errors";
import { estimateTokens } from "./ids";
import type { PromptFragment, TokenBudget } from "./types";

export interface FragmentCompressor {
  /** Return a shorter version of the content or null to abstain. */
  compress(fragment: PromptFragment, targetTokens: number): PromptFragment | null;
}

/** Default compressor: truncates to targetTokens*4 chars with an ellipsis marker. */
export class TruncationCompressor implements FragmentCompressor {
  compress(fragment: PromptFragment, targetTokens: number): PromptFragment | null {
    const targetChars = Math.max(80, targetTokens * 4);
    if (fragment.content.length <= targetChars) return null;
    const trimmed = fragment.content.slice(0, targetChars - 20).trimEnd() + " …[trimmed]";
    return { ...fragment, content: trimmed, estimatedTokens: estimateTokens(trimmed) };
  }
}

export interface BudgetPlan {
  fragments: PromptFragment[];
  totalTokens: number;
  budget: TokenBudget;
  droppedIds: string[];
  compressedIds: string[];
  overflow: boolean;
}

export class PromptBudgetManager {
  constructor(
    private readonly defaults: TokenBudget,
    private readonly compressor: FragmentCompressor = new TruncationCompressor(),
    private readonly compressionThreshold = 0.85,
  ) {}

  resolveBudget(override?: Partial<TokenBudget>): TokenBudget {
    return { ...this.defaults, ...(override ?? {}) };
  }

  estimateFragmentTokens(fragments: PromptFragment[]): number {
    return fragments.reduce(
      (sum, f) => sum + (f.estimatedTokens ?? estimateTokens(f.content)),
      0,
    );
  }

  estimateCost(inputTokens: number, outputTokens: number, perThousand = 0.002): number {
    return ((inputTokens + outputTokens) / 1000) * perThousand;
  }

  /**
   * Enforce budget. Order of operations:
   *   1. If below soft budget → accept.
   *   2. If above soft but below hard + adaptiveSlack → accept.
   *   3. Compress low-priority fragments until below soft*compressionThreshold.
   *   4. Drop lowest-priority fragments until below hard-reservedOutput.
   *   5. If still overflowing → ContextOverflowError.
   */
  enforce(fragments: PromptFragment[], override?: Partial<TokenBudget>): BudgetPlan {
    const budget = this.resolveBudget(override);
    const maxInput = budget.hard - budget.reservedOutput;
    if (maxInput <= 0) throw new BudgetExceededError(0, budget.hard);

    let working: PromptFragment[] = fragments.map((f) => ({
      ...f,
      estimatedTokens: f.estimatedTokens ?? estimateTokens(f.content),
    }));

    const droppedIds: string[] = [];
    const compressedIds: string[] = [];

    let total = this.estimateFragmentTokens(working);
    if (total <= budget.soft) {
      return { fragments: working, totalTokens: total, budget, droppedIds, compressedIds, overflow: false };
    }

    if (total <= budget.hard + budget.adaptiveSlack && total <= maxInput) {
      return { fragments: working, totalTokens: total, budget, droppedIds, compressedIds, overflow: false };
    }

    // Compression phase. Sort by priority ASC — trim low-priority first.
    const compressionTarget = Math.floor(budget.soft * this.compressionThreshold);
    const sortedForCompress = [...working].sort((a, b) => a.priority - b.priority);
    for (const frag of sortedForCompress) {
      if (total <= compressionTarget) break;
      const shrink = this.compressor.compress(frag, Math.max(20, Math.floor((frag.estimatedTokens ?? 0) / 2)));
      if (!shrink) continue;
      const before = frag.estimatedTokens ?? 0;
      const idx = working.findIndex((f) => f.id === frag.id);
      if (idx >= 0) {
        working[idx] = shrink;
        compressedIds.push(frag.id);
        total = total - before + (shrink.estimatedTokens ?? 0);
      }
    }

    // Drop phase.
    if (total > maxInput) {
      const dropOrder = [...working].sort((a, b) => a.priority - b.priority);
      for (const frag of dropOrder) {
        if (total <= maxInput) break;
        // Never drop system-critical fragments (priority >= 100).
        if (frag.priority >= 100) continue;
        working = working.filter((f) => f.id !== frag.id);
        droppedIds.push(frag.id);
        total -= frag.estimatedTokens ?? 0;
      }
    }

    if (total > maxInput) {
      throw new ContextOverflowError({
        totalTokens: total, maxInput, droppedIds, compressedIds,
      });
    }

    return { fragments: working, totalTokens: total, budget, droppedIds, compressedIds, overflow: false };
  }
}
