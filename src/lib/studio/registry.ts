/** JSR — session registry (in-memory, immutable snapshots). */
import { StudioNotFoundError } from "./errors";
import type { PlanningSession } from "./types";

export class JourneyStudioRegistry {
  private readonly items = new Map<string, PlanningSession>();

  register(session: PlanningSession): void { this.items.set(session.id, session); }
  update(session: PlanningSession): void {
    if (!this.items.has(session.id)) throw new StudioNotFoundError("session", session.id);
    this.items.set(session.id, session);
  }
  get(id: string): PlanningSession | undefined { return this.items.get(id); }
  require(id: string): PlanningSession {
    const s = this.items.get(id);
    if (!s) throw new StudioNotFoundError("session", id);
    return s;
  }
  remove(id: string): boolean { return this.items.delete(id); }
  list(): readonly PlanningSession[] { return [...this.items.values()]; }
  size(): number { return this.items.size; }
  clear(): void { this.items.clear(); }

  expireDue(now = Date.now()): readonly string[] {
    const expired: string[] = [];
    for (const [id, s] of this.items) {
      if (s.expiresAt && s.expiresAt <= now && s.status !== "archived") expired.push(id);
    }
    return expired;
  }
}
