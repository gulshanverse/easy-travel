/** JSR — session manager. Owns all mutation orchestration. */
import type { JourneyStudioFactoryDeps } from "./factory";
import type {
  Card, PlanningSession, StudioParticipant, StudioParticipantRole, Workspace,
} from "./types";
import type { StudioAgentRequest } from "./ports";
import type { MakeTimelineItemInput } from "./timeline";
import { CollaborationEngine, makeParticipant } from "./collaboration";
import { EditingEngine, type EditContext } from "./editing";
import { SessionEngine, canTransitionSession, makePlanningSession, transitionSession, type MakePlanningSessionInput } from "./session";
import { StudioConflictError, StudioLifecycleError } from "./errors";

export class JourneyStudioManager {
  constructor(private readonly deps: JourneyStudioFactoryDeps) {}

  // ---------- Sessions ----------
  createSession(input: MakePlanningSessionInput): PlanningSession {
    const s = makePlanningSession({
      ...input,
      ttlMs: input.ttlMs ?? this.deps.config.defaultSessionTtlMs,
    });
    this.deps.registry.register(s);
    this.deps.metrics.sessionCreated();
    this.deps.events.emit({ name: "SessionCreated", sessionId: s.id, data: { id: s.id, agentId: s.agentId } });
    return s;
  }
  get(id: string): PlanningSession | undefined { return this.deps.registry.get(id); }
  require(id: string): PlanningSession { return this.deps.registry.require(id); }
  list(): readonly PlanningSession[] { return this.deps.registry.list(); }

  private commit(next: PlanningSession, event: Parameters<typeof this.deps.events.emit>[0]): PlanningSession {
    this.deps.registry.update(next);
    this.deps.events.emit(event);
    return next;
  }

  activate(id: string): PlanningSession {
    const s = this.require(id);
    const next = transitionSession(s, "active");
    return this.commit(next, { name: "SessionUpdated", sessionId: id, data: { status: next.status } });
  }
  archive(id: string, requester?: string): PlanningSession {
    const s = this.require(id);
    if (this.deps.policies.requireOwnerForArchive && s.participants.length > 0) {
      if (!requester) throw new StudioLifecycleError("archive requires an owner requester");
      CollaborationEngine.assertRole(s, requester, ["owner"]);
    }
    if (!canTransitionSession(s.status, "archived")) {
      const ended = canTransitionSession(s.status, "ended") ? transitionSession(s, "ended") : s;
      const next = transitionSession(ended, "archived");
      this.deps.metrics.sessionArchived();
      return this.commit(next, { name: "SessionArchived", sessionId: id, data: {} });
    }
    const next = transitionSession(s, "archived");
    this.deps.metrics.sessionArchived();
    return this.commit(next, { name: "SessionArchived", sessionId: id, data: {} });
  }
  end(id: string): PlanningSession {
    const s = this.require(id);
    const next = transitionSession(s, "ended");
    this.deps.metrics.sessionEnded();
    return this.commit(next, { name: "SessionEnded", sessionId: id, data: {} });
  }
  expireDue(now = Date.now()): readonly string[] {
    const ids = this.deps.registry.expireDue(now);
    for (const id of ids) {
      const s = this.require(id);
      const nextStatus = canTransitionSession(s.status, "ended") ? "ended" : s.status;
      const next = nextStatus === s.status ? s : transitionSession(s, "ended");
      this.deps.registry.update(next);
      this.deps.metrics.sessionExpired();
      this.deps.events.emit({ name: "SessionExpired", sessionId: id, data: {} });
    }
    return ids;
  }

