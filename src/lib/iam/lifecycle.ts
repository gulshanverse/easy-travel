/**
 * IAM Platform — Account Lifecycle.
 *
 * Account state is explicit, immutable and transition-validated. Illegal
 * transitions fail deterministically; every transition is recorded in an
 * append-only history and surfaced as an auditable security event.
 */
import { IamError } from "./errors";
import { newAccountLifecycleId, newAccountTransitionId } from "./ids";
import type { CollectionStore } from "./stores";

export type AccountLifecycleState =
  | "pending"
  | "active"
  | "suspended"
  | "locked"
  | "disabled"
  | "deleted"
  | "archived";

export const ACCOUNT_LIFECYCLE_STATES: readonly AccountLifecycleState[] = Object.freeze([
  "pending",
  "active",
  "suspended",
  "locked",
  "disabled",
  "deleted",
  "archived",
]);

export class AccountLifecycleError extends IamError {}

export interface AccountLifecycleRecord {
  readonly id: string;
  /** Identity Platform user id — IAM never owns the identity itself. */
  readonly userId: string;
  readonly state: AccountLifecycleState;
  readonly reason: string | null;
  readonly since: number;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface AccountLifecycleTransition {
  readonly id: string;
  readonly userId: string;
  readonly from: AccountLifecycleState;
  readonly to: AccountLifecycleState;
  readonly reason: string | null;
  readonly actorId: string | null;
  readonly at: number;
}

/** Declarative, immutable transition table. Anything absent is illegal. */
export interface AccountLifecyclePolicy {
  readonly transitions: Readonly<Record<AccountLifecycleState, readonly AccountLifecycleState[]>>;
  /** States that are terminal for authentication purposes. */
  readonly nonAuthenticatable: readonly AccountLifecycleState[];
  /** Transitions that must always produce a security audit record. */
  readonly securitySensitive: readonly AccountLifecycleState[];
}

export const DEFAULT_ACCOUNT_LIFECYCLE_POLICY: AccountLifecyclePolicy = Object.freeze({
  transitions: Object.freeze({
    pending: Object.freeze<AccountLifecycleState[]>(["active", "disabled", "deleted"]),
    active: Object.freeze<AccountLifecycleState[]>(["suspended", "locked", "disabled", "deleted"]),
    suspended: Object.freeze<AccountLifecycleState[]>(["active", "disabled", "deleted"]),
    locked: Object.freeze<AccountLifecycleState[]>(["active", "suspended", "disabled", "deleted"]),
    disabled: Object.freeze<AccountLifecycleState[]>(["active", "deleted", "archived"]),
    deleted: Object.freeze<AccountLifecycleState[]>(["archived"]),
    archived: Object.freeze<AccountLifecycleState[]>([]),
  }),
  nonAuthenticatable: Object.freeze<AccountLifecycleState[]>([
    "pending",
    "suspended",
    "locked",
    "disabled",
    "deleted",
    "archived",
  ]),
  securitySensitive: Object.freeze<AccountLifecycleState[]>([
    "suspended",
    "locked",
    "disabled",
    "deleted",
    "archived",
  ]),
});

export function canTransition(
  from: AccountLifecycleState,
  to: AccountLifecycleState,
  policy: AccountLifecyclePolicy = DEFAULT_ACCOUNT_LIFECYCLE_POLICY,
): boolean {
  return (policy.transitions[from] ?? []).includes(to);
}

export function isAuthenticatable(
  state: AccountLifecycleState,
  policy: AccountLifecyclePolicy = DEFAULT_ACCOUNT_LIFECYCLE_POLICY,
): boolean {
  return !policy.nonAuthenticatable.includes(state);
}

export interface AccountTransitionResult {
  readonly record: AccountLifecycleRecord;
  readonly transition: AccountLifecycleTransition;
  readonly securitySensitive: boolean;
}

export class AccountLifecycleManager {
  constructor(
    private readonly records: CollectionStore<AccountLifecycleRecord>,
    private readonly history: CollectionStore<AccountLifecycleTransition>,
    private readonly policy: AccountLifecyclePolicy = DEFAULT_ACCOUNT_LIFECYCLE_POLICY,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async ensure(userId: string, initial: AccountLifecycleState = "pending"): Promise<AccountLifecycleRecord> {
    const existing = await this.records.first((r) => r.userId === userId);
    if (existing) return existing;
    const at = this.now();
    const record: AccountLifecycleRecord = Object.freeze({
      id: newAccountLifecycleId(),
      userId,
      state: initial,
      reason: null,
      since: at,
      createdAt: at,
      updatedAt: at,
    });
    await this.records.put(record);
    return record;
  }

  async stateOf(userId: string): Promise<AccountLifecycleState | undefined> {
    return (await this.records.first((r) => r.userId === userId))?.state;
  }

  async transition(input: {
    userId: string;
    to: AccountLifecycleState;
    reason?: string | null;
    actorId?: string | null;
  }): Promise<AccountTransitionResult> {
    const current = await this.ensure(input.userId);
    if (!canTransition(current.state, input.to, this.policy))
      throw new AccountLifecycleError(
        `illegal account transition '${current.state}' -> '${input.to}'`,
        { userId: input.userId, from: current.state, to: input.to },
      );
    const at = this.now();
    const record: AccountLifecycleRecord = Object.freeze({
      ...current,
      state: input.to,
      reason: input.reason ?? null,
      since: at,
      updatedAt: at,
    });
    const transition: AccountLifecycleTransition = Object.freeze({
      id: newAccountTransitionId(),
      userId: input.userId,
      from: current.state,
      to: input.to,
      reason: input.reason ?? null,
      actorId: input.actorId ?? null,
      at,
    });
    await this.records.put(record);
    await this.history.put(transition);
    return Object.freeze({
      record,
      transition,
      securitySensitive: this.policy.securitySensitive.includes(input.to),
    });
  }

  async assertAuthenticatable(userId: string): Promise<AccountLifecycleState> {
    const state = (await this.ensure(userId)).state;
    if (!isAuthenticatable(state, this.policy))
      throw new AccountLifecycleError(`account is ${state}`, { userId, state });
    return state;
  }

  async historyFor(userId: string): Promise<readonly AccountLifecycleTransition[]> {
    return [...(await this.history.where((h) => h.userId === userId))].sort((a, b) => a.at - b.at);
  }

  async count(): Promise<number> {
    return this.records.count();
  }
}
