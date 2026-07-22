/** ARP — Conversation runtime (in-memory only, no persistence). */
import { ConversationNotFoundError } from "./errors";
import { makeConversation, makeTurn } from "./factories";
import { transitionConversation } from "./lifecycle";
import type { Conversation, ConversationSnapshot, ConversationStatus, ConversationSummary, ConversationTurn } from "./types";

export interface ConversationPolicies {
  readonly maxTurns: number;
}

export class ConversationRuntime {
  private readonly items = new Map<string, Conversation>();
  private readonly bySession = new Map<string, Set<string>>();
  constructor(private readonly policies: ConversationPolicies) {}

  create(input: Parameters<typeof makeConversation>[0]): Conversation {
    const c = makeConversation(input);
    this.items.set(c.id, c);
    if (!this.bySession.has(c.sessionId)) this.bySession.set(c.sessionId, new Set());
    this.bySession.get(c.sessionId)!.add(c.id);
    return c;
  }
  get(id: string): Conversation {
    const c = this.items.get(id);
    if (!c) throw new ConversationNotFoundError(id);
    return c;
  }
  has(id: string): boolean { return this.items.has(id); }
  list(): readonly Conversation[] { return [...this.items.values()]; }
  listBySession(sessionId: string): readonly Conversation[] {
    const ids = this.bySession.get(sessionId); if (!ids) return [];
    return [...ids].map(id => this.items.get(id)!).filter(Boolean);
  }
  appendTurn(id: string, input: Parameters<typeof makeTurn>[0]): { conversation: Conversation; turn: ConversationTurn } {
    const cur = this.get(id);
    if (cur.turns.length >= this.policies.maxTurns) throw new Error(`Conversation ${id} exceeded max turns`);
    const turn = makeTurn(input);
    const next: Conversation = Object.freeze({
      ...cur,
      turns: Object.freeze([...cur.turns, turn]),
      metadata: Object.freeze({ ...cur.metadata, updatedAt: turn.at }),
    });
    this.items.set(id, next);
    return { conversation: next, turn };
  }
  transition(id: string, to: ConversationStatus): Conversation {
    const cur = this.get(id);
    const next: Conversation = Object.freeze({ ...cur, status: transitionConversation(cur.status, to) });
    this.items.set(id, next);
    return next;
  }
  summary(id: string): ConversationSummary {
    const c = this.get(id);
    const last = c.turns.at(-1);
    return Object.freeze({
      conversationId: c.id,
      turns: c.turns.length,
      lastTurnAt: last?.at,
      status: c.status,
    });
  }
  snapshot(id: string): ConversationSnapshot {
    return Object.freeze({ conversation: this.get(id), takenAt: Date.now() });
  }
  history(id: string): readonly ConversationTurn[] { return this.get(id).turns; }
  remove(id: string): void {
    const c = this.items.get(id); if (!c) return;
    this.items.delete(id);
    this.bySession.get(c.sessionId)?.delete(id);
  }
  size(): number { return this.items.size; }
  clear(): void { this.items.clear(); this.bySession.clear(); }
}
