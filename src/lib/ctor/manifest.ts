/** CTOR — Engine Contract & Capability Manifest. */

export const CTOR_ENGINE_CONTRACT = Object.freeze({
  id: "ctor.runtime",
  name: "Capability & Tool Orchestration Runtime",
  version: "1.0.0",
  ownership: {
    owns: [
      "capability-discovery", "tool-discovery", "tool-registration", "tool-lifecycle",
      "workflow-execution", "workflow-scheduling", "execution-context", "dependency-resolution",
      "parallel-execution", "retry-policies", "timeouts", "cancellation", "execution-tracing",
      "capability-contracts",
    ],
    doesNotOwn: [
      "memory", "journey", "decision", "trust", "goal", "spatial",
      "knowledge-graph", "prompt-runtime", "provider-runtime",
      "ai-reasoning", "llm-orchestration", "booking", "maps",
      "authentication", "persistence",
    ],
  },
  dependencies: {
    frozenEngines: [
      "memory.engine", "prompt.runtime", "runtime.kernel", "provider.runtime",
      "graph.runtime", "journey.engine", "decision.engine", "trust.engine",
      "goal.engine", "spatial.engine",
    ],
    ports: [
      "CTORMemoryPort", "CTORPromptPort", "CTORKernelPort", "CTORProviderPort",
      "CTORGraphPort", "CTORJourneyPort", "CTORDecisionPort", "CTORTrustPort",
      "CTORGoalPort", "CTORSpatialPort", "CTORContractSource",
    ],
  },
  consumedEvents: [],
  publishedEvents: [
    "CapabilityRegistered", "CapabilityUpdated", "CapabilityRemoved",
    "ToolRegistered", "ToolUpdated", "ToolRemoved", "ToolInvoked",
    "WorkflowRegistered", "WorkflowStarted", "WorkflowCheckpoint",
    "WorkflowCompleted", "WorkflowCancelled", "WorkflowFailed",
    "StepStarted", "StepCompleted", "StepFailed", "StepSkipped",
    "ExecutionRetried", "ExecutionTimedOut", "ExecutionCancelled",
    "DependencyResolved",
  ],
  publicApis: [
    "createCapabilityRuntime", "CapabilityRuntime", "CapabilityRuntimeFacade",
    "CapabilityManager", "CapabilityRegistry", "ToolRegistry", "ToolInvoker",
    "WorkflowBuilder", "WorkflowScheduler", "WorkflowValidator", "WorkflowPlanner",
    "executeWorkflow", "createExecutionContext", "topologicalSort", "computeLayers",
    "makeCapability", "makeTool", "makeWorkflow",
  ],
  extensionPoints: [
    "CTORContractSource", "CTORTelemetrySink", "custom StepExecutor",
    "circuit-breaker hook", "fallback hook",
  ],
  futureHooks: ["persistence adapter", "distributed scheduler", "priority queues"],
});

export const CTOR_CAPABILITY_MANIFEST = Object.freeze({
  id: "ctor.capability.manifest",
  version: "1.0.0",
  capabilities: {
    supported: [
      "capability.registry", "capability.discovery", "capability.lifecycle",
      "tool.registry", "tool.discovery", "tool.invocation", "tool.schema.validation",
      "workflow.registry", "workflow.execution", "workflow.scheduling",
      "workflow.validation", "workflow.planning",
      "execution.context", "execution.correlation", "execution.snapshot",
      "dependency.resolution", "dependency.cycle.detection", "topological.sort",
      "policy.timeout", "policy.retry", "policy.backoff.deterministic",
      "policy.cancellation", "policy.concurrency", "policy.priority", "policy.failure",
    ],
    workflow: [
      "dag", "sequential", "parallel", "conditional", "join", "split",
      "checkpoint", "rollback-point", "failure-node",
    ],
    execution: [
      "deterministic", "immutable-context", "context-propagation",
      "structured-logging", "tracing", "metrics",
    ],
    tools: [
      "input-validation", "impl-attachment", "idempotency-hints",
      "side-effect-declarations", "execution-history",
    ],
  },
  extensionHooks: ["CTORContractSource", "CTORTelemetrySink", "circuit-breaker", "fallback"],
  futureIntegrations: ["persistence adapter", "cluster scheduling", "distributed tracing"],
});
