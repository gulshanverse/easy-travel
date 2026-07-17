/**
 * Goal Engine — typed event bus.
 */
import { newEventId } from "./ids";

export type GoalEventName =
  | "GoalCreated" | "GoalUpdated" | "GoalDeleted"
  | "GoalStarted" | "GoalPaused" | "GoalBlocked" | "GoalResumed"
  | "GoalCompleted" | "GoalCancelled" | "GoalArchived"
  | "MilestoneCreated" | "MilestoneCompleted" | "MilestoneBlocked"
  | "StepCompleted"
  | "PlanCreated" | "PlanRevised" | "GoalReplanned"
  | "ProgressUpdated" | "GoalConflictDetected" | "GoalMerged" | "GoalSplit"
  | "GoalTransitioned";

export interface GoalEvent {
  readonly id: string;
  readonly name: GoalEventName;
  readonly at: number;
  readonly version: number;
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly goalId?: string;
  readonly data: Readonly<Record<string, unknown>>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export type GoalEventListener = (event: GoalEvent) => void;

export interface EmitGoalEventInput {
  name: GoalEventName;
  at: number;
  goalId?: string;
  correlationId?: string;
  causationId?: string;
  data?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export class GoalEventBus {
  private readonly listeners = new Set<GoalEventListener>();
  emit(input: EmitGoalEventInput): GoalEvent {
    const ev: GoalEvent = Object.freeze({
      id: newEventId(),
      name: input.name,
      at: input.at,
      version: 1,
      correlationId: input.correlationId,
      causationId: input.causationId,
      goalId: input.goalId,
      data: Object.freeze({ ...(input.data ?? {}) }),
      metadata: input.metadata ? Object.freeze({ ...input.metadata }) : undefined,
    });
    for (const l of this.listeners) { try { l(ev); } catch { /* isolate */ } }
    return ev;
  }
  on(listener: GoalEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  clear(): void { this.listeners.clear(); }
  get size(): number { return this.listeners.size; }
}
