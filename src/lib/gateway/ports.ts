/** Provider Gateway (P-1.4) — outward ports (ADR-033).
 *  Structural shapes only: no engine internals, no SDK types, no transport.
 */

export interface GatewayEventStorePort {
  append(input: {
    stream: string;
    eventType: string;
    payload?: Readonly<Record<string, unknown>>;
    ownerId?: string | null;
  }): Promise<unknown>;
}

export interface GatewayAuditPort {
  record(entry: {
    actorId: string | null;
    ownerId: string | null;
    action: "create" | "update" | "delete" | "restore" | "read";
    collection: string;
    recordId: string;
    before: Readonly<Record<string, unknown>> | null;
    after: Readonly<Record<string, unknown>> | null;
  }): Promise<unknown>;
}

/** IPCF boundary — the gateway is invoked THROUGH IPCF, never around it. */
export interface GatewayIntegrationPort {
  /** Returns true when the caller passed IPCF governance for this capability. */
  authorize(capability: string, correlationId: string): Promise<boolean> | boolean;
}

/** Existing I-015 Railway connector runtime, structurally. */
export interface RailwayConnectorPort {
  invoke<T = unknown>(
    capability: string,
    payload?: Readonly<Record<string, unknown>>,
  ): Promise<{ data: T } | T>;
  discoverCapabilities?(): readonly { id: string }[];
}

/** Existing I-017 multi-modal runtime, structurally. */
export interface MultiModalPort {
  invoke<T = unknown>(
    capability: string,
    payload?: Readonly<Record<string, unknown>>,
  ): Promise<{ data: T } | T>;
}

/** Workflow Runtime (I-016) — owns long-running polling. No new scheduler. */
export interface GatewayWorkflowPort {
  signal(name: string, payload: Readonly<Record<string, unknown>>): Promise<void>;
}

export interface GatewayPorts {
  readonly eventStore?: GatewayEventStorePort;
  readonly audit?: GatewayAuditPort;
  readonly integration?: GatewayIntegrationPort;
  readonly railway?: RailwayConnectorPort;
  readonly multimodal?: MultiModalPort;
  readonly workflow?: GatewayWorkflowPort;
}
