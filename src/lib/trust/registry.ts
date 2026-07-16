/**
 * Trust & Evidence Engine — Source & Evidence registries.
 * In-memory only; no persistence.
 */
import { UnknownEvidenceError, UnknownSourceError } from "./errors";
import { validateEvidence, validateSource } from "./validation";
import type { Evidence, EvidenceSource } from "./types";

export class SourceRegistry {
  private readonly sources = new Map<string, EvidenceSource>();
  register(source: EvidenceSource): EvidenceSource {
    validateSource(source);
    this.sources.set(source.id, source);
    return source;
  }
  invalidate(sourceId: string, at: number): EvidenceSource {
    const s = this.sources.get(sourceId);
    if (!s) throw new UnknownSourceError(sourceId);
    const next = Object.freeze({ ...s, invalidatedAt: at });
    this.sources.set(sourceId, next);
    return next;
  }
  get(sourceId: string): EvidenceSource | undefined { return this.sources.get(sourceId); }
  require(sourceId: string): EvidenceSource {
    const s = this.sources.get(sourceId);
    if (!s) throw new UnknownSourceError(sourceId);
    return s;
  }
  list(): readonly EvidenceSource[] { return Array.from(this.sources.values()); }
  has(sourceId: string): boolean { return this.sources.has(sourceId); }
  ids(): ReadonlySet<string> { return new Set(this.sources.keys()); }
  size(): number { return this.sources.size; }
  clear(): void { this.sources.clear(); }
}

export class EvidenceRegistry {
  private readonly evidence = new Map<string, Evidence>();
  private readonly bySubject = new Map<string, Set<string>>();

  add(evidence: Evidence, sourceIds: ReadonlySet<string>): Evidence {
    validateEvidence(evidence, sourceIds);
    this.evidence.set(evidence.id, evidence);
    let set = this.bySubject.get(evidence.subject);
    if (!set) { set = new Set(); this.bySubject.set(evidence.subject, set); }
    set.add(evidence.id);
    return evidence;
  }
  get(id: string): Evidence | undefined { return this.evidence.get(id); }
  require(id: string): Evidence {
    const e = this.evidence.get(id);
    if (!e) throw new UnknownEvidenceError(id);
    return e;
  }
  remove(id: string): void {
    const e = this.evidence.get(id);
    if (!e) return;
    this.evidence.delete(id);
    this.bySubject.get(e.subject)?.delete(id);
  }
  forSubject(subject: string): readonly Evidence[] {
    const ids = this.bySubject.get(subject);
    if (!ids) return [];
    const out: Evidence[] = [];
    for (const id of ids) {
      const e = this.evidence.get(id);
      if (e) out.push(e);
    }
    return out;
  }
  size(): number { return this.evidence.size; }
  subjects(): readonly string[] { return Array.from(this.bySubject.keys()); }
  all(): readonly Evidence[] { return Array.from(this.evidence.values()); }
  clear(): void { this.evidence.clear(); this.bySubject.clear(); }
}
