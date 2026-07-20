/** CTOR — Tool runtime (invoker, resolver, lifecycle). */
import { ToolNotFoundError } from "./errors";
import { newInvocationId } from "./ids";
import type { ToolExecutionRecord, ToolInput, ToolOutput } from "./types";
import type { ToolRegistry } from "./registry";
import { validateToolInput } from "./validation";
import type { CTOREventBus } from "./events";
import type { CTORMetrics } from "./metrics";
import type { CTORTelemetrySink } from "./telemetry";

export interface ToolInvokerDeps {
  readonly registry: ToolRegistry;
  readonly events: CTOREventBus;
  readonly metrics: CTORMetrics;
  readonly telemetry: CTORTelemetrySink;
  readonly now?: () => number;
}

export interface ToolInvokeOptions {
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
}

export class ToolInvoker {
  constructor(private readonly deps: ToolInvokerDeps) {}
  private readonly records: ToolExecutionRecord[] = [];

  async invoke(id: string, input: ToolInput, opts: ToolInvokeOptions = {}): Promise<ToolOutput> {
    const tool = this.deps.registry.get(id);
    const impl = this.deps.registry.getImpl(id);
    if (!impl) throw new ToolNotFoundError(`${id} (no impl)`);
    validateToolInput(tool, input);
    const now = this.deps.now ?? Date.now;
    const invocationId = newInvocationId();
    const startedAt = now();
    let ok = false; let error: string | undefined; let output: unknown;
    try {
      const p = Promise.resolve(impl(input));
      output = opts.timeoutMs
        ? await Promise.race([
            p,
            new Promise((_, rej) => setTimeout(() => rej(new Error(`Tool timeout after ${opts.timeoutMs}ms`)), opts.timeoutMs)),
          ])
        : await p;
      ok = true;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      throw e;
    } finally {
      const endedAt = now();
      const rec: ToolExecutionRecord = Object.freeze({ toolId: id, invocationId, startedAt, endedAt, ok, error });
      this.records.push(rec);
      if (this.records.length > 512) this.records.shift();
      this.deps.registry.recordInvocation(id, ok, endedAt - startedAt);
      this.deps.metrics.toolInvoked(ok);
      this.deps.telemetry.record({ kind: "trace", level: ok ? "info" : "error", message: `tool:${id}`, timestamp: endedAt, attributes: { invocationId, ok, ms: endedAt - startedAt } });
      this.deps.events.emit({ name: "ToolInvoked", correlationId: opts.correlationId, causationId: opts.causationId, data: { toolId: id, invocationId, ok, error } });
    }
    return output as ToolOutput;
  }
  history(): readonly ToolExecutionRecord[] { return [...this.records]; }
}
