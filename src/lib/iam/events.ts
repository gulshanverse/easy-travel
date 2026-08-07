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
  | "EmailVerified"
  | "AccountLocked"
  | "AccountUnlocked"
  | "PasswordChanged"
  | "PasswordResetRequested"
  | "PasswordResetCompleted"
  | "TokenIssued"
  | "TokenRotated"
  | "TokenRevoked"
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
  | "SuspiciousLoginDetected"
  | "RateLimitTriggered";

export interface IamEvent {
  readonly id: string;
  readonly kind: IamEventKind;
  readonly at: number;
  readonly subjectId: string | null;
  readonly payload: Readonly<Record<string, unknown>>;
}

export type IamEventListener = (event: IamEvent) => void;

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
    at: number = Date.now(),
  ): IamEvent {
    const event: IamEvent = Object.freeze({
      id: newIamEventId(),
      kind,
      at,
      subjectId,
      payload: Object.freeze({ ...payload }),
    });
    this.log.push(event);
    for (const l of this.listeners) l(event);
    return event;
  }

  history(): readonly IamEvent[] {
    return Object.freeze([...this.log]);
  }
}
