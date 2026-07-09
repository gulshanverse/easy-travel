/**
 * Runtime Core — Capability Runtime.
 *
 * Registers, discovers, validates, and executes capabilities. A capability
 * is a versioned unit of work with an input schema (validator), lifecycle
 * hooks, and an execute() function. This sprint intentionally ships NO
 * business capabilities — only the runtime that future engines plug into.
 */

import type { ExecutionContext } from "./context";
import type { RuntimeConfiguration } from "./config";
import { CapabilityError, CancellationError, TimeoutError, ValidationError } from "./errors";
import type { EventBus, EventMap } from "./event-bus";
import type { RuntimeMetrics } from "./metrics";
import { defaultRuntimeMetrics } from "./metrics";
import type { RuntimeTelemetry } from "./telemetry";
import { defaultRuntimeTelemetry } from "./telemetry";

export type CapabilityLifecycleState =
  | "registered"
  | "initializing"
  | "ready"
  | "running"
  | "disposed"
  | "failed";

export interface CapabilityMetadata {
  readonly id: string;
  readonly version: string;
  readonly tags?: readonly string[];
  readonly description?: string;
  readonly timeoutMs?: number;
}

export interface Capability<Input = unknown, Output = unknown> {
  readonly metadata: CapabilityMetadata;
  validate?(input: unknown): Input;
  onInit?(): Promise<void> | void;
  onDispose?(): Promise<void> | void;
  execute(input: Input, ctx: ExecutionContext): Promise<Output> | Output;
}

export interface CapabilityRuntimeOptions {
  eventBus?: EventBus<CapabilityRuntimeEvents>;
  metrics?: RuntimeMetrics;
  telemetry?: RuntimeTelemetry;
  config?: Pick<RuntimeConfiguration, "policies" | "safety" | "capabilityToggles">;
}

export interface CapabilityRuntimeEvents extends EventMap {
  "capability.registered": { id: string; version: string };
  "capability.unregistered": { id: string };
  "capability.executed": {
    id: string;
    version: string;
    ms: number;
    ok: boolean;
    error?: string;
  };
}

interface Entry<Input, Output> {
  capability: Capability<Input, Output>;
  state: CapabilityLifecycleState;
  registeredAt: number;
  lastError?: Error;
  runs: number;
  totalMs: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;

export class CapabilityRuntime {
  private entries = new Map<string, Entry<unknown, unknown>>();
  private inflight = 0;
  private readonly eventBus?: EventBus<CapabilityRuntimeEvents>;
  private readonly metrics: RuntimeMetrics;
  private readonly telemetry: RuntimeTelemetry;
  private readonly maxConcurrent: number;
  private readonly defaultTimeoutMs: number;
  private readonly strict: boolean;
  private readonly toggles: Readonly<Record<string, boolean>>;

  constructor(opts: CapabilityRuntimeOptions = {}) {
    this.eventBus = opts.eventBus;
    this.metrics = opts.metrics ?? defaultRuntimeMetrics;
    this.telemetry = opts.telemetry ?? defaultRuntimeTelemetry;
    this.maxConcurrent = opts.config?.policies.maxConcurrentCapabilities ?? 32;
    this.defaultTimeoutMs = opts.config?.policies.defaultCapabilityTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.strict = opts.config?.safety.strictCapabilityValidation ?? true;
    this.toggles = opts.config?.capabilityToggles ?? {};
  }

  async register<Input, Output>(capability: Capability<Input, Output>): Promise<void> {
    const id = capability.metadata.id;
    if (!id) throw new ValidationError("Capability metadata.id required");
    if (this.entries.has(id)) throw new CapabilityError(`Capability '${id}' already registered`);
    const entry: Entry<Input, Output> = {
      capability,
      state: "initializing",
      registeredAt: Date.now(),
      runs: 0,
      totalMs: 0,
    };
    this.entries.set(id, entry as Entry<unknown, unknown>);
    try {
      await capability.onInit?.();
      entry.state = "ready";
      this.metrics.incr("runtime.capability.registered", 1, { id });
      await this.eventBus?.publish("capability.registered", {
        id,
        version: capability.metadata.version,
      });
    } catch (err) {
      entry.state = "failed";
      entry.lastError = err as Error;
      throw new CapabilityError(`Failed to initialize capability '${id}'`, { cause: err });
    }
  }

