/** ARP — Session runtime. */
import { SessionNotFoundError } from "./errors";
import { makeSession } from "./factories";
import { transitionSession } from "./lifecycle";
import type { Session, SessionHealth, SessionStatus } from "./types";

export class SessionRegistry {
  private readonly items = new Map<string, Session>();
  private readonly byAgent = new Map<string, Set<string>>();

  create(input: Parameters<typeof makeSession>[0]): Session {
    const s = makeSession(input);
    this.items.set(s.id, s);
    if (!this.byAgent.has(s.agentId)) this.byAgent.set(s.agentId, new Set());
    this.byAgent.get(s.agentId)!.add(s.id);
    return s;
  }
  get(id: string): Session {
    const s = this.items.get(id);
    if (!s) throw new SessionNotFoundError(id);
    return s;
  }
  has(id: string): boolean { return this.items.has(id); }
  list(): readonly Session[] { return [...this.items.values()]; }
  listByAgent(agentId: string): readonly Session[] {
    const ids = this.byAgent.get(agentId); if (!ids) return [];
    return [...ids].map(id => this.items.get(id)!).filter(Boolean);
  }
  touch(id: string, now = Date.now()): Session {
    const cur = this.get(id);
    const next: Session = Object.freeze({
      ...cur,
      metadata: Object.freeze({ ...cur.metadata, lastActiveAt: now }),
    });
    this.items.set(id, next);
    return next;
  }
  linkConversation(id: string, conversationId: string): Session {
    const cur = this.get(id);
    if (cur.conversations.includes(conversationId)) return cur;
    const next: Session = Object.freeze({
      ...cur,
      conversations: Object.freeze([...cur.conversations, conversationId]),
    });
    this.items.set(id, next);
    return next;
  }
  transition(id: string, to: SessionStatus): Session {
    const cur = this.get(id);
    const next: Session = Object.freeze({ ...cur, status: transitionSession(cur.status, to) });
    this.items.set(id, next);
    return next;
  }
  expireStale(now = Date.now()): readonly Session[] {
    const expired: Session[] = [];
    for (const s of this.items.values()) {
      if (s.status !== "active" && s.status !== "idle") continue;
      if (now - s.metadata.lastActiveAt > s.metadata.ttlMs) {
        const next: Session = Object.freeze({ ...s, status: "expired" });
        this.items.set(s.id, next);
        expired.push(next);
      }
    }
    return expired;
  }
  health(id: string): SessionHealth {
    const s = this.get(id);
    const healthy = s.status === "active" || s.status === "idle";
    return Object.freeze({ sessionId: s.id, healthy, checkedAt: Date.now(), reason: healthy ? undefined : `status=${s.status}` });
  }
  remove(id: string): void {
    const s = this.items.get(id); if (!s) return;
    this.items.delete(id);
    this.byAgent.get(s.agentId)?.delete(id);
  }
  size(): number { return this.items.size; }
  clear(): void { this.items.clear(); this.byAgent.clear(); }
}

export type SessionManager = SessionRegistry;
