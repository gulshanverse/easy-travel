/**
 * Trust & Evidence Engine — pure factory helpers.
 * All entities are frozen at construction to enforce immutability.
 */
import { newBundleId, newEvidenceId, newSnapshotId, newSourceId } from "./ids";
import type {
  Evidence, EvidenceBundle, EvidenceLineage, EvidenceMetadata, EvidenceReference,
  EvidenceSnapshot, EvidenceSource, SourceCategory, EvidenceKind,
} from "./types";

export function freezeDeep<T>(v: T): T {
  if (v && typeof v === "object" && !Object.isFrozen(v)) Object.freeze(v);
  return v;
}

export function makeMetadata(input: Partial<EvidenceMetadata> = {}): EvidenceMetadata {
  return Object.freeze({
    locale: input.locale,
    region: input.region,
    domain: input.domain,
    tags: Object.freeze([...(input.tags ?? [])]),
    attributes: Object.freeze({ ...(input.attributes ?? {}) }),
  });
}

export function makeLineage(input: Partial<EvidenceLineage> = {}): EvidenceLineage {
  return Object.freeze({
    parentIds: Object.freeze([...(input.parentIds ?? [])]),
    transformations: Object.freeze([...(input.transformations ?? [])]),
    chainOfCustody: Object.freeze([...(input.chainOfCustody ?? [])]),
  });
}

export interface MakeSourceInput {
  name: string;
  category: SourceCategory;
  authority: number;
  reliability: number;
  region?: string;
  language?: string;
  supportedDomains?: readonly string[];
  version?: string;
  trustPolicyIds?: readonly string[];
  now?: number;
  id?: string;
}
export function makeSource(input: MakeSourceInput): EvidenceSource {
  const now = input.now ?? Date.now();
  return Object.freeze({
    id: input.id ?? newSourceId(),
    name: input.name,
    category: input.category,
    authority: input.authority,
    reliability: input.reliability,
    region: input.region,
    language: input.language,
    supportedDomains: Object.freeze([...(input.supportedDomains ?? [])]),
    version: input.version ?? "1.0.0",
    trustPolicyIds: Object.freeze([...(input.trustPolicyIds ?? [])]),
    registeredAt: now,
  });
}

export interface MakeEvidenceInput {
  sourceId: string;
  kind: EvidenceKind;
  subject: string;
  claim: string;
  value?: unknown;
  collectedAt?: number;
  validFrom?: number;
  validUntil?: number;
  version?: number;
  metadata?: Partial<EvidenceMetadata>;
  lineage?: Partial<EvidenceLineage>;
  id?: string;
}
export function makeEvidence(input: MakeEvidenceInput): Evidence {
  return Object.freeze({
    id: input.id ?? newEvidenceId(),
    sourceId: input.sourceId,
    kind: input.kind,
    subject: input.subject,
    claim: input.claim,
    value: input.value,
    collectedAt: input.collectedAt ?? Date.now(),
    validFrom: input.validFrom,
    validUntil: input.validUntil,
    version: input.version ?? 1,
    metadata: makeMetadata(input.metadata),
    lineage: makeLineage(input.lineage),
  });
}

export function makeReference(evidence: Evidence, weight = 1): EvidenceReference {
  return Object.freeze({ evidenceId: evidence.id, sourceId: evidence.sourceId, weight });
}

export function makeBundle(subject: string, references: readonly EvidenceReference[], now = Date.now()): EvidenceBundle {
  return Object.freeze({
    id: newBundleId(),
    subject,
    references: Object.freeze([...references]),
    createdAt: now,
  });
}

export function makeSnapshot(evidenceIds: readonly string[], sourceIds: readonly string[], now = Date.now()): EvidenceSnapshot {
  return Object.freeze({
    id: newSnapshotId(),
    at: now,
    evidenceIds: Object.freeze([...evidenceIds]),
    sourceIds: Object.freeze([...sourceIds]),
  });
}
