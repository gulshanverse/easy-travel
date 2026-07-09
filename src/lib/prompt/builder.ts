/**
 * PromptBuilder — fluent builder for constructing PromptRequest values.
 * Purely presentational — no side effects.
 */
import { newCorrelationId } from "./ids";
import type {
  AssembledContext,
  OutputSchema,
  PromptId,
  PromptRequest,
  PromptVersion,
  TokenBudget,
} from "./types";

export class PromptBuilder {
  private request: PromptRequest;

  constructor(promptId: PromptId) {
    this.request = {
      promptId,
      correlationId: newCorrelationId(),
    };
  }

  static for(promptId: PromptId): PromptBuilder {
    return new PromptBuilder(promptId);
  }

  version(v: PromptVersion): this { this.request.version = v; return this; }
  userInput(text: string): this { this.request.userInput = text; return this; }
  variable(k: string, v: unknown): this {
    this.request.variables = { ...(this.request.variables ?? {}), [k]: v };
    return this;
  }
  variables(vars: Record<string, unknown>): this {
    this.request.variables = { ...(this.request.variables ?? {}), ...vars };
    return this;
  }
  correlate(id: string, causationId?: string, traceId?: string): this {
    this.request.correlationId = id;
    if (causationId) this.request.causationId = causationId;
    if (traceId) this.request.traceId = traceId;
    return this;
  }
  overrideContext(ctx: Partial<AssembledContext>): this {
    this.request.contextOverrides = { ...(this.request.contextOverrides ?? {}), ...ctx };
    return this;
  }
  outputSchema(schema: OutputSchema): this { this.request.outputSchema = schema; return this; }
  budget(b: Partial<TokenBudget>): this { this.request.budget = { ...(this.request.budget ?? {}), ...b }; return this; }
  provider(hint: string): this { this.request.providerHint = hint; return this; }
  signal(s: AbortSignal): this { this.request.signal = s; return this; }

  build(): PromptRequest { return { ...this.request }; }
}
