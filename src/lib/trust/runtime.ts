/**
 * Trust & Evidence Engine — TrustRuntime facade.
 * The ONLY sanctioned entry point outside this package.
 */
import { mergeConfig, type TrustConfig } from "./config";
import { TrustEventBus, type TrustEventListener } from "./events";
import { createTrustManager } from "./factory";
import { collectHealth, type TrustHealthDeps, type TrustHealthReport } from "./health";
import { TrustManager } from "./manager";
import { TrustMetrics, type TrustMetricsSnapshot } from "./metrics";
import type {
  TrustDecisionPort, TrustGraphPort, TrustJourneyPort, TrustKernelPort,
  TrustMemoryPort, TrustPromptPort, TrustProviderPort,
} from "./ports";
import { TrustRegistry } from "./registry-runtime";
import { noopTelemetry, type TrustTelemetrySink } from "./telemetry";
import type {
  Evidence, EvidenceConflict, EvidenceScore, EvidenceSnapshot, EvidenceSource,
  TrustDecision, TrustHistoryEntry, TrustScore, TrustSnapshot,
} from "./types";

export interface TrustRuntimeOptions {
  readonly config?: Partial<TrustConfig>;
  readonly telemetry?: TrustTelemetrySink;
  readonly ports?: {
    readonly memory?: TrustMemoryPort;
    readonly graph?: TrustGraphPort;
    readonly journey?: TrustJourneyPort;
    readonly decision?: TrustDecisionPort;
    readonly prompt?: TrustPromptPort;
    readonly provider?: TrustProviderPort;
    readonly kernel?: TrustKernelPort;
  };
  readonly now?: () => number;
}

export class TrustRuntime {
  readonly events = new TrustEventBus();
  readonly metrics = new TrustMetrics();
  readonly registry = new TrustRegistry();
  readonly manager: TrustManager;
  readonly config: TrustConfig;
  private readonly telemetry: TrustTelemetrySink;
  private readonly portDeps: TrustHealthDeps;

  constructor(options: TrustRuntimeOptions = {}) {
    this.config = mergeConfig(options.config);
    this.telemetry = options.telemetry ?? noopTelemetry;
    this.portDeps = options.ports ?? {};
    this.manager = createTrustManager({
      config: this.config,
      telemetry: this.telemetry,
      events: this.events,
      metrics: this.metrics,
      now: options.now ?? (() => Date.now()),
    });
    this.registry.register("default", this.manager);
  }

  /* ---------- Evidence & sources ---------- */
  registerSource(source: EvidenceSource): EvidenceSource { return this.manager.registerSource(source); }
  invalidateSource(id: string): EvidenceSource { return this.manager.invalidateSource(id); }
  addEvidence(evidence: Evidence): Evidence { return this.manager.addEvidence(evidence); }
  updateEvidence(prev: Evidence, next: Evidence, note?: string): Evidence {
    return this.manager.updateEvidence(prev, next, note);
  }
  rejectEvidence(id: string, reason: string): void { this.manager.rejectEvidence(id, reason); }

  /* ---------- Trust queries ---------- */
  computeTrust(subject: string): TrustScore { return this.manager.computeTrust(subject); }
  decide(subject: string, policyId?: string): TrustDecision { return this.manager.decide(subject, policyId); }
  scoreEvidenceForSubject(subject: string): readonly EvidenceScore[] {
    return this.manager.scoreBundle(this.manager.bundleFor(subject));
  }
  historyFor(subject: string): readonly TrustHistoryEntry[] { return this.manager.historyFor(subject); }

  /* ---------- Conflicts ---------- */
  listConflicts(): readonly EvidenceConflict[] { return this.manager.listConflicts(); }
  resolveConflict(id: string, resolution: string): void { this.manager.resolveConflict(id, resolution); }

  /* ---------- Snapshots ---------- */
  snapshot(): EvidenceSnapshot { return this.manager.snapshot(); }
  trustSnapshot(subjects: readonly string[]): TrustSnapshot { return this.manager.trustSnapshot(subjects); }

  /* ---------- Observability ---------- */
  metricsSnapshot(): TrustMetricsSnapshot { return this.metrics.snapshot(); }
  onEvent(listener: TrustEventListener): () => void { return this.events.on(listener); }
  health(): Promise<TrustHealthReport> { return collectHealth(this.manager, this.portDeps); }
}

export function createTrustRuntime(options: TrustRuntimeOptions = {}): TrustRuntime {
  return new TrustRuntime(options);
}
