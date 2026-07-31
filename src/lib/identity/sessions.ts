/**
 * Identity Platform — Device session helpers.
 * Session bookkeeping only: no authentication, no tokens, no credentials.
 */
import { deepFreeze } from "./factories";
import type { DeviceSession } from "./types";

export function touchSession(session: DeviceSession, at: number, ttlMs?: number): DeviceSession {
  return deepFreeze({
    ...session,
    lastSeenAt: at,
    expiresAt: ttlMs ? at + ttlMs : session.expiresAt,
  });
}

export function revokeSession(session: DeviceSession, at: number): DeviceSession {
  if (session.revokedAt) return session;
  return deepFreeze({ ...session, revokedAt: at });
}

export function isSessionActive(session: DeviceSession, at: number): boolean {
  return session.revokedAt === null && session.expiresAt > at;
}

export function activeSessions(
  sessions: readonly DeviceSession[],
  at: number,
): readonly DeviceSession[] {
  return Object.freeze(sessions.filter((s) => isSessionActive(s, at)));
}

export function pruneExpired(
  sessions: readonly DeviceSession[],
  at: number,
): { readonly kept: readonly DeviceSession[]; readonly pruned: readonly DeviceSession[] } {
  const kept: DeviceSession[] = [];
  const pruned: DeviceSession[] = [];
  for (const s of sessions) (isSessionActive(s, at) ? kept : pruned).push(s);
  return Object.freeze({ kept: Object.freeze(kept), pruned: Object.freeze(pruned) });
}