  // ---------- Participants & locks ----------
  addParticipant(id: string, userId: string, role: StudioParticipantRole): { session: PlanningSession; participant: StudioParticipant } {
    const s = this.require(id);
    const participant = makeParticipant(userId, role);
    const next = CollaborationEngine.addParticipant(s, participant, this.deps.config.maxParticipantsPerSession);
    this.commit(next, { name: "ParticipantJoined", sessionId: id, data: { userId, role } });
    return { session: next, participant };
  }
  removeParticipant(id: string, participantId: string): PlanningSession {
    const s = this.require(id);
    const next = CollaborationEngine.removeParticipant(s, participantId);
    return this.commit(next, { name: "ParticipantLeft", sessionId: id, data: { participantId } });
  }
  lock(id: string, userId: string, ttlMs?: number): PlanningSession {
    const s = this.require(id);
    const next = CollaborationEngine.lock(s, userId, ttlMs ?? this.deps.policies.maxLockDurationMs, this.deps.policies.maxLockDurationMs);
    return this.commit(next, { name: "SessionLocked", sessionId: id, data: { userId } });
  }
  unlock(id: string, userId: string): PlanningSession {
    const s = this.require(id);
    const next = CollaborationEngine.unlock(s, userId);
    return this.commit(next, { name: "SessionUnlocked", sessionId: id, data: { userId } });
  }

  // ---------- Editing ----------
  private ctx(overrides: Partial<EditContext>): EditContext {
    return { config: this.deps.config, policies: this.deps.policies, ...overrides };
  }
  insertCard(id: string, card: Card, opts?: { addToTimeline?: boolean; label?: string; ctx?: Partial<EditContext> }): PlanningSession {
    const s = this.require(id);
    const next = EditingEngine.insertCard(s, card, this.ctx(opts?.ctx ?? {}), { addToTimeline: opts?.addToTimeline, label: opts?.label });
    this.deps.metrics.cardAdded();
    this.deps.metrics.revisionCreated();
    this.deps.metrics.workspaceUpdated();
    if (opts?.addToTimeline) this.deps.metrics.timelineUpdated();
    return this.commit(next, { name: "CardAdded", sessionId: id, data: { cardId: card.id } });
  }
  deleteCard(id: string, cardId: string, ctx: Partial<EditContext> = {}): PlanningSession {
    const s = this.require(id);
    const next = EditingEngine.deleteCard(s, cardId, this.ctx(ctx));
    this.deps.metrics.cardRemoved();
    this.deps.metrics.revisionCreated();
    return this.commit(next, { name: "CardRemoved", sessionId: id, data: { cardId } });
  }
  moveCard(id: string, cardId: string, toIndex: number, ctx: Partial<EditContext> = {}): PlanningSession {
    const s = this.require(id);
    const next = EditingEngine.moveCard(s, cardId, toIndex, this.ctx(ctx));
    this.deps.metrics.revisionCreated();
    return this.commit(next, { name: "CardUpdated", sessionId: id, data: { cardId, toIndex } });
  }
  mergeCards(id: string, targetId: string, sourceId: string, ctx: Partial<EditContext> = {}): PlanningSession {
    const s = this.require(id);
    const next = EditingEngine.mergeCards(s, targetId, sourceId, this.ctx(ctx));
    this.deps.metrics.cardsMerged();
    this.deps.metrics.revisionCreated();
    return this.commit(next, { name: "CardsMerged", sessionId: id, data: { targetId, sourceId } });
  }
  splitCard(id: string, cardId: string, produce: (base: Card) => readonly Card[], ctx: Partial<EditContext> = {}): PlanningSession {
    const s = this.require(id);
    const next = EditingEngine.splitCard(s, cardId, produce, this.ctx(ctx));
    this.deps.metrics.cardSplit();
    this.deps.metrics.revisionCreated();
    return this.commit(next, { name: "CardSplit", sessionId: id, data: { cardId } });
  }
  insertTimelineItem(id: string, item: MakeTimelineItemInput, ctx: Partial<EditContext> = {}): PlanningSession {
    const s = this.require(id);
    const next = EditingEngine.insertTimelineItem(s, item, this.ctx(ctx));
    this.deps.metrics.timelineUpdated();
    this.deps.metrics.revisionCreated();
    return this.commit(next, { name: "TimelineUpdated", sessionId: id, data: { op: "insert" } });
  }
  reorderTimeline(id: string, orderedIds: readonly string[], ctx: Partial<EditContext> = {}): PlanningSession {
    const s = this.require(id);
    const next = EditingEngine.reorderTimeline(s, orderedIds, this.ctx(ctx));
    this.deps.metrics.timelineUpdated();
    this.deps.metrics.revisionCreated();
    return this.commit(next, { name: "TimelineUpdated", sessionId: id, data: { op: "reorder" } });
  }
  rollbackToRevision(id: string, revisionId: string, ctx: Partial<EditContext> = {}): PlanningSession {
    const s = this.require(id);
    const next = EditingEngine.rollbackToRevision(s, revisionId, this.ctx(ctx));
    this.deps.metrics.revisionRestored();
    return this.commit(next, { name: "RevisionRestored", sessionId: id, data: { revisionId } });
  }

