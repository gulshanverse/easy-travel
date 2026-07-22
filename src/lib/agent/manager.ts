/** ARP — AgentManager (orchestrates reasoning; CTOR owns execution). */
import { AgentAlreadyRegisteredError, AgentNotFoundError, ResponseAssemblyError } from "./errors";
import type { AgentEventBus } from "./events";
import type { AgentMetrics } from "./metrics";
import type { AgentTelemetrySink } from "./telemetry";
import { IntentEngine } from "./intent";
import { PlanningEngine } from "./planning";
import { CapabilitySelectionEngine } from "./capability-selection";
import { GovernanceEngine } from "./governance";
import { ResponseAssemblyEngine } from "./response";
import { AgentRegistry } from "./registry";
import { ConversationRuntime } from "./conversation";
import { SessionRegistry } from "./session";
import { makeTurn } from "./factories";
import type { AgentGovernancePolicies } from "./policies";
import { resolvePolicy } from "./policies";
import type { AgentAuditPort, AgentCTORPort, AgentKernelPort, AgentPolicyPort, AgentWorkflowRequest, AgentWorkflowResult } from "./ports";
import type { Agent, AgentPlan, AgentResponse, Intent } from "./types";
import { newCorrelationId } from "./ids";

export interface AgentManagerDeps {
  readonly registry: AgentRegistry;
  readonly sessions: SessionRegistry;
  readonly conversations: ConversationRuntime;
  readonly events: AgentEventBus;
  readonly metrics: AgentMetrics;
  readonly telemetry: AgentTelemetrySink;
  readonly policies: AgentGovernancePolicies;
  readonly ctor: AgentCTORPort;
  readonly kernel?: AgentKernelPort;
  readonly policyPort?: AgentPolicyPort;
  readonly audit?: AgentAuditPort;
  readonly now?: () => number;
}

export interface HandleRequestInput {
  readonly agentId: string;
  readonly sessionId: string;
  readonly conversationId: string;
  readonly input: string;
  readonly signal?: AbortSignal;
  readonly metadata?: Record<string, unknown>;
}

export interface HandleRequestResult {
  readonly intent: Intent;
  readonly plan: AgentPlan;
  readonly workflow: AgentWorkflowResult;
  readonly response: AgentResponse;
}

export class AgentManager {
  readonly registry: AgentRegistry;
  readonly sessions: SessionRegistry;
  readonly conversations: ConversationRuntime;
  readonly intents = new IntentEngine();
  readonly planner = new PlanningEngine();
  readonly selector = new CapabilitySelectionEngine();
  readonly governance = new GovernanceEngine();
  readonly assembler = new ResponseAssemblyEngine();

  constructor(private readonly deps: AgentManagerDeps) {
    this.registry = deps.registry;
    this.sessions = deps.sessions;
    this.conversations = deps.conversations;
  }

  // -------- Agent lifecycle --------
  registerAgent(agent: Agent): Agent {
    if (this.registry.has(agent.identity.id)) throw new AgentAlreadyRegisteredError(agent.identity.id);
    const registered = this.registry.register(agent);
    const ready = this.registry.transition(registered.identity.id, "ready", "auto-ready-on-register");
    this.deps.metrics.agentRegistered();
    this.deps.events.emit({ name: "AgentRegistered", agentId: agent.identity.id, data: { id: agent.identity.id, type: agent.identity.type, version: agent.identity.version } });
    this.deps.events.emit({ name: "AgentReady", agentId: agent.identity.id, data: { id: agent.identity.id } });
    return ready;
  }
  removeAgent(id: string): void {
    if (!this.registry.has(id)) throw new AgentNotFoundError(id);
    this.registry.remove(id);
    this.deps.events.emit({ name: "AgentRemoved", agentId: id, data: { id } });
  }
  archiveAgent(id: string): Agent {
    const a = this.registry.transition(id, "archived", "manual-archive");
    this.deps.events.emit({ name: "AgentArchived", agentId: id, data: { id } });
    return a;
  }
  listAgents(): readonly Agent[] { return this.registry.list(); }
  getAgent(id: string): Agent { return this.registry.get(id); }

