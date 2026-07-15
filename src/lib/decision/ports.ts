/**
 * Decision Runtime — External subsystem ports.
 * The Decision Engine is an orchestrator. It never imports Memory, Graph,
 * Journey, Prompt or Provider internals — only these shapes. The
 * composition root wires concrete adapters.
 */

// ---------- Memory ----------
export interface DecisionMemoryItem {
  readonly id: string;
  readonly kind: string;
  readonly content: string;
  readonly score?: number;
}
export interface DecisionMemoryPort {
  retrieve(input: {
    ownerId: string;
    namespace: string;
    query?: string;
    limit?: number;
    kinds?: readonly string[];
  }): Promise<readonly DecisionMemoryItem[]>;
  healthy(): Promise<boolean>;
}

// ---------- Graph ----------
export interface DecisionGraphPort {
  seedForDecision(decisionId: string, journeyId?: string): Promise<readonly string[]>;
  neighbors(nodeId: string, limit?: number): Promise<readonly string[]>;
  healthy(): Promise<boolean>;
}

// ---------- Journey ----------
export interface DecisionJourneyPort {
  fetchJourneySignals(journeyId: string): Promise<{
    readonly budgetMinor?: number;
    readonly currency?: string;
    readonly preferenceKeys: readonly string[];
    readonly constraintKinds: readonly string[];
    readonly destinationTags: readonly string[];
  } | null>;
  healthy(): Promise<boolean>;
}

// ---------- Prompt (extension point only) ----------
export interface DecisionPromptPort {
  registeredPromptCount(): number;
  healthy(): Promise<boolean>;
}

// ---------- Provider (extension point only) ----------
export interface DecisionProviderPort {
  registeredProviderCount(): number;
  healthy(): Promise<boolean>;
}

// ---------- Runtime kernel ----------
export interface DecisionKernelPort {
  currentUserId(): string | undefined;
  currentSessionId(): string | undefined;
  currentTimezone(): string | undefined;
}

// ---------- Test doubles ----------
export const noopMemoryPort: DecisionMemoryPort = {
  async retrieve() { return []; },
  async healthy() { return true; },
};
export const noopGraphPort: DecisionGraphPort = {
  async seedForDecision() { return []; },
  async neighbors() { return []; },
  async healthy() { return true; },
};
export const noopJourneyPort: DecisionJourneyPort = {
  async fetchJourneySignals() { return null; },
  async healthy() { return true; },
};
export const noopPromptPort: DecisionPromptPort = {
  registeredPromptCount() { return 0; },
  async healthy() { return true; },
};
export const noopProviderPort: DecisionProviderPort = {
  registeredProviderCount() { return 0; },
  async healthy() { return true; },
};
export const noopKernelPort: DecisionKernelPort = {
  currentUserId() { return undefined; },
  currentSessionId() { return undefined; },
  currentTimezone() { return undefined; },
};
