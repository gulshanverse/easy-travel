/** ARP — AgentRuntime facade. */
import { mergeAgentRuntimeConfig, type AgentRuntimeConfig } from "./config";
import { AgentEventBus, type AgentEventListener } from "./events";
import { AgentMetrics, type AgentMetricsSnapshot } from "./metrics";
import { noopAgentTelemetry, type AgentTelemetrySink } from "./telemetry";
import { collectAgentHealth, type AgentHealthReport } from "./health";
import { createAgentManager } from "./factory";
import { AgentManager } from "./manager";
import { mergeGovernancePolicies, type AgentGovernancePolicies } from "./policies";
import type { AgentAuditPort, AgentCTORPort, AgentKernelPort, AgentPolicyPort } from "./ports";
import { noopAuditPort, noopCTORPort, noopKernelPort, noopPolicyPort } from "./ports";
import type { Session, Conversation } from "./types";

export interface AgentRuntimeOptions {
  readonly config?: Partial<AgentRuntimeConfig>;
  readonly policies?: Partial<AgentGovernancePolicies>;
  readonly telemetry?: AgentTelemetrySink;
  readonly now?: () => number;
  readonly ports?: {
    ctor?: AgentCTORPort;
    kernel?: AgentKernelPort;
    policy?: AgentPolicyPort;
    audit?: AgentAuditPort;
  };
}

export class AgentRuntime {
  readonly config: AgentRuntimeConfig;
  readonly policies: AgentGovernancePolicies;
  readonly events = new AgentEventBus();
  readonly metrics = new AgentMetrics();
  readonly manager: AgentManager;
  private readonly telemetry: AgentTelemetrySink;
  private readonly ctor: AgentCTORPort;
  private readonly kernel: AgentKernelPort;
  private readonly managers = new Map<string, AgentManager>();

  constructor(options: AgentRuntimeOptions = {}) {
    this.config = mergeAgentRuntimeConfig(options.config);
    this.policies = mergeGovernancePolicies(options.policies);
    this.telemetry = options.telemetry ?? noopAgentTelemetry;
    this.ctor = options.ports?.ctor ?? noopCTORPort;
    this.kernel = options.ports?.kernel ?? noopKernelPort;
    this.manager = createAgentManager({
      events: this.events, metrics: this.metrics, telemetry: this.telemetry,
      policies: this.policies, maxTurns: this.config.maxTurnsPerConversation,
      ctor: this.ctor, kernel: this.kernel,
      policyPort: options.ports?.policy ?? noopPolicyPort,
      audit: options.ports?.audit ?? noopAuditPort,
      now: options.now,
    });
    this.managers.set("default", this.manager);
  }

  createManager(id: string): AgentManager {
    const m = createAgentManager({
      events: this.events, metrics: this.metrics, telemetry: this.telemetry,
      policies: this.policies, maxTurns: this.config.maxTurnsPerConversation,
      ctor: this.ctor, kernel: this.kernel,
    });
    this.managers.set(id, m);
    return m;
  }
  listManagers(): readonly string[] { return [...this.managers.keys()]; }

  startSession(input: { agentId: string; userId?: string; locale?: string; timezone?: string; variables?: Record<string, unknown>; ttlMs?: number }): Session {
    const s = this.manager.sessions.create(makeSession({
      agentId: input.agentId,
      context: { userId: input.userId, locale: input.locale, timezone: input.timezone, variables: input.variables },
      ttlMs: input.ttlMs ?? this.config.defaultSessionTtlMs,
    }));
    this.metrics.sessionCreated();
    this.events.emit({ name: "SessionCreated", agentId: input.agentId, sessionId: s.id, data: { id: s.id } });
    return s;
  }
  endSession(id: string): Session {
    const s = this.manager.sessions.transition(id, "ended");
    this.metrics.sessionEnded();
    this.events.emit({ name: "SessionEnded", agentId: s.agentId, sessionId: s.id, data: { id: s.id } });
    return s;
  }
  createConversation(input: { sessionId: string }): Conversation {
    const s = this.manager.sessions.get(input.sessionId);
    const c = this.manager.conversations.create(makeConversation({ sessionId: s.id, agentId: s.agentId }));
    this.manager.sessions.linkConversation(s.id, c.id);
    this.metrics.conversationCreated();
    this.events.emit({ name: "ConversationCreated", agentId: s.agentId, sessionId: s.id, conversationId: c.id, data: { id: c.id } });
    return c;
  }

  metricsSnapshot(): AgentMetricsSnapshot { return this.metrics.snapshot(); }
  onEvent(l: AgentEventListener): () => void { return this.events.on(l); }
  health(): Promise<AgentHealthReport> {
    return collectAgentHealth(this.manager.registry, this.manager.sessions, this.manager.conversations, { ctor: this.ctor, kernel: this.kernel });
  }
  shutdown(): void {
    for (const m of this.managers.values()) {
      m.registry.clear(); m.sessions.clear(); m.conversations.clear();
    }
    this.managers.clear();
    this.events.clear();
  }
}

export function createAgentRuntime(options: AgentRuntimeOptions = {}): AgentRuntime {
  return new AgentRuntime(options);
}
export const AgentRuntimeFacade = AgentRuntime;