  // -------- End-to-end request --------
  async handleRequest(i: HandleRequestInput): Promise<HandleRequestResult> {
    const now = this.deps.now ?? Date.now;
    const started = now();
    const correlationId = newCorrelationId();
    const agent = this.registry.get(i.agentId);
    const session = this.sessions.touch(i.sessionId);
    const conversation = this.conversations.get(i.conversationId);
    if (session.agentId !== agent.identity.id) throw new Error(`Session ${session.id} does not belong to agent ${agent.identity.id}`);
    if (conversation.sessionId !== session.id) throw new Error(`Conversation ${conversation.id} does not belong to session ${session.id}`);

    this.registry.transition(agent.identity.id, "receiving-request");
    this.registry.bumpStat(agent.identity.id, "requests");

    // User turn
    this.conversations.appendTurn(conversation.id, { role: "user", input: i.input, metadata: i.metadata });

    // Intent
    this.registry.transition(agent.identity.id, "understanding-intent");
    const intent = this.intents.classify({ agentId: agent.identity.id, rawInput: i.input, metadata: i.metadata });
    this.deps.metrics.intentClassified();
    this.registry.bumpStat(agent.identity.id, "intentsClassified");
    this.deps.events.emit({ name: "IntentClassified", agentId: agent.identity.id, sessionId: session.id, conversationId: conversation.id, correlationId, data: { intentId: intent.id, classification: intent.classification, confidence: intent.confidence } });

    // Policies
    const policies = resolvePolicy(agent.policy, this.deps.policies);

    // Plan
    this.registry.transition(agent.identity.id, "planning");
    const plan = this.planner.buildPlan({ agentId: agent.identity.id, intent, maxCapabilities: policies.maxCapabilitiesPerPlan });
    this.deps.metrics.planCreated();
    this.registry.bumpStat(agent.identity.id, "plansCreated");
    this.deps.events.emit({ name: "PlanCreated", agentId: agent.identity.id, sessionId: session.id, conversationId: conversation.id, correlationId, data: { planId: plan.id, strategy: plan.strategy, tasks: plan.tasks.length } });

    // Governance
    const gov = await this.governance.validate({ agent, plan, policies, policyPort: this.deps.policyPort, audit: this.deps.audit });
    if (!gov.ok) {
      this.deps.metrics.governanceViolation();
      this.deps.events.emit({ name: "GovernanceViolation", agentId: agent.identity.id, correlationId, data: { violations: gov.violations, planId: plan.id } });
      this.registry.transition(agent.identity.id, "failed", "governance");
      throw new Error(`Governance denied plan: ${gov.violations.join(", ")}`);
    }

    // Capability selection
    this.registry.transition(agent.identity.id, "selecting-capabilities");
    const selection = await this.selector.select({ agent, plan, policies, ctor: this.deps.ctor, policyPort: this.deps.policyPort });
    for (const d of selection.decisions) {
      this.deps.events.emit({ name: "CapabilitySelected", agentId: agent.identity.id, correlationId, data: { capabilityId: d.capabilityId } });
    }

    // Workflow via CTOR
    this.registry.transition(agent.identity.id, "executing-workflow");
    const wfSteps = selection.resolvedTasks
      .filter(t => t.kind === "capability-request" && t.capabilityId)
      .map(t => ({ id: t.id, capabilityId: t.capabilityId!, input: t.input ?? {}, dependsOn: t.dependsOn }));
    const workflow = wfSteps.length > 0
      ? await this.runWorkflow({ steps: wfSteps, correlationId, signal: i.signal, timeoutMs: policies.executionBudgetMs })
      : ({ status: "completed", outputs: {}, ms: 0, steps: [] } as AgentWorkflowResult);
    this.deps.metrics.workflowRequested();
    this.registry.bumpStat(agent.identity.id, "workflowsRequested");
    if (workflow.status === "completed") {
      this.deps.metrics.workflowCompleted();
      this.registry.bumpStat(agent.identity.id, "workflowsCompleted");
      this.deps.events.emit({ name: "WorkflowCompleted", agentId: agent.identity.id, correlationId, data: { ms: workflow.ms } });
    } else {
      this.deps.metrics.workflowFailed();
      this.registry.bumpStat(agent.identity.id, "workflowsFailed");
      this.deps.events.emit({ name: "WorkflowFailed", agentId: agent.identity.id, correlationId, data: { error: workflow.error } });
    }

    // Synthesize response
    this.registry.transition(agent.identity.id, "synthesizing-response");
    let response: AgentResponse;
    try {
      response = this.assembler.assemble({
        agentId: agent.identity.id,
        sessionId: session.id,
        conversationId: conversation.id,
        turnId: conversation.turns.at(-1)?.id ?? "unknown",
        intent, plan,
        outputs: workflow.outputs,
        workflow,
        reasoningSummary: [
          `intent:${intent.classification}(${intent.confidence.toFixed(2)})`,
          `plan:${plan.strategy}/${plan.tasks.length}`,
          `workflow:${workflow.status}`,
        ],
      });
    } catch (e) {
      this.registry.transition(agent.identity.id, "failed", "response-assembly");
      throw new ResponseAssemblyError(e instanceof Error ? e.message : String(e));
    }
    this.deps.metrics.responseAssembled();
    this.registry.bumpStat(agent.identity.id, "responsesAssembled");
    this.deps.events.emit({ name: "ResponseAssembled", agentId: agent.identity.id, sessionId: session.id, conversationId: conversation.id, correlationId, data: { responseId: response.id, confidence: response.confidence } });

    // Append agent turn
    const agentTurn = makeTurn({ role: "agent", intentId: intent.id, planId: plan.id, responseId: response.id });
    this.conversations.appendTurn(conversation.id, agentTurn);
    this.deps.metrics.turnRecorded();
    this.deps.events.emit({ name: "ConversationUpdated", agentId: agent.identity.id, conversationId: conversation.id, correlationId, data: { turnId: agentTurn.id } });

    const finished = now();
    this.registry.bumpStat(agent.identity.id, "totalLatencyMs", finished - started);
    this.registry.recordRun(agent.identity.id, { at: finished, intentId: intent.id, planId: plan.id, responseId: response.id, ok: workflow.status === "completed", ms: finished - started });
    this.registry.transition(agent.identity.id, "completed");
    this.registry.transition(agent.identity.id, "ready");

    this.deps.telemetry.record({
      kind: "trace", level: "info",
      message: `agent:${agent.identity.id}:handleRequest`,
      timestamp: finished,
      attributes: { ms: finished - started, intent: intent.classification, plan: plan.id, workflow: workflow.status },
    });

    return { intent, plan, workflow, response };
  }

  async runWorkflow(req: AgentWorkflowRequest): Promise<AgentWorkflowResult> {
    return this.deps.ctor.runWorkflow(req);
  }
}
