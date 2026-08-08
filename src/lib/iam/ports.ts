/**
 * IAM Platform — external subsystem ports (ADR-025/026/027).
 *
 * IAM integrates ONLY with Identity, Persistence, Workflow, Agent and Studio.
 * It never imports Journey, Decision, Goal, Trust, Railway, MultiModal or
 * Spatial internals — only the structural shapes below.
 */

export type IamDoc = Record<string, unknown>;

/** Minimal repository shape borrowed structurally from the Persistence Platform. */
export interface IamRepository<T extends IamDoc = IamDoc> {
  readonly collection: string;
  save(id: string, data: T, ownerId?: string | null): Promise<unknown>;
  insert(id: string, data: T, ownerId?: string | null): Promise<unknown>;
  findById(id: string, includeDeleted?: boolean): Promise<{ data: T } | null>;
  find(options?: { specification?: unknown; limit?: number }): Promise<readonly { data: T }[]>;
  count(options?: { specification?: unknown }): Promise<number>;
  hardDelete(id: string): Promise<boolean>;
}

/** Persistence port: resolves a repository for an IAM collection. */
export interface IamPersistencePort {
  repository<T extends IamDoc>(collection: string): IamRepository<T>;
}

/** Audit port backed by the P-1.1 Audit Store. */
export interface IamAuditPort {
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

/** Event Store port backed by the P-1.1 append-only Event Store. */
export interface IamEventStorePort {
  append(input: {
    stream: string;
    eventType: string;
    payload?: Readonly<Record<string, unknown>>;
    ownerId?: string | null;
  }): Promise<unknown>;
}

/** Transactional Outbox port backed by the P-1.1 Outbox Store. */
export interface IamOutboxPort {
  enqueue(topic: string, payload?: Readonly<Record<string, unknown>>): Promise<unknown>;
}

/** Identity Platform port — IAM extends identity, never duplicates it. */

export interface IamIdentityPort {
  userExists(userId: string): Promise<boolean>;
  personalizationSuppressed?(userId: string): Promise<boolean>;
}

export interface IamWorkflowPort {
  signal(name: string, payload: Readonly<Record<string, unknown>>): Promise<void>;
}

export interface IamAgentPort {
  currentActorId(): string | undefined;
}

export interface IamStudioPort {
  publishCards(userId: string, cards: readonly unknown[]): void;
}

export interface IamPorts {
  readonly persistence?: IamPersistencePort;
  readonly audit?: IamAuditPort;
  readonly eventStore?: IamEventStorePort;
  readonly outbox?: IamOutboxPort;

  readonly identity?: IamIdentityPort;
  readonly workflow?: IamWorkflowPort;
  readonly agent?: IamAgentPort;
  readonly studio?: IamStudioPort;
}

export const noopIdentityPort: IamIdentityPort = {
  async userExists() {
    return true;
  },
};
export const noopWorkflowPort: IamWorkflowPort = {
  async signal() {
    /* noop */
  },
};
export const noopAgentPort: IamAgentPort = {
  currentActorId() {
    return undefined;
  },
};
export const noopStudioPort: IamStudioPort = {
  publishCards() {
    /* noop */
  },
};
