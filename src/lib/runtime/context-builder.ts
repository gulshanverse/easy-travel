/**
 * Runtime Core — Context Builder.
 *
 * Assembles a deterministic ExecutionContext by pulling data from the
 * registered ports (session, preference, goal, budget, trust, timeline,
 * memory). Memory is ALWAYS accessed through the MemoryEnginePort; the
 * builder never touches memory storage directly.
 *
 * Determinism guarantee: given identical port responses and the same base
 * timestamp, the produced ExecutionContext is byte-for-byte identical
 * (modulo per-request ids which are opt-in via `deterministicIds`).
 */

import type { ExecutionContext, ExecutionContextInit } from "./context";
import { createExecutionContext } from "./context";
import { ContextError } from "./errors";
import type {
  BudgetPort,
  GoalPort,
  KnowledgeGraphPort,
  MemoryEnginePort,
  PreferencePort,
  SessionPort,
  TimelinePort,
  TrustPort,
} from "./ports";

export interface ContextBuilderPorts {
  session?: SessionPort;
  memory?: MemoryEnginePort;
  preferences?: PreferencePort;
  goals?: GoalPort;
  budget?: BudgetPort;
  trust?: TrustPort;
  timeline?: TimelinePort;
  knowledgeGraph?: KnowledgeGraphPort;
}

export interface ContextBuildRequest extends ExecutionContextInit {
  /** Optional short query used to prime memory retrieval. */
  memoryQuery?: string;
  /** Max memory items to attach; default 8. */
  memoryLimit?: number;
}

export class ContextBuilder {
  constructor(private readonly ports: ContextBuilderPorts = {}) {}

  async build(request: ContextBuildRequest = {}): Promise<ExecutionContext> {
    try {
      const session = this.ports.session;
      const userId = request.userId ?? session?.currentUserId();
      const journeyId = request.journeyId ?? session?.currentJourneyId();
      const sessionId = request.sessionId ?? session?.currentSessionId();
      const locale = request.locale ?? session?.currentLocale();
      const timezone = request.timezone ?? session?.currentTimezone();

      const [preferences, goals, budget, trust, memoryItems] = await Promise.all([
        this.ports.preferences?.load(userId) ?? Promise.resolve({}),
        this.ports.goals?.load(userId) ?? Promise.resolve({ goalIds: [] as readonly string[] }),
        this.ports.budget?.load(journeyId) ?? Promise.resolve({ currency: request.budget?.currency ?? "USD" }),
        this.ports.trust?.load(userId) ??
          Promise.resolve({ score: 0.5, scopes: [] as readonly string[], retentionOptIn: false }),
        this.ports.memory
          ?.retrieve({
            userId,
            namespace: request.memory?.namespace ?? "default",
            query: request.memoryQuery,
            limit: request.memoryLimit ?? 8,
          })
          .catch(() => []) ?? Promise.resolve([]),
      ]);

      return createExecutionContext({
        ...request,
        userId,
        journeyId,
        sessionId,
        locale,
        timezone,
        preference: { values: preferences, ...(request.preference ?? {}) },
        goal: { ...goals, ...(request.goal ?? {}) },
        budget: { ...budget, ...(request.budget ?? {}) },
        trust: { ...trust, ...(request.trust ?? {}) },
        memory: {
          namespace: request.memory?.namespace ?? "default",
          attachedIds: memoryItems.map((m) => m.id),
          writesEnabled: request.memory?.writesEnabled ?? false,
        },
      });
    } catch (err) {
      if (err instanceof ContextError) throw err;
      throw new ContextError("Failed to build ExecutionContext", { cause: err });
    }
  }
}
