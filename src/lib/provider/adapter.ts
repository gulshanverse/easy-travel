/**
 * Provider Runtime — Adapter contract.
 *
 * A ProviderAdapter is a thin, provider-independent bridge to an external
 * AI provider. This sprint ships the CONTRACT ONLY — no vendor SDKs are
 * imported and no external API calls are made. Concrete adapters are
 * delivered in later sprints.
 */
import type { ResolvedCredential } from "./credentials";
import type {
  ExecutionRequest,
  ExecutionResult,
  ModelDescriptor,
  ProviderConfig,
  ProviderHealthSnapshot,
  StreamChunk,
  TokenUsage,
} from "./types";

export interface AdapterContext {
  credential?: ResolvedCredential;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface ProviderAdapter {
  readonly config: ProviderConfig;

  /** Advertise models exposed by this provider. */
  listModels(): Promise<readonly ModelDescriptor[]>;

  /** Lightweight heartbeat used by health monitor. */
  ping(ctx: AdapterContext): Promise<ProviderHealthSnapshot>;

  /** Estimate token usage for a request (before execution). */
  estimateUsage(model: ModelDescriptor, payload: unknown): TokenUsage;

  /** Execute a non-streaming request. */
  execute<T = unknown>(
    model: ModelDescriptor,
    request: ExecutionRequest,
    ctx: AdapterContext,
  ): Promise<ExecutionResult<T>>;

  /** Execute a streaming request. Optional — omit if provider does not stream. */
  stream?<T = unknown>(
    model: ModelDescriptor,
    request: ExecutionRequest,
    ctx: AdapterContext,
  ): AsyncIterable<StreamChunk<T>>;

  /** Optional lifecycle hooks. */
  onRegister?(): Promise<void> | void;
  onDispose?(): Promise<void> | void;
}
