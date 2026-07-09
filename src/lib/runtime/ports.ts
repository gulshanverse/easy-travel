/**
 * Runtime Core — External subsystem ports.
 *
 * The runtime NEVER imports Memory Engine or Prompt Runtime internals. It
 * only depends on these minimal port interfaces, so the concrete engines can
 * be provided at composition time (dependency inversion). This keeps Sprint
 * I-003 free of circular dependencies with Sprints I-001 and I-002.
 */

export interface MemoryEnginePort {
  /** Retrieve N memory items relevant to the query for a user/namespace. */
  retrieve(input: {
    userId?: string;
    namespace: string;
    query?: string;
    limit?: number;
  }): Promise<readonly MemoryPortItem[]>;
  /** Return the current health status of the memory engine. */
  healthy(): Promise<boolean>;
}

export interface MemoryPortItem {
  id: string;
  content: string;
  score?: number;
  kind?: string;
}

export interface PromptRuntimePort {
  /** Whether the prompt runtime is initialized and reachable. */
  healthy(): Promise<boolean>;
  /** Return the registered prompt count for observability. */
  registeredPromptCount(): number;
}

export interface SessionPort {
  currentSessionId(): string | undefined;
  currentUserId(): string | undefined;
  currentJourneyId(): string | undefined;
  currentLocale(): string | undefined;
  currentTimezone(): string | undefined;
}

export interface PreferencePort {
  load(userId: string | undefined): Promise<Record<string, unknown>>;
}

export interface GoalPort {
  load(userId: string | undefined): Promise<{ goalIds: readonly string[]; primaryGoalId?: string }>;
}

export interface BudgetPort {
  load(journeyId: string | undefined): Promise<{
    currency: string;
    totalMinor?: number;
    remainingMinor?: number;
  }>;
}

export interface TrustPort {
  load(userId: string | undefined): Promise<{
    score: number;
    scopes: readonly string[];
    retentionOptIn: boolean;
  }>;
}

export interface TimelinePort {
  currentJourneyStage(journeyId: string | undefined): Promise<string | undefined>;
}

/** Placeholder Knowledge Graph port — implementation lives in a future sprint. */
export interface KnowledgeGraphPort {
  neighbors(nodeId: string): Promise<readonly string[]>;
}
