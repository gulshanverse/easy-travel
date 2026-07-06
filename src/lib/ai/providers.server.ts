/**
 * AI Core — Provider Router.
 * Frontend and callers never know which provider is used.
 * Today all models flow through the Lovable AI Gateway; new providers plug in
 * behind the same LanguageModelHandle interface.
 */
import { createLovableAiGatewayProvider } from "./gateway.server";
import { AIProviderError } from "./errors";
import { resolveModel, type ModelId } from "./config";

export interface LanguageModelHandle {
  modelId: ModelId;
  /** The AI SDK LanguageModel instance to hand to generateText/streamText. */
  model: unknown;
  /** Response header capture for gateway run ids. */
  getRunId: () => string | undefined;
  waitForRunId: () => Promise<string | undefined>;
}

export interface RouterOptions {
  initialRunId?: string;
  structuredOutputs?: boolean;
}

/**
 * Resolve a model id to a concrete provider-backed LanguageModelHandle.
 * All routing decisions live here; callers stay provider-agnostic.
 */
export function routeModel(modelId: ModelId, opts: RouterOptions = {}): LanguageModelHandle {
  const profile = resolveModel(modelId);
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new AIProviderError("LOVABLE_API_KEY is not configured");

  switch (profile.provider) {
    case "lovable": {
      // Enable strict json_schema when the caller needs structured output on OpenAI.
      const gateway = createLovableAiGatewayProvider(key, opts.initialRunId, {
        structuredOutputs: opts.structuredOutputs && profile.id.startsWith("openai/"),
      });
      return {
        modelId: profile.id,
        model: gateway(profile.id),
        getRunId: gateway.getRunId,
        waitForRunId: gateway.waitForRunId,
      };
    }
    default:
      throw new AIProviderError(`Provider not implemented: ${profile.provider}`);
  }
}
