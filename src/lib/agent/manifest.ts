/** ARP — Engine Contract & Capability Manifest. */

export const AGENT_RUNTIME_ENGINE_CONTRACT = Object.freeze({
  id: "agent.runtime",
  name: "Agent Runtime Platform",
  version: "1.0.0",
  ownership: {
    owns: [
      "agent-lifecycle", "agent-registry", "agent-capabilities", "agent-sessions",
      "conversation-state", "intent-routing", "task-planning", "agent-delegation",
      "response-assembly", "agent-policies", "agent-governance",
    ],
    doesNotOwn: [
      "workflow-execution", "capability-execution", "tool-execution",
      "memory", "journey", "decision", "trust", "goal", "spatial",
      "knowledge-graph", "prompt-runtime", "provider-runtime",
      "natural-language-generation", "llm-prompting", "streaming", "voice",
      "booking", "payments", "maps", "weather", "authentication", "persistence",
    ],
  },
  dependencies: {
    frozenEngines: [
      "ctor.runtime",
    ],
    ports: [
      "AgentCTORPort", "AgentKernelPort", "AgentPolicyPort", "AgentAuditPort",
    ],
  },
  consumedEvents: [
    "WorkflowCompleted", "WorkflowFailed", "WorkflowCancelled",
    "CapabilityRegistered",
  ],
  publishedEvents: [
    "AgentRegistered", "AgentUpdated", "AgentRemoved",
    "AgentStarted", "AgentReady", "AgentArchived", "AgentFailed",
    "IntentClassified", "PlanCreated", "CapabilitySelected",
    "WorkflowRequested", "WorkflowCompleted", "WorkflowFailed",
    "ResponseAssembled",
    "SessionCreated", "SessionEnded", "SessionExpired",
    "ConversationCreated", "ConversationUpdated", "ConversationCompleted",
    "AgentDelegated", "GovernanceViolation",
  ],
  publicApis: [
    "createAgentRuntime", "AgentRuntime", "AgentRuntimeFacade",
    "AgentManager", "AgentRegistry", "SessionRegistry", "ConversationRuntime",
    "IntentEngine", "PlanningEngine", "CapabilitySelectionEngine",
    "ResponseAssemblyEngine", "GovernanceEngine",
    "makeAgent", "makePlan", "makeTask", "makeSession", "makeConversation",
    "TravelOrchestratorAgent",
  ],
  ports: [
    "AgentCTORPort", "AgentKernelPort", "AgentPolicyPort", "AgentAuditPort",
  ],
  extensionPoints: [
    "custom BuiltInAgent", "custom PlanBlueprint", "AgentPolicyPort", "AgentAuditPort",
    "AgentTelemetrySink",
  ],
  adr: [
    "ADR-001", "ADR-002", "ADR-003", "ADR-004", "ADR-005",
  ],
});

export const AGENT_RUNTIME_CAPABILITY_MANIFEST = Object.freeze({
  id: "agent.runtime.capability.manifest",
  version: "1.0.0",
  supportedAgentTypes: [
    "travel-orchestrator", "booking", "visa", "budget", "safety",
    "discovery", "support", "generic",
  ],
  conversation: [
    "in-memory-turns", "conversation-lifecycle", "snapshots", "summaries",
    "multi-turn", "context-propagation",
  ],
  planning: [
    "deterministic-blueprints", "sequential", "parallel", "mixed",
    "dependency-planning", "fallback-plans", "recovery-plans",
    "capability-budget-enforcement",
  ],
  governance: [
    "capability-limits", "execution-budget", "planning-timeout",
    "delegation-rules", "denied-capabilities", "required-scopes",
    "audit-hooks",
  ],
  extensionHooks: [
    "PlanBlueprint", "AgentPolicyPort", "AgentAuditPort", "AgentTelemetrySink",
    "BuiltInAgent",
  ],
  futureIntegrations: [
    "BookingAgent", "VisaAgent", "BudgetAgent", "SafetyAgent",
    "DiscoveryAgent", "SupportAgent",
    "semantic-intent-provider", "multi-agent-coordinator",
    "long-term-conversation-persistence",
  ],
});
