/**
 * TIOS Policy Engine.
 * Central rule evaluation. Rules are pure functions over (input, DecisionContext).
 * Effects: allow / deny / warn. A single deny short-circuits.
 */
import { emitTIOSEvent, makeRequestId } from "./events";
import type { DecisionContext, PolicyDecision, PolicyRule } from "./types";

const rules = new Map<string, PolicyRule>();

export function registerPolicy<T = Record<string, unknown>>(rule: PolicyRule<T>): void {
  rules.set(rule.id, rule as unknown as PolicyRule);
}

export function unregisterPolicy(id: string): void {
  rules.delete(id);
}

export function listPolicies(): PolicyRule[] {
  return Array.from(rules.values());
}

export interface PolicyEvaluation {
  allowed: boolean;
  decisions: PolicyDecision[];
  warnings: PolicyDecision[];
  denials: PolicyDecision[];
}

export async function evaluatePolicies<T>(
  category: string | undefined,
  input: T,
  ctx: DecisionContext,
): Promise<PolicyEvaluation> {
  const decisions: PolicyDecision[] = [];
  const warnings: PolicyDecision[] = [];
  const denials: PolicyDecision[] = [];

  for (const rule of rules.values()) {
    if (!rule.enabled) continue;
    if (category && rule.category !== category) continue;
    let matched = false;
    try {
      matched = Boolean(await rule.evaluate(input as never, ctx));
    } catch {
      matched = false;
    }
    if (!matched) continue;
    const decision: PolicyDecision = {
      ruleId: rule.id,
      effect: rule.effect,
      matched,
      message: rule.message,
    };
    decisions.push(decision);
    emitTIOSEvent({
      name: rule.effect === "deny" ? "POLICY_DENIED" : "POLICY_MATCHED",
      requestId: ctx.requestId,
      timestamp: Date.now(),
      data: { ruleId: rule.id, effect: rule.effect },
    });
    if (rule.effect === "warn") warnings.push(decision);
    if (rule.effect === "deny") denials.push(decision);
  }

  return { allowed: denials.length === 0, decisions, warnings, denials };
}

// -------- Default policies (configurable via unregister/re-register) --------
registerPolicy({
  id: "budget.exceeded",
  description: "Deny actions when trip budget would be exceeded",
  category: "budget",
  enabled: true,
  effect: "deny",
  message: "Action would exceed the trip budget.",
  evaluate: (input: Record<string, unknown>) => {
    const amount = Number(input?.amount ?? 0);
    const remaining = Number(input?.budgetRemaining ?? Infinity);
    return amount > remaining;
  },
});

registerPolicy({
  id: "trip.archived.readonly",
  description: "Archived trips are read-only",
  category: "trip",
  enabled: true,
  effect: "deny",
  message: "Trip is archived.",
  evaluate: (input: Record<string, unknown>) =>
    input?.tripStatus === "archived" && input?.op !== "read",
});

registerPolicy({
  id: "weather.warning.required",
  description: "Warn when severe weather is expected",
  category: "weather",
  enabled: true,
  effect: "warn",
  message: "Severe weather expected at destination.",
  evaluate: (input: Record<string, unknown>) =>
    input?.weatherSeverity === "severe",
});

registerPolicy({
  id: "accessibility.wheelchair",
  description: "Require wheelchair-accessible options when requested",
  category: "recommendation",
  enabled: true,
  effect: "warn",
  message: "Filter to wheelchair-accessible items.",
  evaluate: (input: Record<string, unknown>, ctx) =>
    Boolean(ctx.metadata?.wheelchair) && !input?.wheelchairAccessible,
});
