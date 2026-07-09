/**
 * PromptExecutor — provider-independent execution with retries, timeouts,
 * cancellation, streaming and backpressure.
 */
import { CancellationError, RetryExceededError, StreamingError } from "./errors";
import type { PromptEventPublisher } from "./events";
import type { PromptMetrics } from "./metrics";
import { METRIC_NAMES } from "./metrics";
import type { RetryPolicy, StreamingPolicy, TimeoutPolicy } from "./config";
import type {
  CompiledPrompt,
  ExecutionOptions,
  ExecutionResult,
  ProviderAdapter,
  ProviderChunk,
  ProviderResponse,
} from "./types";

export interface ExecutorOptions {
  provider: ProviderAdapter;
  publisher: PromptEventPublisher;
  metrics: PromptMetrics;
  retry: RetryPolicy;
  timeout: TimeoutPolicy;
  streaming: StreamingPolicy;
}

export class PromptExecutor {
  constructor(private readonly opts: ExecutorOptions) {}

  async execute(prompt: CompiledPrompt, exec: ExecutionOptions = {}): Promise<ExecutionResult> {
    const signal = exec.signal;
    const started = Date.now();
    let attempt = 0;
    let lastError: unknown;
    const maxAttempts = exec.maxRetries ?? this.opts.retry.maxAttempts;

    while (attempt < maxAttempts) {
      attempt++;
      this.throwIfAborted(signal);
      try {
        const response = exec.stream && this.opts.provider.stream && this.opts.streaming.enabled
          ? await this.runStream(prompt, exec)
          : await this.runOnce(prompt, exec);
        this.opts.metrics.counter(METRIC_NAMES.runsTotal).inc();
        this.opts.metrics.histogram(METRIC_NAMES.latencyMs).observe(Date.now() - started);
        this.opts.metrics.counter(METRIC_NAMES.tokensInput).inc(response.usage.inputTokens);
        this.opts.metrics.counter(METRIC_NAMES.tokensOutput).inc(response.usage.outputTokens);
        return {
          correlationId: prompt.metadata.correlationId,
          promptId: prompt.promptId,
          version: prompt.version,
          fingerprint: prompt.fingerprint,
          content: response.content,
          usage: response.usage,
          cached: false,
          durationMs: Date.now() - started,
          finishReason: response.finishReason,
        };
      } catch (err) {
        lastError = err;
        if (err instanceof CancellationError) throw err;
        if (attempt >= maxAttempts) break;
        await this.backoff(attempt, signal);
      }
    }
    this.opts.metrics.counter(METRIC_NAMES.runsFailed).inc();
    throw new RetryExceededError(attempt, lastError);
  }

  private async runOnce(prompt: CompiledPrompt, exec: ExecutionOptions): Promise<ProviderResponse> {
    const timeoutMs = exec.timeoutMs ?? this.opts.timeout.executeMs;
    return withTimeout(this.opts.provider.execute(prompt, exec), timeoutMs, exec.signal);
  }

  private async runStream(prompt: CompiledPrompt, exec: ExecutionOptions): Promise<ProviderResponse> {
    if (!this.opts.provider.stream) {
      throw new StreamingError("Provider does not support streaming");
    }
    const it = this.opts.provider.stream(prompt, exec);
    const chunks: string[] = [];
    let bytes = 0;
    let index = 0;
    let finishReason: ExecutionResult["finishReason"] = "stop";
    this.opts.publisher.publish("PromptStreamStarted", { promptId: prompt.promptId }, {
      correlationId: prompt.metadata.correlationId,
      promptId: prompt.promptId,
      version: prompt.version,
      stage: "streaming",
    });

    const idleMs = this.opts.timeout.streamIdleMs;
    let lastChunkAt = Date.now();
    try {
      for await (const chunk of it) {
        this.throwIfAborted(exec.signal);
        if (Date.now() - lastChunkAt > idleMs) {
          throw new StreamingError(`Stream idle timeout (${idleMs}ms)`);
        }
        lastChunkAt = Date.now();
        chunks.push(chunk.delta);
        bytes += chunk.delta.length;
        this.opts.metrics.counter(METRIC_NAMES.streamChunks).inc();
        this.opts.publisher.publish<ProviderChunk>(
          "PromptChunkReceived",
          chunk,
          {
            correlationId: prompt.metadata.correlationId,
            promptId: prompt.promptId,
            version: prompt.version,
            stage: "streaming",
          },
        );
        // Cooperative backpressure — yield to the event loop periodically.
        if (bytes >= this.opts.streaming.backpressureBytes) {
          bytes = 0;
          await new Promise((r) => setTimeout(r, 0));
        }
        index = chunk.index;
        if (chunk.finished) break;
      }
    } catch (err) {
      if (err instanceof CancellationError) throw err;
      throw err instanceof StreamingError ? err : new StreamingError((err as Error).message, undefined, err);
    }
    void index;
    const content = chunks.join("");
    this.opts.publisher.publish("PromptStreamCompleted", { promptId: prompt.promptId, length: content.length }, {
      correlationId: prompt.metadata.correlationId,
      promptId: prompt.promptId,
      version: prompt.version,
      stage: "streaming",
    });
    return {
      content,
      usage: { inputTokens: prompt.estimatedTokens, outputTokens: Math.ceil(content.length / 4), totalTokens: 0, costEstimate: 0 },
      finishReason,
    };
  }

  private throwIfAborted(signal?: AbortSignal): void {
    if (signal?.aborted) throw new CancellationError("execution");
  }

  private async backoff(attempt: number, signal?: AbortSignal): Promise<void> {
    const { baseDelayMs, maxDelayMs, jitter } = this.opts.retry;
    const raw = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
    const delay = jitter ? Math.floor(raw * (0.5 + Math.random() * 0.5)) : raw;
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, delay);
      if (signal) {
        const onAbort = () => { clearTimeout(t); reject(new CancellationError("execution")); };
        if (signal.aborted) onAbort();
        else signal.addEventListener("abort", onAbort, { once: true });
      }
    });
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new StreamingError(`Execution timeout (${ms}ms)`)), ms);
    const onAbort = () => { clearTimeout(t); reject(new CancellationError("execution")); };
    if (signal) {
      if (signal.aborted) return onAbort();
      signal.addEventListener("abort", onAbort, { once: true });
    }
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}
