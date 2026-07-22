/** ARP — Response Assembly Engine. Structured only, no NLG. */
import { newResponseId } from "./ids";
import type { AgentPlan, AgentResponse, AgentTask, EvidenceReference, Intent, StructuredResult } from "./types";
import type { AgentWorkflowResult } from "./ports";

export interface AssembleResponseInput {
  readonly agentId: string;
  readonly sessionId: string;
  readonly conversationId: string;
  readonly turnId: string;
  readonly intent: Intent;
  readonly plan: AgentPlan;
  readonly outputs: Readonly<Record<string, unknown>>;
  readonly workflow?: AgentWorkflowResult;
  readonly evidence?: readonly EvidenceReference[];
  readonly warnings?: readonly string[];
  readonly reasoningSummary?: readonly string[];
  readonly diagnostics?: Readonly<Record<string, unknown>>;
  readonly now?: number;
}

export class ResponseAssemblyEngine {
  assemble(i: AssembleResponseInput): AgentResponse {
    const results: StructuredResult[] = Object.entries(i.outputs)
      .map(([k, v]) => Object.freeze({ key: k, value: v } as StructuredResult));
    const trace = (i.plan.tasks as readonly AgentTask[]).map(t => {
      const step = i.workflow?.steps.find(s => s.id === t.id);
      return Object.freeze({
        capabilityId: t.capabilityId,
        workflowId: t.workflowId,
        status: (step?.status ?? "completed") as "completed" | "failed" | "skipped" | "cancelled",
        ms: step?.ms ?? 0,
      });
    });
    const confidence = i.workflow?.status === "completed" ? i.intent.confidence : Math.min(i.intent.confidence, 0.5);
    return Object.freeze({
      id: newResponseId(),
      agentId: i.agentId,
      sessionId: i.sessionId,
      conversationId: i.conversationId,
      turnId: i.turnId,
      intentId: i.intent.id,
      planId: i.plan.id,
      results: Object.freeze(results),
      evidence: Object.freeze([...(i.evidence ?? [])]),
      confidence,
      warnings: Object.freeze([...(i.warnings ?? [])]),
      reasoningSummary: Object.freeze([...(i.reasoningSummary ?? [])]),
      capabilityTrace: Object.freeze(trace),
      diagnostics: Object.freeze({ ...(i.diagnostics ?? {}) }),
      createdAt: i.now ?? Date.now(),
    });
  }
}
