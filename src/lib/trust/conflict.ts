/**
 * Trust & Evidence Engine — conflict detection.
 * Detects claim, date, source and constraint conflicts deterministically.
 * No LLM reasoning; pure structural comparison.
 */
import type { TrustConfig } from "./config";
import { newConflictId } from "./ids";
import type { Evidence, EvidenceConflict } from "./types";

export function detectConflicts(evidence: readonly Evidence[], cfg: TrustConfig, now: number): readonly EvidenceConflict[] {
  if (evidence.length < 2) return [];
  const out: EvidenceConflict[] = [];
  const bySubject = groupBy(evidence, (e) => e.subject);
  for (const [subject, group] of bySubject) {
    // Value / claim conflicts
    const claims = new Map<string, Evidence[]>();
    for (const e of group) {
      const list = claims.get(e.claim) ?? [];
      list.push(e);
      claims.set(e.claim, list);
    }
    if (claims.size > 1) {
      const majority = Math.max(...Array.from(claims.values()).map((l) => l.length));
      const agreement = majority / group.length;
      if (agreement < cfg.conflictAgreementThreshold) {
        out.push(Object.freeze({
          id: newConflictId(),
          subject,
          kind: "value",
          evidenceIds: Object.freeze(group.map((g) => g.id)),
          detail: `Disagreement on subject "${subject}": ${claims.size} distinct claims`,
          detectedAt: now,
        }));
      }
    }
    // Date conflicts
    const kinds = groupBy(group, (e) => e.kind);
    for (const [, subgroup] of kinds) {
      const dated = subgroup.filter((e) => e.validFrom || e.validUntil);
      for (let i = 0; i < dated.length; i++) {
        for (let j = i + 1; j < dated.length; j++) {
          const a = dated[i], b = dated[j];
          const aFrom = a.validFrom ?? -Infinity;
          const aTo = a.validUntil ?? Infinity;
          const bFrom = b.validFrom ?? -Infinity;
          const bTo = b.validUntil ?? Infinity;
          const overlap = aFrom <= bTo && bFrom <= aTo;
          if (overlap && a.claim !== b.claim) {
            out.push(Object.freeze({
              id: newConflictId(),
              subject,
              kind: "date",
              evidenceIds: Object.freeze([a.id, b.id]),
              detail: "Overlapping validity windows with divergent claims",
              detectedAt: now,
            }));
          }
        }
      }
    }
    // Source diversity conflicts (multiple sources with same subject but opposite claims)
    const bySource = groupBy(group, (e) => e.sourceId);
    if (bySource.size >= 2 && claims.size >= 2) {
      out.push(Object.freeze({
        id: newConflictId(),
        subject,
        kind: "source",
        evidenceIds: Object.freeze(group.map((g) => g.id)),
        detail: `Multiple sources disagree (${bySource.size} sources, ${claims.size} claims)`,
        detectedAt: now,
      }));
    }
  }
  return Object.freeze(out);
}

function groupBy<T, K>(xs: readonly T[], key: (t: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const x of xs) {
    const k = key(x);
    const list = m.get(k) ?? [];
    list.push(x);
    m.set(k, list);
  }
  return m;
}
