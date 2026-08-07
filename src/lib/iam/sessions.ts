/**
 * IAM Platform — Session Platform.
 * Sliding expiration, idle + absolute timeouts, concurrency caps, revocation
 * and an append-only session history. All state is persisted.
 */
import type { SessionConfig } from "./config";
import { ConcurrentSessionLimitError, SessionExpiredError, SessionRevokedError } from "./errors";
import { newSessionEventId, newSessionId } from "./ids";
import type { CollectionStore } from "./stores";
import type {
  AuthenticationMethod,
  IamSession,
  SessionHistoryEntry,
  SessionMetadata,
  SessionStatus,
} from "./types";

export interface StartSessionInput {
  readonly userId: string;
  readonly method: AuthenticationMethod;
  readonly deviceId?: string | null;
  readonly rememberMe?: boolean;
  readonly guest?: boolean;
  readonly amr?: readonly string[];
  readonly metadata?: Partial<SessionMetadata>;
}

export const emptySessionMetadata: SessionMetadata = Object.freeze({
  ip: null,
  userAgent: null,
  country: null,
  city: null,
  riskScore: 0,
});

export class SessionManager {
  constructor(
    private readonly config: SessionConfig,
    private readonly sessions: CollectionStore<IamSession>,
    private readonly history: CollectionStore<SessionHistoryEntry>,
    private readonly now: () => number = () => Date.now(),
  ) {}

  private absoluteTtl(input: StartSessionInput): number {
    if (input.guest) return this.config.guestTtlMs;
    if (input.rememberMe) return this.config.rememberMeTtlMs;
    return this.config.absoluteTimeoutMs;
  }

  async start(input: StartSessionInput): Promise<IamSession> {
    const at = this.now();
    const active = await this.activeFor(input.userId, at);
    if (active.length >= this.config.maxConcurrentSessions) {
      const oldest = [...active].sort((a, b) => a.lastSeenAt - b.lastSeenAt)[0];
      if (!oldest)
        throw new ConcurrentSessionLimitError("concurrent session limit reached", {
          limit: this.config.maxConcurrentSessions,
        });
      await this.revoke(oldest.id, "concurrent_session_limit");
    }

    const session: IamSession = Object.freeze({
      id: newSessionId(),
      userId: input.userId,
      deviceId: input.deviceId ?? null,
      method: input.method,
      status: "active" as SessionStatus,
      guest: input.guest ?? false,
      rememberMe: input.rememberMe ?? false,
      createdAt: at,
      lastSeenAt: at,
      idleExpiresAt: at + this.config.idleTimeoutMs,
      absoluteExpiresAt: at + this.absoluteTtl(input),
      revokedAt: null,
      revokedReason: null,
      authenticatedAt: at,
      amr: Object.freeze([...(input.amr ?? [])]),
      metadata: Object.freeze({ ...emptySessionMetadata, ...(input.metadata ?? {}) }),
    });
    await this.sessions.put(session);
    await this.record(session, "started", null, at);
    return session;
  }

  async get(id: string): Promise<IamSession | undefined> {
    return this.sessions.get(id);
  }

  statusOf(session: IamSession, at: number): SessionStatus {
    if (session.revokedAt !== null) return "revoked";
    if (at >= session.absoluteExpiresAt) return "expired";
    if (at >= session.idleExpiresAt) return "idle";
    return "active";
  }

  /** Validates and (when sliding expiration is on) extends the idle window. */
  async touch(id: string, at: number = this.now()): Promise<IamSession> {
    const session = await this.requireSession(id);
    const status = this.statusOf(session, at);
    if (status === "revoked") throw new SessionRevokedError("session has been revoked");
    if (status === "expired" || status === "idle") {
      const expired: IamSession = Object.freeze({ ...session, status: "expired" });
      await this.sessions.put(expired);
      await this.record(expired, "expired", status, at);
      throw new SessionExpiredError(`session ${status === "idle" ? "idle timeout" : "expired"}`);
    }
    const next: IamSession = Object.freeze({
      ...session,
      lastSeenAt: at,
      idleExpiresAt: this.config.slidingExpiration ? at + this.config.idleTimeoutMs : session.idleExpiresAt,
      status: "active",
    });
    await this.sessions.put(next);
    await this.record(next, "refreshed", null, at);
    return next;
  }

