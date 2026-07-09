/**
 * PromptRuntime — top-level facade wiring together every subsystem.
 * Consumers only interact with this class; internal wiring is invisible.
 */
import { PromptAssembler } from "./assembler";
import { PromptBudgetManager } from "./budget";
import { PromptCache } from "./cache";
import { PromptCompiler } from "./compiler";
import { PromptContextAssembler, type MemoryPort } from "./context-assembler";
import { PromptExecutor } from "./executor";
import { PromptHealthChecks } from "./health";
import { PromptPipeline } from "./pipeline";
import { PromptRegistry } from "./registry";
import { PromptRepairEngine } from "./repair";
import { PromptTemplateRegistry } from "./templates";
import { PromptValidator } from "./validator";
import { PromptVersionManager } from "./versioning";
import type { PromptConfiguration } from "./config";
import { loadPromptConfiguration } from "./config";
import type { PromptEventPublisher } from "./events";
import { defaultPromptEventPublisher, InMemoryPromptEventPublisher } from "./events";
import type { PromptMetrics } from "./metrics";
import { defaultPromptMetrics, InMemoryPromptMetrics } from "./metrics";
import type { PromptTelemetry } from "./telemetry";
import { defaultPromptTelemetry, NoopTelemetry } from "./telemetry";
import type {
  ExecutionResult,
  ProviderAdapter,
  PromptRequest,
} from "./types";

export interface PromptRuntimeOptions {
  config?: Partial<PromptConfiguration>;
  provider: ProviderAdapter;
  memory?: MemoryPort;
  publisher?: PromptEventPublisher;
  telemetry?: PromptTelemetry;
  metrics?: PromptMetrics;
  registry?: PromptRegistry;
  templates?: PromptTemplateRegistry;
  contextAssembler?: PromptContextAssembler;
}

export class PromptRuntime {
  readonly config: PromptConfiguration;
  readonly publisher: PromptEventPublisher;
  readonly telemetry: PromptTelemetry;
  readonly metrics: PromptMetrics;
  readonly registry: PromptRegistry;
  readonly templates: PromptTemplateRegistry;
  readonly versions: PromptVersionManager;
  readonly cache: PromptCache;
  readonly budget: PromptBudgetManager;
  readonly compiler: PromptCompiler;
  readonly assembler: PromptAssembler;
  readonly contextAssembler: PromptContextAssembler;
  readonly validator: PromptValidator;
  readonly repair: PromptRepairEngine;
  readonly executor: PromptExecutor;
  readonly pipeline: PromptPipeline;
  readonly health: PromptHealthChecks;

  constructor(opts: PromptRuntimeOptions) {
    this.config = loadPromptConfiguration(opts.config);
    this.publisher = opts.publisher ?? new InMemoryPromptEventPublisher();
    this.telemetry = opts.telemetry ?? new NoopTelemetry();
    this.metrics = opts.metrics ?? new InMemoryPromptMetrics();
    this.registry = opts.registry ?? new PromptRegistry();
    this.templates = opts.templates ?? new PromptTemplateRegistry();
    this.versions = new PromptVersionManager();
    this.cache = new PromptCache(this.config.cache);
    this.budget = new PromptBudgetManager(
      this.config.budget.default,
      undefined,
      this.config.budget.compressionThreshold,
    );
    this.compiler = new PromptCompiler();
    this.assembler = new PromptAssembler();
    this.contextAssembler = opts.contextAssembler ?? new PromptContextAssembler({ memory: opts.memory });
    this.validator = new PromptValidator();
    this.repair = new PromptRepairEngine(this.validator, this.config.validation.maxRepairAttempts);
    this.executor = new PromptExecutor({
      provider: opts.provider,
      publisher: this.publisher,
      metrics: this.metrics,
      retry: this.config.retry,
      timeout: this.config.timeout,
      streaming: this.config.streaming,
    });
    this.pipeline = new PromptPipeline({
      registry: this.registry,
      contextAssembler: this.contextAssembler,
      assembler: this.assembler,
      compiler: this.compiler,
      validator: this.validator,
      repair: this.repair,
      budget: this.budget,
      cache: this.cache,
      executor: this.executor,
      publisher: this.publisher,
      telemetry: this.telemetry,
      metrics: this.metrics,
    });
    this.health = new PromptHealthChecks(this.registry, this.cache, this.metrics);
  }

  run<T = unknown>(request: PromptRequest): Promise<ExecutionResult<T>> {
    return this.pipeline.run<T>(request);
  }
}

/** Convenience: build a runtime backed by all in-memory defaults. */
export function createDefaultPromptRuntime(provider: ProviderAdapter): PromptRuntime {
  return new PromptRuntime({
    provider,
    publisher: defaultPromptEventPublisher,
    telemetry: defaultPromptTelemetry,
    metrics: defaultPromptMetrics,
  });
}