  // ---------- Draft & versions ----------
  startDraft(id: string, workspace: Workspace, notes?: string): PlanningSession {
    const s = this.require(id);
    const next = SessionEngine.startDraft(s, workspace, notes);
    this.deps.metrics.draftCreated();
    return this.commit(next, { name: "DraftCreated", sessionId: id, data: { draftId: next.draft!.id } });
  }
  discardDraft(id: string): PlanningSession {
    const s = this.require(id);
    if (!s.draft) return s;
    const next = SessionEngine.discardDraft(s);
    this.deps.metrics.draftDiscarded();
    return this.commit(next, { name: "DraftDiscarded", sessionId: id, data: {} });
  }
  promoteDraft(id: string, ctx: Partial<EditContext> = {}): PlanningSession {
    const s = this.require(id);
    const next = EditingEngine.promoteDraft(s, this.ctx(ctx));
    this.deps.metrics.draftPromoted();
    this.deps.metrics.revisionCreated();
    return this.commit(next, { name: "DraftPromoted", sessionId: id, data: {} });
  }
  promoteVersion(id: string, label: string): PlanningSession {
    const s = this.require(id);
    const next = SessionEngine.promoteVersion(s, label);
    return this.commit(next, { name: "VersionPromoted", sessionId: id, data: { label } });
  }
  addCheckpoint(id: string, label: string): PlanningSession {
    const s = this.require(id);
    const next = SessionEngine.addCheckpoint(s, label, this.deps.config.maxCheckpointsPerSession);
    return this.commit(next, { name: "TimelineCheckpointCreated", sessionId: id, data: { label } });
  }
  detectConflict(id: string, expectedRevisionNumber: number): boolean {
    const s = this.require(id);
    const c = SessionEngine.detectConflict(s, expectedRevisionNumber);
    if (c) {
      this.deps.metrics.conflictDetected();
      this.deps.events.emit({ name: "ConflictDetected", sessionId: id, data: { expected: expectedRevisionNumber, actual: s.revisionNumber } });
    }
    return c;
  }
  currentWorkspace(id: string): Workspace {
    return SessionEngine.currentWorkspace(this.require(id));
  }
  snapshot(id: string) { return SessionEngine.snapshot(this.require(id)); }

  // ---------- Presentation ----------
  async requestAndApply(id: string, request: Omit<StudioAgentRequest, "sessionId">, opts?: { addToTimeline?: boolean }): Promise<PlanningSession> {
    const s = this.require(id);
    if (s.status === "archived" || s.status === "ended") {
      throw new StudioConflictError(`session ${s.status} cannot receive presentations`);
    }
    const span = this.deps.telemetry.startSpan("studio.requestAndApply", { sessionId: id });
    try {
      const response = await this.deps.agent.handleRequest({ ...request, sessionId: id });
      const applied = this.deps.presentation.apply({
        response,
        baseWorkspace: SessionEngine.currentWorkspace(s),
        addToTimeline: opts?.addToTimeline,
      });
      const next = SessionEngine.createRevision(s, applied.workspace,
        `presentation from response ${response.id}`, undefined, this.deps.config.maxRevisionsPerSession);
      this.deps.registry.update(next);
      this.deps.metrics.presentationApplied();
      for (let i = 0; i < applied.cards.length; i++) this.deps.metrics.cardAdded();
      this.deps.metrics.revisionCreated();
      this.deps.events.emit({ name: "PresentationApplied", sessionId: id,
        data: { responseId: response.id, cards: applied.cards.length } });
      span.end("ok");
      return next;
    } catch (err) {
      this.deps.metrics.presentationFailed();
      span.end("error", err as Error);
      throw err;
    }
  }
}
