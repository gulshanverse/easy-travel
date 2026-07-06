/**
 * TIOS Explainability Engine.
 * Assembles human-readable Explanation objects from decisions & recommendations.
 */
import type { Explanation, RecommendationScored } from "./types";

export function explainRecommendation<T extends Record<string, unknown>>(
  top: RecommendationScored<T> | undefined,
  alternatives: RecommendationScored<T>[] = [],
): Explanation {
  if (!top) {
    return {
      summary: "No qualifying recommendations at this time.",
      reasons: [],
      antiReasons: [],
      alternatives: [],
      confidence: 0,
    };
  }
  const label = (top.payload.name as string) ?? top.id;
  return {
    summary: `Suggested ${label}`,
    reasons: top.reasons,
    antiReasons: top.antiReasons ?? [],
    alternatives: alternatives.map((a) => ({
      id: a.id,
      label: (a.payload.name as string) ?? a.id,
    })),
    confidence: top.confidence,
  };
}

export function explanationToMarkdown(e: Explanation): string {
  const lines: string[] = [`**${e.summary}**`, ""];
  if (e.reasons.length) {
    lines.push("**Why:**");
    for (const r of e.reasons) lines.push(`- ${r}`);
  }
  if (e.antiReasons.length) {
    lines.push("", "**Why not:**");
    for (const r of e.antiReasons) lines.push(`- ${r}`);
  }
  if (e.alternatives.length) {
    lines.push("", "**Alternatives:**");
    for (const a of e.alternatives) lines.push(`- ${a.label}`);
  }
  lines.push("", `**Confidence:** ${(e.confidence * 100).toFixed(0)}%`);
  return lines.join("\n");
}
