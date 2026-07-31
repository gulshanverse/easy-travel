/**
 * Identity Platform — external subsystem ports (ADR-019).
 *
 * Identity integrates ONLY with Agent Runtime, Workflow Runtime,
 * Journey Studio and the Memory Engine — and only through these
 * interface shapes. No connector, provider or transport import is
 * permitted anywhere in this package.
 */

export interface IdentityMemoryPort {
  remember(input: {
    userId: string;
    namespace: string;
    key: string;
    value: Readonly<Record<string, unknown>>;
    importance?: number;
  }): Promise<void>;
  recall(input: {
    userId: string;
    namespace: string;
    limit?: number;
  }): Promise<readonly Readonly<Record<string, unknown>>[]>;
  healthy(): Promise<boolean>;
}

export interface IdentityAgentPort {
  /** Supplies deterministic personalization hints to hosted agents. */
  publishUserContext(userId: string, context: Readonly<Record<string, unknown>>): Promise<void>;
  healthy(): Promise<boolean>;
}

export interface IdentityWorkflowPort {
  /** Requests a monitoring workflow when a notification rule is enabled. */
  ensureWorkflow(input: {
    userId: string;
    definitionId: string;
    variables?: Readonly<Record<string, unknown>>;
  }): Promise<string | undefined>;
  cancelWorkflow(instanceId: string): Promise<void>;
  healthy(): Promise<boolean>;
}

export interface IdentityStudioPort {
  /** Journey Studio consumes identity presentation cards only. */
  publishCards(userId: string, cards: readonly Readonly<Record<string, unknown>>[]): Promise<void>;
  healthy(): Promise<boolean>;
}

export interface IdentityKernelPort {
  currentUserId(): string | undefined;
  currentLocale(): string | undefined;
  currentTimezone(): string | undefined;
}

export const noopIdentityMemoryPort: IdentityMemoryPort = {
  async remember() { /* noop */ },
  async recall() { return []; },
  async healthy() { return true; },
};
export const noopIdentityAgentPort: IdentityAgentPort = {
  async publishUserContext() { /* noop */ },
  async healthy() { return true; },
};
export const noopIdentityWorkflowPort: IdentityWorkflowPort = {
  async ensureWorkflow() { return undefined; },
  async cancelWorkflow() { /* noop */ },
  async healthy() { return true; },
};
export const noopIdentityStudioPort: IdentityStudioPort = {
  async publishCards() { /* noop */ },
  async healthy() { return true; },
};
export const noopIdentityKernelPort: IdentityKernelPort = {
  currentUserId() { return undefined; },
  currentLocale() { return undefined; },
  currentTimezone() { return undefined; },
};

export interface IdentityPorts {
  readonly memory?: IdentityMemoryPort;
  readonly agent?: IdentityAgentPort;
  readonly workflow?: IdentityWorkflowPort;
  readonly studio?: IdentityStudioPort;
  readonly kernel?: IdentityKernelPort;
}
