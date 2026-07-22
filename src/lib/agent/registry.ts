/** ARP — Agent registry. */
import { AgentAlreadyRegisteredError, AgentNotFoundError } from "./errors";
import { transitionAgent } from "./lifecycle";
import type { Agent, AgentHistoryEntry, AgentRunHistoryEntry, AgentSnapshot, AgentStatistics, AgentStatus, AgentType } from "./types";

export class AgentRegistry {
  private readonly items = new Map<string, Agent>();
  private readonly history = new Map<string, AgentHistoryEntry[]>();
  private readonly runHistory = new Map<string, AgentRunHistoryEntry[]>();
  private readonly stats = new Map<string, AgentStatistics>();

  register(agent: Agent): Agent {
    if (this.items.has(agent.identity.id)) throw new AgentAlreadyRegisteredError(agent.identity.id);
    this.items.set(agent.identity.id, agent);
    this.history.set(agent.identity.id, [{ at: Date.now(), status: agent.status }]);
    this.runHistory.set(agent.identity.id, []);
    this.stats.set(agent.identity.id, {
      requests: 0, intentsClassified: 0, plansCreated: 0,
      workflowsRequested: 0, workflowsCompleted: 0, workflowsFailed: 0,
      responsesAssembled: 0, failures: 0, totalLatencyMs: 0,
    });
    return agent;
  }
  get(id: string): Agent {
    const a = this.items.get(id);
    if (!a) throw new AgentNotFoundError(id);
    return a;
  }
  has(id: string): boolean { return this.items.has(id); }
  list(): readonly Agent[] { return [...this.items.values()]; }
  listByType(type: AgentType): readonly Agent[] { return this.list().filter(a => a.identity.type === type); }
  transition(id: string, to: AgentStatus, note?: string): Agent {
    const cur = this.get(id);
    const next: Agent = Object.freeze({ ...cur, status: transitionAgent(cur.status, to) });
    this.items.set(id, next);
    this.history.get(id)!.push({ at: Date.now(), status: next.status, note });
    return next;
  }
  remove(id: string): void {
    if (!this.items.has(id)) throw new AgentNotFoundError(id);
    this.items.delete(id);
    this.history.get(id)?.push({ at: Date.now(), status: "archived" });
  }
  getHistory(id: string): readonly AgentHistoryEntry[] { return this.history.get(id) ?? []; }
  getRunHistory(id: string): readonly AgentRunHistoryEntry[] { return this.runHistory.get(id) ?? []; }
  recordRun(id: string, entry: AgentRunHistoryEntry): void {
    const h = this.runHistory.get(id); if (!h) return;
    h.push(entry);
    if (h.length > 512) h.shift();
  }
  getStatistics(id: string): AgentStatistics {
    return { ...(this.stats.get(id) ?? {
      requests: 0, intentsClassified: 0, plansCreated: 0,
      workflowsRequested: 0, workflowsCompleted: 0, workflowsFailed: 0,
      responsesAssembled: 0, failures: 0, totalLatencyMs: 0,
    }) };
  }
  bumpStat(id: string, field: keyof AgentStatistics, by = 1): void {
    const s = this.stats.get(id); if (!s) return;
    s[field] = (s[field] as number) + by;
  }
  snapshot(id: string): AgentSnapshot { return Object.freeze({ agent: this.get(id), takenAt: Date.now() }); }
  size(): number { return this.items.size; }
  clear(): void { this.items.clear(); this.history.clear(); this.runHistory.clear(); this.stats.clear(); }
}
