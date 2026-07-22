/** ARP — external subsystem ports (interface-only).
 *
 * The Agent Runtime MUST NOT import any concrete engine (CTOR, Memory, Graph,
 * Journey, Decision, Trust, Goal, Spatial, Prompt, Provider). It talks to
 * CTOR ONLY through this port. Any workflow / capability execution flows
 * through `AgentCTORPort`.
 */

export interface AgentCapabilityDescriptor {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly features?: readonly string[];
  readonly tags?: readonly string[];
}

export interface AgentWorkflowRequest {
  readonly workflowId?: string;
  readonly steps?: readonly {
    readonly id: string;
    readonly capabilityId?: string;
    readonly toolId?: string;
    readonly input?: Readonly<Record<string, unknown>>;
    readonly dependsOn?: readonly string[];
  }[];
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
}

export type AgentWorkflowStatus = "completed" | "failed" | "cancelled";

export interface AgentWorkflowResult {
  readonly status: AgentWorkflowStatus;
  readonly outputs: Readonly<Record<string, unknown>>;
  readonly ms: number;
  readonly error?: string;
  readonly steps: readonly {
    readonly id: string;
    readonly status: "succeeded" | "failed" | "skipped" | "cancelled";
    readonly ms: number;
  }[];
}

/** All Agent Runtime execution flows through this port only. */
export interface AgentCTORPort {
  healthy(): Promise<boolean>;
  listCapabilities(): Promise<readonly AgentCapabilityDescriptor[]>;
  getCapability(id: string): Promise<AgentCapabilityDescriptor | undefined>;
  isVersionCompatible(id: string, versionRange?: string): Promise<boolean>;
  invokeCapability(
    capabilityId: string,
    input: Readonly<Record<string, unknown>>,
    opts?: { correlationId?: string; causationId?: string; signal?: AbortSignal; timeoutMs?: number },
  ): Promise<unknown>;
  runWorkflow(request: AgentWorkflowRequest): Promise<AgentWorkflowResult>;
}

export interface AgentKernelPort {
  currentUserId(): string | undefined;
  currentSessionId(): string | undefined;
  currentTimezone(): string | undefined;
}

// Governance / observability ports (interface-only, kept optional).
export interface AgentAuditPort {
  record(entry: { at: number; agentId: string; action: string; details?: Record<string, unknown> }): void;
}

export interface AgentPolicyPort {
  isCapabilityAllowed(agentId: string, capabilityId: string): Promise<boolean>;
  isDelegationAllowed(fromAgentId: string, toAgentId: string): Promise<boolean>;
}

// ------- Noop implementations for tests / bootstrap -------
export const noopCTORPort: AgentCTORPort = {
  async healthy() { return true; },
  async listCapabilities() { return []; },
  async getCapability() { return undefined; },
  async isVersionCompatible() { return true; },
  async invokeCapability() { return undefined; },
  async runWorkflow() {
    return { status: "completed", outputs: {}, ms: 0, steps: [] };
  },
};

export const noopKernelPort: AgentKernelPort = {
  currentUserId() { return undefined; },
  currentSessionId() { return undefined; },
  currentTimezone() { return undefined; },
};

export const noopAuditPort: AgentAuditPort = { record() { /* no-op */ } };

export const noopPolicyPort: AgentPolicyPort = {
  async isCapabilityAllowed() { return true; },
  async isDelegationAllowed() { return true; },
};
