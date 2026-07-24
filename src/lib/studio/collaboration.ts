/** JSR — collaboration model. */
import { newParticipantId } from "./ids";
import { StudioConflictError, StudioPermissionError, StudioValidationError } from "./errors";
import type { PlanningSession, SessionLock, StudioParticipant, StudioParticipantRole } from "./types";

export function makeParticipant(userId: string, role: StudioParticipantRole): StudioParticipant {
  if (!userId) throw new StudioValidationError("participant.userId required");
  return Object.freeze({ id: newParticipantId(), userId, role, joinedAt: Date.now() });
}

export const CollaborationEngine = {
  addParticipant(s: PlanningSession, participant: StudioParticipant, max: number): PlanningSession {
    if (s.participants.length >= max) throw new StudioConflictError("participant limit reached");
    if (s.participants.some(p => p.userId === participant.userId)) {
      throw new StudioConflictError(`participant already present: ${participant.userId}`);
    }
    return Object.freeze({ ...s, participants: Object.freeze([...s.participants, participant]) });
  },
  removeParticipant(s: PlanningSession, participantId: string): PlanningSession {
    const p = s.participants.find(x => x.id === participantId);
    if (!p) throw new StudioValidationError(`participant not found: ${participantId}`);
    if (p.role === "owner" && s.participants.filter(x => x.role === "owner").length === 1) {
      throw new StudioPermissionError("cannot remove the last owner");
    }
    return Object.freeze({ ...s, participants: Object.freeze(s.participants.filter(x => x.id !== participantId)) });
  },
  assertRole(s: PlanningSession, userId: string, roles: readonly StudioParticipantRole[]): void {
    const p = s.participants.find(x => x.userId === userId);
    if (!p || !roles.includes(p.role)) {
      throw new StudioPermissionError(`user ${userId} lacks required role ${roles.join("|")}`);
    }
  },
  lock(s: PlanningSession, userId: string, ttlMs: number, maxTtlMs: number): PlanningSession {
    if (s.lock && s.lock.expiresAt > Date.now() && s.lock.userId !== userId) {
      throw new StudioConflictError(`session locked by ${s.lock.userId}`);
    }
    const dur = Math.max(1, Math.min(ttlMs, maxTtlMs));
    const lock: SessionLock = Object.freeze({ userId, acquiredAt: Date.now(), expiresAt: Date.now() + dur });
    return Object.freeze({ ...s, lock });
  },
  unlock(s: PlanningSession, userId: string): PlanningSession {
    if (!s.lock) return s;
    if (s.lock.userId !== userId) throw new StudioPermissionError("cannot unlock another user's lock");
    return Object.freeze({ ...s, lock: undefined });
  },
  isLocked(s: PlanningSession, atNow = Date.now()): boolean {
    return !!(s.lock && s.lock.expiresAt > atNow);
  },
};
