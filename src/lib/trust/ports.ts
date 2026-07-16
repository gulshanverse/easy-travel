/**
 * Trust & Evidence Engine — external subsystem ports.
 * The engine only consumes previous runtimes through these shapes.
 * Composition roots wire concrete adapters. No implementation imports.
 */
export interface TrustMemoryPort {
  fetchEvidenceHints(input: {
    readonly subject: string;
    readonly limit?: number;
  }): Promise<readonly { readonly kind: string; readonly summary: string; readonly score?: number }[]>;
  healthy(): Promise<boolean>;
}

export interface TrustGraphPort {
  relatedSubjects(subject: string, limit?: number): Promise<readonly string[]>;
  healthy(): Promise<boolean>;
}

export interface TrustJourneyPort {
  subjectsForJourney(journeyId: string): Promise<readonly string[]>;
  healthy(): Promise<boolean>;
}

export interface TrustDecisionPort {
  subjectsForDecision(decisionId: string): Promise<readonly string[]>;
  healthy(): Promise<boolean>;
}

export interface TrustPromptPort {
  registeredPromptCount(): number;
  healthy(): Promise<boolean>;
}

export interface TrustProviderPort {
  registeredProviderCount(): number;
  healthy(): Promise<boolean>;
}

export interface TrustKernelPort {
  now(): number;
  currentUserId(): string | undefined;
  currentSessionId(): string | undefined;
}

/* ------------ Test doubles ------------ */
export const noopMemoryPort: TrustMemoryPort = {
  async fetchEvidenceHints() { return []; },
  async healthy() { return true; },
};
export const noopGraphPort: TrustGraphPort = {
  async relatedSubjects() { return []; },
  async healthy() { return true; },
};
export const noopJourneyPort: TrustJourneyPort = {
  async subjectsForJourney() { return []; },
  async healthy() { return true; },
};
export const noopDecisionPort: TrustDecisionPort = {
  async subjectsForDecision() { return []; },
  async healthy() { return true; },
};
export const noopPromptPort: TrustPromptPort = {
  registeredPromptCount() { return 0; },
  async healthy() { return true; },
};
export const noopProviderPort: TrustProviderPort = {
  registeredProviderCount() { return 0; },
  async healthy() { return true; },
};
export const noopKernelPort: TrustKernelPort = {
  now() { return Date.now(); },
  currentUserId() { return undefined; },
  currentSessionId() { return undefined; },
};
