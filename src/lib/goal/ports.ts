/**
 * Goal Engine — external subsystem ports.
 * Goal Intelligence orchestrates through these shapes ONLY. Composition
 * roots wire concrete adapters. No implementation imports.
 */
export interface GoalMemoryPort {
  fetchHints(input: {
    readonly ownerId: string;
    readonly namespace: string;
    readonly query?: string;
    readonly limit?: number;
  }): Promise<readonly { readonly kind: string; readonly summary: string; readonly score?: number }[]>;
  healthy(): Promise<boolean>;
}

export interface GoalJourneyPort {
  attachJourney(goalId: string, journeyId: string): Promise<void>;
  journeyProgress(journeyId: string): Promise<number>;
  healthy(): Promise<boolean>;
}

export interface GoalDecisionPort {
  decisionsForGoal(goalId: string): Promise<readonly string[]>;
  decisionProgress(goalId: string): Promise<number>;
  healthy(): Promise<boolean>;
}

export interface GoalTrustPort {
  trustFor(subject: string): Promise<{ readonly value: number; readonly level: string }>;
  healthy(): Promise<boolean>;
}

export interface GoalGraphPort {
  relatedGoals(goalId: string, limit?: number): Promise<readonly string[]>;
  healthy(): Promise<boolean>;
}

export interface GoalPromptPort {
  registeredPromptCount(): number;
  healthy(): Promise<boolean>;
}

export interface GoalProviderPort {
  registeredProviderCount(): number;
  healthy(): Promise<boolean>;
}

export interface GoalKernelPort {
  now(): number;
  currentUserId(): string | undefined;
  currentSessionId(): string | undefined;
}

/* --- Test doubles --- */
export const noopMemoryPort: GoalMemoryPort = {
  async fetchHints() { return []; },
  async healthy() { return true; },
};
export const noopJourneyPort: GoalJourneyPort = {
  async attachJourney() { /* noop */ },
  async journeyProgress() { return 0; },
  async healthy() { return true; },
};
export const noopDecisionPort: GoalDecisionPort = {
  async decisionsForGoal() { return []; },
  async decisionProgress() { return 0; },
  async healthy() { return true; },
};
export const noopTrustPort: GoalTrustPort = {
  async trustFor() { return { value: 0.5, level: "medium" }; },
  async healthy() { return true; },
};
export const noopGraphPort: GoalGraphPort = {
  async relatedGoals() { return []; },
  async healthy() { return true; },
};
export const noopPromptPort: GoalPromptPort = {
  registeredPromptCount() { return 0; },
  async healthy() { return true; },
};
export const noopProviderPort: GoalProviderPort = {
  registeredProviderCount() { return 0; },
  async healthy() { return true; },
};
export const noopKernelPort: GoalKernelPort = {
  now() { return Date.now(); },
  currentUserId() { return undefined; },
  currentSessionId() { return undefined; },
};
