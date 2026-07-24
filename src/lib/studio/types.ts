/** JSR — presentation-layer domain types. All entities are immutable. */

export type CardKind =
  | "destination" | "journey" | "decision" | "trust" | "goal"
  | "budget" | "timeline" | "warning" | "recommendation" | "insight";

export interface Card {
  readonly id: string;
  readonly kind: CardKind;
  readonly title: string;
  readonly subtitle?: string;
  readonly body?: string;
  readonly data: Readonly<Record<string, unknown>>;
  readonly tags: readonly string[];
  readonly createdAt: number;
  readonly sourceAgentResponseId?: string;
}

export interface TimelineItem {
  readonly id: string;
  readonly cardId?: string;
  readonly label: string;
  readonly startAt?: number;
  readonly endAt?: number;
  readonly order: number;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface TimelineGroup {
  readonly id: string;
  readonly label: string;
  readonly itemIds: readonly string[];
}

export interface TimelineSection {
  readonly id: string;
  readonly label: string;
  readonly startAt?: number;
  readonly endAt?: number;
  readonly groups: readonly TimelineGroup[];
}

export interface TimelineEvent {
  readonly id: string;
  readonly kind: "insert" | "delete" | "move" | "reorder" | "checkpoint";
  readonly at: number;
  readonly refItemIds: readonly string[];
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface TimelineCheckpoint {
  readonly id: string;
  readonly label: string;
  readonly at: number;
  readonly itemIdsSnapshot: readonly string[];
}

export interface Timeline {
  readonly id: string;
  readonly version: number;
  readonly items: readonly TimelineItem[];
  readonly sections: readonly TimelineSection[];
  readonly events: readonly TimelineEvent[];
  readonly checkpoints: readonly TimelineCheckpoint[];
}

export interface TimelineVersion {
  readonly id: string;
  readonly version: number;
  readonly timeline: Timeline;
  readonly createdAt: number;
}

export interface TimelineHistory {
  readonly versions: readonly TimelineVersion[];
}

export interface WorkspaceSelection {
  readonly selectedCardIds: readonly string[];
  readonly selectedItemIds: readonly string[];
  readonly focusCardId?: string;
}

export interface WorkspaceLayout {
  readonly mode: "columns" | "board" | "timeline" | "map";
  readonly columns: number;
}

export interface WorkspaceContext {
  readonly userId?: string;
  readonly locale?: string;
  readonly timezone?: string;
  readonly variables: Readonly<Record<string, unknown>>;
}

export interface WorkspaceMetadata {
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly labels: readonly string[];
}

export type WorkspaceStatus =
  | "empty" | "populated" | "editing" | "reviewing" | "locked" | "archived";

export interface Workspace {
  readonly id: string;
  readonly status: WorkspaceStatus;
  readonly cards: readonly Card[];
  readonly timeline: Timeline;
  readonly selection: WorkspaceSelection;
  readonly layout: WorkspaceLayout;
  readonly context: WorkspaceContext;
  readonly metadata: WorkspaceMetadata;
}

export interface WorkspaceHistoryEntry {
  readonly at: number;
  readonly action: string;
  readonly details: Readonly<Record<string, unknown>>;
}

export interface WorkspaceHistory {
  readonly entries: readonly WorkspaceHistoryEntry[];
}

export interface WorkspaceState {
  readonly workspace: Workspace;
  readonly history: WorkspaceHistory;
}

// ------- Planning session -------
export type StudioParticipantRole = "owner" | "editor" | "observer";
export interface StudioParticipant {
  readonly id: string;
  readonly userId: string;
  readonly role: StudioParticipantRole;
  readonly joinedAt: number;
}

export interface SessionLock {
  readonly userId: string;
  readonly acquiredAt: number;
  readonly expiresAt: number;
}

export interface PlanningDraft {
  readonly id: string;
  readonly workspace: Workspace;
  readonly createdAt: number;
  readonly notes?: string;
}

export interface PlanningRevision {
  readonly id: string;
  readonly number: number;
  readonly workspace: Workspace;
  readonly createdBy?: string;
  readonly createdAt: number;
  readonly parentRevisionId?: string;
  readonly notes?: string;
}

export interface PlanningVersion {
  readonly id: string;
  readonly label: string;
  readonly revisionId: string;
  readonly createdAt: number;
}

export interface PlanningCheckpoint {
  readonly id: string;
  readonly label: string;
  readonly revisionId: string;
  readonly createdAt: number;
}

export interface PlanningSnapshot {
  readonly id: string;
  readonly capturedAt: number;
  readonly workspace: Workspace;
}

export interface PlanningHistoryEntry {
  readonly at: number;
  readonly kind: string;
  readonly revisionId?: string;
  readonly details: Readonly<Record<string, unknown>>;
}

export interface PlanningHistory {
  readonly entries: readonly PlanningHistoryEntry[];
}

export interface PlanningMetadata {
  readonly title: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly labels: readonly string[];
  readonly variables: Readonly<Record<string, unknown>>;
}

export type PlanningSessionStatus =
  | "created" | "active" | "editing" | "reviewing" | "paused"
  | "locked" | "archived" | "ended";

export interface PlanningSession {
  readonly id: string;
  readonly agentId: string;
  readonly status: PlanningSessionStatus;
  readonly revisionNumber: number;
  readonly currentRevisionId: string;
  readonly draft?: PlanningDraft;
  readonly revisions: readonly PlanningRevision[];
  readonly versions: readonly PlanningVersion[];
  readonly checkpoints: readonly PlanningCheckpoint[];
  readonly history: PlanningHistory;
  readonly participants: readonly StudioParticipant[];
  readonly lock?: SessionLock;
  readonly metadata: PlanningMetadata;
  readonly expiresAt?: number;
}
