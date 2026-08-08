/**
 * IAM Platform — event bus. Events are immutable, never contain secrets.
 */
import { newIamEventId } from "./ids";

export type IamEventKind =
  | "LoginSucceeded"
  | "LoginFailed"
  | "LoggedOut"
  | "Reauthenticated"
  | "GuestSessionStarted"
  | "AccountActivated"
  | "AccountSuspended"
  | "AccountDisabled"
  | "AccountDeleted"
  | "AccountArchived"
  | "AccountLifecycleChanged"
  | "EmailVerified"
  | "AccountLocked"
  | "AccountUnlocked"
  | "CredentialCreated"
  | "CredentialChanged"
  | "CredentialRevoked"
  | "PasswordChanged"
  | "PasswordResetRequested"
  | "PasswordResetCompleted"
  | "TokenIssued"
  | "TokenRotated"
  | "TokenRevoked"
  | "TokenReuseDetected"
  | "SessionStarted"
  | "SessionRefreshed"
  | "SessionRevoked"
  | "SessionExpired"
  | "DeviceRegistered"
  | "DeviceTrusted"
  | "DeviceRevoked"
  | "RoleAssigned"
  | "RoleRevoked"
  | "PermissionGranted"
  | "PermissionRevoked"
  | "PermissionDenied"
  | "ApiKeyCreated"
  | "ApiKeyRotated"
  | "ApiKeyDisabled"
  | "ServiceAccountCreated"
  | "MfaEnrolled"
  | "MfaChallenged"
  | "MfaVerified"
  | "FederatedIdentityLinked"
  | "SecurityRiskDetected"
  | "SuspiciousLoginDetected"
  | "RateLimitTriggered";

export interface IamEvent {
  readonly id: string;
  readonly kind: IamEventKind;
  readonly at: number;
  readonly actorId: string | null;
  readonly subjectId: string | null;
  readonly correlationId: string;
  readonly causationId: string | null;
  readonly version: number;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface IamEmitOptions {
  readonly at?: number;
  readonly actorId?: string | null;
  readonly correlationId?: string;
  readonly causationId?: string | null;
  readonly version?: number;
}

export type IamEventListener = (event: IamEvent) => void;

export const IAM_EVENT_VERSION = 1;

export class IamEventBus {
  private readonly listeners = new Set<IamEventListener>();
  private readonly log: IamEvent[] = [];

  on(listener: IamEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(
    kind: IamEventKind,
    subjectId: string | null,
    payload: Readonly<Record<string, unknown>> = {},
    options: IamEmitOptions = {},
  ): IamEvent {
    const id = newIamEventId();
    const event: IamEvent = Object.freeze({
      id,
      kind,
      at: options.at ?? Date.now(),
      actorId: options.actorId ?? subjectId,
      subjectId,
      correlationId: options.correlationId ?? id,
      causationId: options.causationId ?? null,
      version: options.version ?? IAM_EVENT_VERSION,
      payload: Object.freeze({ ...payload }),
    });
    this.log.push(event);
    for (const l of this.listeners) l(event);
    return event;
  }

  history(): readonly IamEvent[] {
    return Object.freeze([...this.log]);
  }

  ofKind(kind: IamEventKind): readonly IamEvent[] {
    return Object.freeze(this.log.filter((e) => e.kind === kind));
  }
}