  async unregister(id: string): Promise<boolean> {
    const entry = this.entries.get(id);
    if (!entry) return false;
    try {
      await entry.capability.onDispose?.();
    } finally {
      entry.state = "disposed";
      this.entries.delete(id);
      await this.eventBus?.publish("capability.unregistered", { id });
    }
    return true;
  }

  list(): readonly CapabilityMetadata[] {
    return [...this.entries.values()].map((e) => e.capability.metadata);
  }

  get(id: string): CapabilityMetadata | undefined {
    return this.entries.get(id)?.capability.metadata;
  }

  health(): Record<string, { state: CapabilityLifecycleState; runs: number; avgMs: number }> {
    const out: Record<string, { state: CapabilityLifecycleState; runs: number; avgMs: number }> = {};
    for (const [id, e] of this.entries) {
      out[id] = { state: e.state, runs: e.runs, avgMs: e.runs === 0 ? 0 : e.totalMs / e.runs };
    }
    return out;
  }

  async execute<Input, Output>(
    id: string,
    input: Input,
    ctx: ExecutionContext,
  ): Promise<Output> {
    const entry = this.entries.get(id) as Entry<Input, Output> | undefined;
    if (!entry) throw new CapabilityError(`Capability '${id}' not registered`);
    if (this.toggles[id] === false) {
      throw new CapabilityError(`Capability '${id}' disabled by configuration`);
    }
    if (entry.state !== "ready" && entry.state !== "running") {
      throw new CapabilityError(`Capability '${id}' not ready (state=${entry.state})`);
    }
    if (this.inflight >= this.maxConcurrent) {
      throw new CapabilityError("Capability runtime backpressure: max concurrent reached", {
        retryable: true,
      });
    }
    if (ctx.capability.deny.includes(id)) {
      throw new CapabilityError(`Capability '${id}' denied by context`);
    }
    if (ctx.capability.allow.length > 0 && !ctx.capability.allow.includes(id)) {
      throw new CapabilityError(`Capability '${id}' not in allow-list for context`);
    }

    let validated: Input = input;
    if (entry.capability.validate) {
      try {
        validated = entry.capability.validate(input);
      } catch (err) {
        if (this.strict) throw new ValidationError(`Invalid input for '${id}'`, { cause: err });
      }
    }

    const timeoutMs = entry.capability.metadata.timeoutMs ?? this.defaultTimeoutMs;
    this.inflight += 1;
    entry.state = "running";
    const started = Date.now();
    try {
      const output = await this.telemetry.span(
        `capability:${id}`,
        (span) => {
          span.setAttr("capability.id", id);
          span.setAttr("capability.version", entry.capability.metadata.version);
          return withTimeout(
            Promise.resolve(entry.capability.execute(validated, ctx)),
            timeoutMs,
            ctx.signal,
            id,
          );
        },
        { requestId: ctx.requestId, correlationId: ctx.correlationId },
      );
      const ms = Date.now() - started;
      entry.runs += 1;
      entry.totalMs += ms;
      this.metrics.incr("runtime.capability.exec", 1, { id, ok: "true" });
      this.metrics.observe("runtime.capability.exec_ms", ms, { id });
      await this.eventBus?.publish("capability.executed", {
        id, version: entry.capability.metadata.version, ms, ok: true,
      }, { correlationId: ctx.correlationId, causationId: ctx.requestId });
      return output;
    } catch (err) {
      const ms = Date.now() - started;
      entry.lastError = err as Error;
      this.metrics.incr("runtime.capability.exec", 1, { id, ok: "false" });
      this.metrics.observe("runtime.capability.exec_ms", ms, { id });
      await this.eventBus?.publish("capability.executed", {
        id, version: entry.capability.metadata.version, ms, ok: false,
        error: (err as Error).message,
      }, { correlationId: ctx.correlationId, causationId: ctx.requestId });
      throw err;
    } finally {
      entry.state = "ready";
      this.inflight -= 1;
    }
  }

  inflightCount(): number { return this.inflight; }
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  signal: AbortSignal,
  capabilityId: string,
): Promise<T> {
  if (signal.aborted) throw new CancellationError();
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TimeoutError(`Capability '${capabilityId}' timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new CancellationError());
    };
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (v) => { clearTimeout(timer); signal.removeEventListener("abort", onAbort); resolve(v); },
      (e) => { clearTimeout(timer); signal.removeEventListener("abort", onAbort); reject(e); },
    );
  });
}
