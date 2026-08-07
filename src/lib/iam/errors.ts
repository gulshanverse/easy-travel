/**
 * IAM Platform — error hierarchy.
 * Every failure surfaced to callers is one of these; driver, crypto and
 * persistence errors are normalised before they escape the package.
 */

export class IamError extends Error {
  constructor(
    message: string,
    readonly details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class IamConfigError extends IamError {}
export class AuthenticationError extends IamError {}
export class InvalidCredentialsError extends AuthenticationError {
  constructor(details?: Readonly<Record<string, unknown>>) {
    super("invalid credentials", details);
  }
}
export class AccountLockedError extends AuthenticationError {}
export class AccountInactiveError extends AuthenticationError {}
export class ReauthenticationRequiredError extends AuthenticationError {}
export class MfaRequiredError extends AuthenticationError {}

export class PasswordPolicyError extends IamError {}
export class PasswordReuseError extends PasswordPolicyError {
  constructor(window: number) {
    super(`password was used within the last ${window} changes`, { window });
  }
}
export class PasswordExpiredError extends PasswordPolicyError {}

export class TokenError extends IamError {}
export class TokenExpiredError extends TokenError {}
export class TokenRevokedError extends TokenError {}
export class TokenSignatureError extends TokenError {}

export class SessionError extends IamError {}
export class SessionExpiredError extends SessionError {}
export class SessionRevokedError extends SessionError {}
export class ConcurrentSessionLimitError extends SessionError {}

export class DeviceError extends IamError {}
export class AuthorizationError extends IamError {}
export class PermissionDeniedError extends AuthorizationError {
  constructor(permission: string, subject: string) {
    super(`permission '${permission}' denied for '${subject}'`, { permission, subject });
  }
}
export class RoleCycleError extends AuthorizationError {}

export class ApiKeyError extends IamError {}
export class ApiKeyExpiredError extends ApiKeyError {}
export class ApiKeyDisabledError extends ApiKeyError {}
export class ServiceAccountError extends IamError {}
export class MfaError extends IamError {}
export class FederationError extends IamError {}
export class RateLimitError extends IamError {}
