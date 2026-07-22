/** ARP — metrics. */
export interface AgentMetricsSnapshot {
  readonly agents: { registered: number; removed: number; failed: number };
  readonly sessions: { created: number; ended: number; expired: number };
  readonly conversations: { created: number; completed: number; turns: number };
  readonly intents: { classified: number };
  readonly plans: { created: number };
  readonly workflows: { requested: number; completed: number; failed: number };
  readonly responses: { assembled: number };
  readonly governance: { violations: number };
}
export class AgentMetrics {
  private a = { registered: 0, removed: 0, failed: 0 };
  private s = { created: 0, ended: 0, expired: 0 };
  private c = { created: 0, completed: 0, turns: 0 };
  private i = { classified: 0 };
  private p = { created: 0 };
  private w = { requested: 0, completed: 0, failed: 0 };
  private r = { assembled: 0 };
  private g = { violations: 0 };

  agentRegistered() { this.a.registered++; }
  agentRemoved() { this.a.removed++; }
  agentFailed() { this.a.failed++; }
  sessionCreated() { this.s.created++; }
  sessionEnded() { this.s.ended++; }
  sessionExpired() { this.s.expired++; }
  conversationCreated() { this.c.created++; }
  conversationCompleted() { this.c.completed++; }
  turnRecorded() { this.c.turns++; }
  intentClassified() { this.i.classified++; }
  planCreated() { this.p.created++; }
  workflowRequested() { this.w.requested++; }
  workflowCompleted() { this.w.completed++; }
  workflowFailed() { this.w.failed++; }
  responseAssembled() { this.r.assembled++; }
  governanceViolation() { this.g.violations++; }

  snapshot(): AgentMetricsSnapshot {
    return Object.freeze({
      agents: { ...this.a }, sessions: { ...this.s }, conversations: { ...this.c },
      intents: { ...this.i }, plans: { ...this.p }, workflows: { ...this.w },
      responses: { ...this.r }, governance: { ...this.g },
    });
  }
}
