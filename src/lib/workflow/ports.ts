/** WAR — outward-facing ports.
 *
 * WAR communicates ONLY with Agent Runtime, CTOR and IPCF (ADR-013/014).
 * Interfaces only — no engine imports, no connector imports, no SDK types.
 */

export interface WorkflowCtorPort {
  healthy(): Promise<boolean>;
  /** Execute a capability. Capability execution is owned by CTOR (ADR-014). */
  invokeCapability(input: {
    readonly capabilityId: string;
    readonly input: Readonly<Record<string, unknown>>;
    readonly correlationId: string;
    readonly timeoutMs: number;
  }): Promise<unknown>;
}

export interface WorkflowAgentPort {
  healthy(): Promise<boolean>;
  /** Ask the Agent Runtime to reason about a workflow step. */
  reason(input: {
    readonly agentId: string;
    readonly instruction: string;
    readonly correlationId: string;
    readonly payload?: Readonly<Record<string, unknown>>;
  }): Promise<unknown>;
}

export interface WorkflowIntegrationPort {
  healthy(): Promise<boolean>;
  /** Execute an external capability through IPCF. */
  invokeConnector(input: {
    readonly connectorId: string;
    readonly capabilityId: string;
    readonly input: Readonly<Record<string, unknown>>;
    readonly correlationId: string;
  }): Promise<unknown>;
}

/** In-memory state persistence interface (no external storage — ADR-013). */
export interface WorkflowStatePersistencePort {
  save(key: string, value: unknown): Promise<void>;
  load(key: string): Promise<unknown>;
  remove(key: string): Promise<void>;
  keys(): Promise<readonly string[]>;
}

export const noopCtorPort: WorkflowCtorPort = {
  async healthy() {
    return true;
  },
  async invokeCapability({ capabilityId }) {
    return { capabilityId, ok: true };
  },
};
export const noopAgentPort: WorkflowAgentPort = {
  async healthy() {
    return true;
  },
  async reason({ instruction }) {
    return { instruction, ok: true };
  },
};
export const noopIntegrationPort: WorkflowIntegrationPort = {
  async healthy() {
    return true;
  },
  async invokeConnector({ connectorId, capabilityId }) {
    return { connectorId, capabilityId, ok: true };
  },
};

export class InMemoryStatePersistence implements WorkflowStatePersistencePort {
  private readonly store = new Map<string, unknown>();
  async save(key: string, value: unknown): Promise<void> {
    this.store.set(key, value);
  }
  async load(key: string): Promise<unknown> {
    return this.store.get(key);
  }
  async remove(key: string): Promise<void> {
    this.store.delete(key);
  }
  async keys(): Promise<readonly string[]> {
    return [...this.store.keys()].sort();
  }
  clear(): void {
    this.store.clear();
  }
  get size(): number {
    return this.store.size;
  }
}
