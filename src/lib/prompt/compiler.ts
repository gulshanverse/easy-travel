/**
 * PromptCompiler — deterministic compilation of PromptIR → CompiledPrompt.
 *
 * - Merges consecutive same-role fragments.
 * - Normalises whitespace.
 * - Computes stable fingerprint (order-independent hash of messages + schema).
 */
import { CompilationError } from "./errors";
import { canonicalJson, estimateTokens, stableHash } from "./ids";
import type {
  CompiledMessage,
  CompiledPrompt,
  PromptIR,
  TokenBudget,
} from "./types";

export interface CompileOptions {
  budget: TokenBudget;
  deterministic?: boolean;
}

export class PromptCompiler {
  compile(ir: PromptIR, opts: CompileOptions): CompiledPrompt {
    if (!ir.fragments.length) {
      throw new CompilationError("Cannot compile empty PromptIR");
    }
    const messages = this.mergeMessages(ir);
    const normalised = messages.map((m) => ({
      role: m.role,
      content: normaliseWhitespace(m.content),
    }));
    const fingerprintSource = canonicalJson({
      pid: ir.promptId,
      ver: ir.version,
      messages: normalised,
      schema: ir.outputSchema?.schema ?? null,
    });
    const fingerprint = stableHash(fingerprintSource);
    const estimated = normalised.reduce((s, m) => s + estimateTokens(m.content), 0);
    return {
      promptId: ir.promptId,
      version: ir.version,
      fingerprint,
      messages: Object.freeze(normalised),
      outputSchema: ir.outputSchema,
      estimatedTokens: estimated,
      budget: opts.budget,
      metadata: ir.metadata,
    };
  }

  private mergeMessages(ir: PromptIR): CompiledMessage[] {
    const out: CompiledMessage[] = [];
    for (const f of ir.fragments) {
      const last = out[out.length - 1];
      if (last && last.role === f.role) {
        last.content = `${last.content}\n\n${f.content}`.trim();
      } else {
        out.push({ role: f.role, content: f.content });
      }
    }
    return out;
  }
}

function normaliseWhitespace(s: string): string {
  return s.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
