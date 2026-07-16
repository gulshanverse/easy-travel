/**
 * Trust & Evidence Engine — immutable domain model.
 * These entities are the ONLY shapes crossing the runtime boundary.
 */
export type TrustLevel = "unknown" | "low" | "medium" | "high" | "verified";
export type SourceCategory =
  | "official" | "operator" | "editorial" | "community" | "provider" | "model" | "user" | "system";
export type EvidenceKind =
  | "fact" | "recommendation" | "constraint" | "observation" | "forecast" | "review" | "policy";

export interface EvidenceMetadata {
  readonly locale?: string;
  readonly region?: string;
  readonly domain?: string;
  readonly tags: readonly string[];
  readonly attributes: Readonly<Record<string, string | number | boolean>>;
}

export interface EvidenceLineage {
  readonly parentIds: readonly string[];
  readonly transformations: readonly string[];
  readonly chainOfCustody: readonly string[];
}

export interface EvidenceSource {
  readonly id: string;
  readonly name: string;
  readonly category: SourceCategory;
  readonly authority: number;   // 0..1
  readonly reliability: number; // 0..1
  readonly region?: string;
  readonly language?: string;
  readonly supportedDomains: readonly string[];
  readonly version: string;
  readonly trustPolicyIds: readonly string[];
  readonly registeredAt: number;
  readonly invalidatedAt?: number;
}

export interface Evidence {
  readonly id: string;
  readonly sourceId: string;
  readonly kind: EvidenceKind;
  readonly subject: string;              // logical subject key (e.g. "flight:AA123")
  readonly claim: string;                // canonical serialization of the claim
  readonly value?: unknown;              // structured value payload (opaque)
  readonly collectedAt: number;
  readonly validFrom?: number;
  readonly validUntil?: number;
  readonly version: number;
  readonly metadata: EvidenceMetadata;
  readonly lineage: EvidenceLineage;
}

export interface EvidenceReference {
  readonly evidenceId: string;
  readonly sourceId: string;
  readonly weight: number; // 0..1
}

export interface EvidenceBundle {
  readonly id: string;
  readonly subject: string;
  readonly references: readonly EvidenceReference[];
  readonly createdAt: number;
}

export interface EvidenceVersion {
  readonly evidenceId: string;
  readonly version: number;
  readonly at: number;
  readonly diffSummary: string;
}

export interface EvidenceSnapshot {
  readonly id: string;
  readonly at: number;
  readonly evidenceIds: readonly string[];
  readonly sourceIds: readonly string[];
}

export interface EvidenceConflict {
  readonly id: string;
  readonly subject: string;
  readonly kind: "value" | "date" | "source" | "recommendation" | "constraint";
  readonly evidenceIds: readonly string[];
  readonly detail: string;
  readonly detectedAt: number;
}

export interface EvidenceScore {
  readonly evidenceId: string;
  readonly quality: number;      // 0..1
  readonly freshness: number;    // 0..1
  readonly reliability: number;  // 0..1
  readonly authority: number;    // 0..1
  readonly overall: number;      // 0..1
}

export interface TrustReason {
  readonly code: string;
  readonly message: string;
  readonly weight: number;
}

export interface TrustConfidence {
  readonly value: number;        // 0..1
  readonly sampleSize: number;
  readonly agreement: number;    // 0..1
}

export interface TrustExplanation {
  readonly summary: string;
  readonly reasons: readonly TrustReason[];
  readonly antiReasons: readonly TrustReason[];
}

export interface TrustScore {
  readonly id: string;
  readonly subject: string;
  readonly bundleId?: string;
  readonly level: TrustLevel;
  readonly value: number;        // 0..1
  readonly confidence: TrustConfidence;
  readonly evidenceScores: readonly EvidenceScore[];
  readonly reasons: readonly TrustReason[];
  readonly computedAt: number;
}

export interface TrustDecision {
  readonly id: string;
  readonly subject: string;
  readonly allow: boolean;
  readonly level: TrustLevel;
  readonly threshold: number;
  readonly score: TrustScore;
  readonly explanation: TrustExplanation;
  readonly decidedAt: number;
}

export interface TrustSnapshot {
  readonly id: string;
  readonly at: number;
  readonly scores: readonly TrustScore[];
}

export interface TrustHistoryEntry {
  readonly subject: string;
  readonly at: number;
  readonly level: TrustLevel;
  readonly value: number;
}
