/**
 * Trust & Evidence Engine — provenance & lineage tracking.
 * Tracks origin, custody chain, and version history in-memory only.
 */
import type { Evidence, EvidenceVersion } from "./types";

export interface ProvenanceRecord {
  readonly evidenceId: string;
  readonly originSourceId: string;
  readonly collectedAt: number;
  readonly versions: readonly EvidenceVersion[];
  readonly chainOfCustody: readonly string[];
}

export class ProvenanceStore {
  private readonly records = new Map<string, ProvenanceRecord>();

  register(evidence: Evidence): ProvenanceRecord {
    const rec: ProvenanceRecord = Object.freeze({
      evidenceId: evidence.id,
      originSourceId: evidence.sourceId,
      collectedAt: evidence.collectedAt,
      versions: Object.freeze([
        Object.freeze({
          evidenceId: evidence.id,
          version: evidence.version,
          at: evidence.collectedAt,
          diffSummary: "initial",
        }),
      ]),
      chainOfCustody: Object.freeze([...evidence.lineage.chainOfCustody, evidence.sourceId]),
    });
    this.records.set(evidence.id, rec);
    return rec;
  }

  recordUpdate(previous: Evidence, next: Evidence, diffSummary: string): ProvenanceRecord {
    const existing = this.records.get(previous.id);
    const baseVersions = existing?.versions ?? [];
    const rec: ProvenanceRecord = Object.freeze({
      evidenceId: next.id,
      originSourceId: existing?.originSourceId ?? next.sourceId,
      collectedAt: existing?.collectedAt ?? next.collectedAt,
      versions: Object.freeze([
        ...baseVersions,
        Object.freeze({
          evidenceId: next.id,
          version: next.version,
          at: next.collectedAt,
          diffSummary,
        }),
      ]),
      chainOfCustody: Object.freeze([...(existing?.chainOfCustody ?? []), next.sourceId]),
    });
    this.records.set(next.id, rec);
    return rec;
  }

  get(evidenceId: string): ProvenanceRecord | undefined {
    return this.records.get(evidenceId);
  }
  size(): number { return this.records.size; }
  clear(): void { this.records.clear(); }
}
