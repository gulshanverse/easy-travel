/**
 * Provider Runtime — Vendor adapter stubs.
 *
 * These are CONTRACT-ONLY skeletons. Every adapter implements the same
 * `ProviderAdapter` interface. Vendor SDK wiring and external API calls
 * are explicitly OUT OF SCOPE for Sprint I-004 and are delivered later.
 *
 * A stub answers ping() with an "unknown" state and throws
 * `ProviderUnavailableError` from execute()/stream() until an
 * integration sprint replaces it. The runtime, routing, health, and
 * fallback subsystems can be exercised end-to-end using in-memory test
 * adapters (see tests/provider/runtime.test.ts) without any stub ever
 * being invoked.
 */
import type { ProviderAdapter, AdapterContext } from "../adapter";
import { ProviderUnavailableError } from "../errors";
import type {
  ExecutionRequest,
  ExecutionResult,
  ModelDescriptor,
  ProviderConfig,
  ProviderHealthSnapshot,
  ProviderKind,
  StreamChunk,
  TokenUsage,
} from "../types";

/** Reference base class that satisfies the adapter contract with safe defaults. */
export abstract class BaseProviderAdapterStub implements ProviderAdapter {
  constructor(readonly config: ProviderConfig) {}

  abstract listModels(): Promise<readonly ModelDescriptor[]>;

  async ping(_ctx: AdapterContext): Promise<ProviderHealthSnapshot> {
    return {
      providerId: this.config.id,
      state: "unknown",
      circuit: "closed",
      successStreak: 0,
      failureStreak: 0,
      lastCheckedAt: Date.now(),
      reason: "adapter stub — not integrated",
    };
  }

  estimateUsage(_model: ModelDescriptor, _payload: unknown): TokenUsage {
    return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  }

  async execute<T = unknown>(
    _model: ModelDescriptor,
    _request: ExecutionRequest,
    _ctx: AdapterContext,
  ): Promise<ExecutionResult<T>> {
    throw new ProviderUnavailableError(
      `Adapter '${this.config.kind}' is a contract stub; integration deferred`,
      { metadata: { providerId: this.config.id, kind: this.config.kind } },
    );
  }

  async *stream<T = unknown>(
    _model: ModelDescriptor,
    _request: ExecutionRequest,
    _ctx: AdapterContext,
  ): AsyncIterable<StreamChunk<T>> {
    throw new ProviderUnavailableError(
      `Adapter '${this.config.kind}' streaming is a contract stub; integration deferred`,
      { metadata: { providerId: this.config.id, kind: this.config.kind } },
    );
    // eslint-disable-next-line no-unreachable
    yield { kind: "finish" };
  }
}

class GenericStub extends BaseProviderAdapterStub {
  async listModels(): Promise<readonly ModelDescriptor[]> { return []; }
}

export class OpenAIAdapterStub extends GenericStub {}
export class AnthropicAdapterStub extends GenericStub {}
export class GeminiAdapterStub extends GenericStub {}
export class GroqAdapterStub extends GenericStub {}
export class NvidiaAdapterStub extends GenericStub {}
export class OllamaAdapterStub extends GenericStub {}
export class OpenRouterAdapterStub extends GenericStub {}
export class AzureOpenAIAdapterStub extends GenericStub {}
export class LocalProviderAdapterStub extends GenericStub {}
export class CustomProviderAdapterStub extends GenericStub {}

export const AdapterStubByKind: Record<ProviderKind, new (cfg: ProviderConfig) => ProviderAdapter> = {
  openai: OpenAIAdapterStub,
  anthropic: AnthropicAdapterStub,
  gemini: GeminiAdapterStub,
  groq: GroqAdapterStub,
  nvidia: NvidiaAdapterStub,
  ollama: OllamaAdapterStub,
  openrouter: OpenRouterAdapterStub,
  "azure-openai": AzureOpenAIAdapterStub,
  local: LocalProviderAdapterStub,
  custom: CustomProviderAdapterStub,
};
