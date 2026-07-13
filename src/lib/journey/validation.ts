/**
 * Journey validation — pure functions, no side effects.
 * Every validator returns a normalized `ValidationResult`; the manager
 * decides whether to throw based on policy strictness.
 */

import { JourneyValidationError } from "./errors";
import type {
  Journey,
  JourneyExecutionContext,
  JourneyIntent,
  Timeline,
  TravelConstraint,
} from "./types";
import type { JourneyConfiguration } from "./config";
import type {
  JourneyGraphPort,
  JourneyMemoryPort,
  JourneyPromptPort,
  JourneyProviderPort,
} from "./ports";

export interface ValidationIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: "error" | "warning";
  readonly path?: string;
}

export interface ValidationResult {
  readonly ok: boolean;
  readonly issues: readonly ValidationIssue[];
}

const ok = (): ValidationResult => Object.freeze({ ok: true, issues: [] });
const fail = (issues: ValidationIssue[]): ValidationResult =>
  Object.freeze({ ok: issues.every((i) => i.severity !== "error"), issues });

// ---------- Journey ----------
export function validateJourney(j: Journey): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!j.id) issues.push({ code: "journey.id_missing", message: "id required", severity: "error" });
  if (!j.ownerId) issues.push({ code: "journey.owner_missing", message: "ownerId required", severity: "error" });
  if (!j.title || j.title.trim().length === 0)
    issues.push({ code: "journey.title_missing", message: "title required", severity: "error" });
  if (j.version < 1)
    issues.push({ code: "journey.version_invalid", message: "version must be >= 1", severity: "error" });
  if (j.window && j.window.earliestStart > j.window.latestEnd)
    issues.push({ code: "journey.window_inverted", message: "earliestStart > latestEnd", severity: "error", path: "window" });
  return fail(issues);
}

// ---------- Constraints ----------
export function validateConstraints(constraints: readonly TravelConstraint[]): ValidationResult {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();
  for (const c of constraints) {
    if (seen.has(c.id))
      issues.push({ code: "constraint.duplicate", message: `duplicate constraint ${c.id}`, severity: "error" });
    seen.add(c.id);
    if (!c.description) issues.push({ code: "constraint.description_missing", message: "description required", severity: "warning" });
  }
  // basic conflict detection: two hard budget constraints
  const hardBudgets = constraints.filter((c) => c.kind === "budget" && c.severity === "hard");
  if (hardBudgets.length > 1)
    issues.push({
      code: "constraint.conflict.budget",
      message: "multiple hard budget constraints defined",
      severity: "error",
    });
  return fail(issues);
}

// ---------- Timeline ----------
export function validateTimeline(t: Timeline | undefined): ValidationResult {
  if (!t) return ok();
  const issues: ValidationIssue[] = [];
  if (t.window.earliestStart > t.window.latestEnd)
    issues.push({ code: "timeline.window_inverted", message: "earliestStart > latestEnd", severity: "error" });
  const ids = new Set(t.milestones.map((m) => m.id));
  for (const m of t.milestones) {
    for (const dep of m.dependsOn ?? []) {
      if (!ids.has(dep))
        issues.push({ code: "timeline.dep_missing", message: `unknown dependency ${dep}`, severity: "error" });
    }
  }
  // ordering
  for (let i = 1; i < t.milestones.length; i++) {
    if (t.milestones[i].at < t.milestones[i - 1].at)
      issues.push({ code: "timeline.out_of_order", message: `milestone ${i} out of order`, severity: "warning" });
  }
  return fail(issues);
}

// ---------- Intent ----------
export function validateIntent(intent: JourneyIntent): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (intent.confidence < 0 || intent.confidence > 1)
    issues.push({ code: "intent.confidence_range", message: "confidence out of [0,1]", severity: "error" });
  if (!intent.text) issues.push({ code: "intent.text_missing", message: "text required", severity: "warning" });
  return fail(issues);
}

// ---------- Graph / Memory / Provider ports ----------
export async function validateGraphPort(p: JourneyGraphPort): Promise<ValidationResult> {
  return (await p.healthy())
    ? ok()
    : fail([{ code: "graph.unhealthy", message: "graph port unhealthy", severity: "error" }]);
}
export async function validateMemoryPort(p: JourneyMemoryPort): Promise<ValidationResult> {
  return (await p.healthy())
    ? ok()
    : fail([{ code: "memory.unhealthy", message: "memory port unhealthy", severity: "error" }]);
}
export async function validatePromptPort(p: JourneyPromptPort): Promise<ValidationResult> {
  return (await p.healthy())
    ? ok()
    : fail([{ code: "prompt.unhealthy", message: "prompt port unhealthy", severity: "error" }]);
}
export async function validateProviderPort(p: JourneyProviderPort): Promise<ValidationResult> {
  return (await p.healthy())
    ? ok()
    : fail([{ code: "provider.unhealthy", message: "provider port unhealthy", severity: "error" }]);
}

// ---------- Config ----------
export function validateConfiguration(cfg: JourneyConfiguration): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (cfg.policies.maxJourneysPerProcess <= 0)
    issues.push({ code: "config.max_journeys", message: "maxJourneysPerProcess must be > 0", severity: "error" });
  if (cfg.context.assemblyTimeoutMs <= 0)
    issues.push({ code: "config.timeout", message: "assemblyTimeoutMs must be > 0", severity: "error" });
  return fail(issues);
}

// ---------- Execution context ----------
export function validateExecutionContext(ctx: JourneyExecutionContext): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!ctx.journey || ctx.journey.id !== ctx.journeyId)
    issues.push({ code: "context.mismatch", message: "context journey mismatch", severity: "error" });
  if (ctx.stats.assemblyMs < 0)
    issues.push({ code: "context.negative_time", message: "assemblyMs < 0", severity: "error" });
  return fail(issues);
}

// ---------- Convenience ----------
export function throwIfFailed(result: ValidationResult, message: string): void {
  if (!result.ok) {
    const summary = result.issues
      .filter((i) => i.severity === "error")
      .map((i) => `${i.code}: ${i.message}`)
      .join("; ");
    throw new JourneyValidationError(`${message}: ${summary}`, { issues: result.issues });
  }
}
