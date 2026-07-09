/**
 * Memory Engine — Metrics (counters, timings, gauges).
 * In-memory snapshot; can be scraped or shipped to any collector.
 */
import type { MemoryClass, RetrievalPurpose } from "./types";

export interface MemoryMetricsSnapshot {
  writes: number;
  reads: number;
  retrievals: number;
  archived: number;
  softDeleted: number;
  hardDeleted: number;
  promotions: number;
  compressions: number;
  contradictions: number;
  degradedRetrievals: number;
  byClass: Record<string, number>;
  retrievalLatencyMs: number[];
  writeLatencyMs: number[];
  retrievalByPurpose: Record<string, number>;
  errors: Record<string, number>;
}

export class MemoryMetrics {
  private m: MemoryMetricsSnapshot = fresh();

  incWrite(cls: MemoryClass, latencyMs: number): void {
    this.m.writes += 1;
    this.m.byClass[cls] = (this.m.byClass[cls] ?? 0) + 1;
    this.m.writeLatencyMs.push(latencyMs);
    trimSample(this.m.writeLatencyMs);
  }
  incRead(): void { this.m.reads += 1; }
  incRetrieval(purpose: RetrievalPurpose, latencyMs: number, degraded: boolean): void {
    this.m.retrievals += 1;
    this.m.retrievalByPurpose[purpose] = (this.m.retrievalByPurpose[purpose] ?? 0) + 1;
    this.m.retrievalLatencyMs.push(latencyMs);
    trimSample(this.m.retrievalLatencyMs);
    if (degraded) this.m.degradedRetrievals += 1;
  }
  incArchived(): void { this.m.archived += 1; }
  incSoftDeleted(): void { this.m.softDeleted += 1; }
  incHardDeleted(): void { this.m.hardDeleted += 1; }
  incPromotion(): void { this.m.promotions += 1; }
  incCompression(): void { this.m.compressions += 1; }
  incContradiction(): void { this.m.contradictions += 1; }
  incError(code: string): void { this.m.errors[code] = (this.m.errors[code] ?? 0) + 1; }

  snapshot(): MemoryMetricsSnapshot {
    return {
      ...this.m,
      byClass: { ...this.m.byClass },
      retrievalLatencyMs: [...this.m.retrievalLatencyMs],
      writeLatencyMs: [...this.m.writeLatencyMs],
      retrievalByPurpose: { ...this.m.retrievalByPurpose },
      errors: { ...this.m.errors },
    };
  }

  reset(): void { this.m = fresh(); }
}

function fresh(): MemoryMetricsSnapshot {
  return {
    writes: 0, reads: 0, retrievals: 0, archived: 0,
    softDeleted: 0, hardDeleted: 0, promotions: 0, compressions: 0,
    contradictions: 0, degradedRetrievals: 0,
    byClass: {}, retrievalLatencyMs: [], writeLatencyMs: [],
    retrievalByPurpose: {}, errors: {},
  };
}

function trimSample(arr: number[], max = 1024): void {
  if (arr.length > max) arr.splice(0, arr.length - max);
}

export const defaultMemoryMetrics = new MemoryMetrics();