  async markReauthenticated(id: string, at: number = this.now()): Promise<IamSession> {
    const session = await this.requireSession(id);
    const next: IamSession = Object.freeze({ ...session, authenticatedAt: at, lastSeenAt: at });
    await this.sessions.put(next);
    await this.record(next, "reauthenticated", null, at);
    return next;
  }

  requiresReauthentication(session: IamSession, at: number = this.now()): boolean {
    return at - session.authenticatedAt > this.config.reauthenticationWindowMs;
  }

  async revoke(id: string, reason: string): Promise<IamSession | undefined> {
    const session = await this.sessions.get(id);
    if (!session || session.revokedAt !== null) return session;
    const at = this.now();
    const next: IamSession = Object.freeze({
      ...session,
      status: "revoked",
      revokedAt: at,
      revokedReason: reason,
    });
    await this.sessions.put(next);
    await this.record(next, "revoked", reason, at);
    return next;
  }

  async revokeAllForUser(userId: string, reason: string, except?: string): Promise<number> {
    const sessions = await this.sessions.where(
      (s) => s.userId === userId && s.revokedAt === null && s.id !== except,
    );
    for (const s of sessions) await this.revoke(s.id, reason);
    return sessions.length;
  }

  async revokeAllForDevice(deviceId: string, reason: string): Promise<number> {
    const sessions = await this.sessions.where((s) => s.deviceId === deviceId && s.revokedAt === null);
    for (const s of sessions) await this.revoke(s.id, reason);
    return sessions.length;
  }

  async activeFor(userId: string, at: number = this.now()): Promise<readonly IamSession[]> {
    return (await this.sessions.where((s) => s.userId === userId)).filter(
      (s) => this.statusOf(s, at) === "active",
    );
  }

  async listFor(userId: string): Promise<readonly IamSession[]> {
    return this.sessions.where((s) => s.userId === userId);
  }

  async historyFor(sessionId: string): Promise<readonly SessionHistoryEntry[]> {
    return (await this.history.where((h) => h.sessionId === sessionId)).sort((a, b) => a.at - b.at);
  }

  async pruneExpired(at: number = this.now()): Promise<number> {
    const all = await this.sessions.all();
    let pruned = 0;
    for (const s of all) {
      if (s.revokedAt === null && this.statusOf(s, at) === "expired" && s.status !== "expired") {
        await this.sessions.put(Object.freeze({ ...s, status: "expired" }));
        await this.record(s, "expired", "pruned", at);
        pruned++;
      }
    }
    return pruned;
  }

  async count(): Promise<number> {
    return this.sessions.count();
  }

  private async requireSession(id: string): Promise<IamSession> {
    const session = await this.sessions.get(id);
    if (!session) throw new SessionRevokedError(`unknown session '${id}'`);
    return session;
  }

  private async record(
    session: IamSession,
    action: SessionHistoryEntry["action"],
    reason: string | null,
    at: number,
  ): Promise<void> {
    await this.history.put(
      Object.freeze({
        id: newSessionEventId(),
        sessionId: session.id,
        userId: session.userId,
        action,
        at,
        reason,
      }),
    );
  }
}

/** Declarative session policy, evaluated deterministically. */
export interface SessionPolicyDecision {
  readonly allowed: boolean;
  readonly reasons: readonly string[];
}

export function evaluateSessionPolicy(
  session: IamSession,
  config: SessionConfig,
  at: number,
): SessionPolicyDecision {
  const reasons: string[] = [];
  if (session.revokedAt !== null) reasons.push("session revoked");
  if (at >= session.absoluteExpiresAt) reasons.push("absolute timeout reached");
  if (at >= session.idleExpiresAt) reasons.push("idle timeout reached");
  if (session.guest && at - session.createdAt > config.guestTtlMs) reasons.push("guest session expired");
  return Object.freeze({ allowed: reasons.length === 0, reasons: Object.freeze(reasons) });
}
