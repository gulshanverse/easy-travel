/**
 * TIOS Decision Engine.
 * Orchestrates a single decision request:
 *   Capability lookup → Feature-flag gating → Policy evaluation →
 *   Explanation assembly → Observability
 *
 * The engine never calls providers or AI directly — it delegates to the
 * capability's registered `invoke`, which may in turn use the AI Core or TIE.
 */
import { emitTIOSEvent, makeRequestId } from "./events";
import { getFlag } from "./flags";
import { evaluatePolicies } from "./policy";
import { getCapability } from "./registry";
import type {
  CapabilityId, Decision, DecisionContext, Explanation, PolicyDecision,
} from "./types";

export interface DecisionRequest<TInput = Record<string, unknown>> {
  capabilityId: CapabilityId;
  input: TInput;
  ctx: DecisionContext;
  policyCategory?: string;
}

export async function decide<TInput = Record<string, unknown>, TOutput = unknown>(
  req: DecisionRequest<TInput>,
): Promise<Decision<TOutput>> {
  const start = Date.now();
  const cap = getCapability(req.capabilityId);
  if (!cap) throw new Error(`TIOS: unknown capability "${req.capabilityId}"`);

  // Feature-flag gating: every referenced flag must be truthy.
  for (const flag of cap.manifest.featureFlags) {
    if (!getFlag(flag)) {
      throw new Error(`TIOS: capability "${req.capabilityId}" disabled by flag ${flag}`);
    }
  }

  // Policy evaluation across the requested category.
  const policyEval = await evaluatePolicies(
    req.policyCategory ?? req.capabilityId,
    req.input as Record<string, unknown>,
    req.ctx,
  );
  const policies: PolicyDecision[] = policyEval.decisions;
  if (!policyEval.allowed) {
    const denyMsg = policyEval.denials.map((d) => d.message ?? d.ruleId).join("; ");
    throw new Error(`TIOS: policy denied — ${denyMsg}`);
  }

  // Invoke the capability (if it exposes an invoke fn).
  const output = cap.invoke
    ? ((await cap.invoke(req.input, req.ctx)) as TOutput)
    : (undefined as unknown as TOutput);

  const explanation: Explanation = {
    summary: `Decision produced by capability "${req.capabilityId}"`,
    reasons: policies
      .filter((p) => p.effect === "allow")
      .map((p) => p.message ?? p.ruleId),
    antiReasons: policyEval.warnings.map((p) => p.message ?? p.ruleId),
    alternatives: [],
    confidence: policyEval.warnings.length === 0 ? 0.9 : 0.7,
  };

  const decision: Decision<TOutput> = {
    id: makeRequestId("dec"),
    capabilityId: req.capabilityId,
    createdAt: Date.now(),
    output,
    explanation,
    policies,
    latencyMs: Date.now() - start,
  };

  emitTIOSEvent({
    name: "DECISION_CREATED",
    requestId: req.ctx.requestId,
    timestamp: Date.now(),
    capability: req.capabilityId,
    data: { latencyMs: decision.latencyMs, warnings: policyEval.warnings.length },
  });

  return decision;
}
