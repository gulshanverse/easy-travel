/**
 * Identity Platform — error hierarchy.
 */
export class IdentityError extends Error {
  readonly code: string;
  readonly meta: Readonly<Record<string, unknown>>;
  constructor(code: string, message: string, meta: Record<string, unknown> = {}) {
    super(message);
    this.name = "IdentityError";
    this.code = code;
    this.meta = Object.freeze({ ...meta });
  }
}

export class IdentityValidationError extends IdentityError {
  constructor(m: string, meta: Record<string, unknown> = {}) {
    super("IDENTITY_INVALID", m, meta);
    this.name = "IdentityValidationError";
  }
}
export class UnknownUserError extends IdentityError {
  constructor(id: string) {
    super("USER_UNKNOWN", `Unknown user: ${id}`, { id });
    this.name = "UnknownUserError";
  }
}
export class UnknownSavedJourneyError extends IdentityError {
  constructor(id: string) {
    super("SAVED_JOURNEY_UNKNOWN", `Unknown saved journey: ${id}`, { id });
    this.name = "UnknownSavedJourneyError";
  }
}
export class UnknownFavoriteError extends IdentityError {
  constructor(id: string) {
    super("FAVORITE_UNKNOWN", `Unknown favorite: ${id}`, { id });
    this.name = "UnknownFavoriteError";
  }
}
export class UnknownDeviceSessionError extends IdentityError {
  constructor(id: string) {
    super("DEVICE_SESSION_UNKNOWN", `Unknown device session: ${id}`, { id });
    this.name = "UnknownDeviceSessionError";
  }
}
export class IdentityConflictError extends IdentityError {
  constructor(m: string, meta: Record<string, unknown> = {}) {
    super("IDENTITY_CONFLICT", m, meta);
    this.name = "IdentityConflictError";
  }
}
export class IdentityLimitError extends IdentityError {
  constructor(m: string, meta: Record<string, unknown> = {}) {
    super("IDENTITY_LIMIT", m, meta);
    this.name = "IdentityLimitError";
  }
}
export class IdentityPrivacyError extends IdentityError {
  constructor(m: string, meta: Record<string, unknown> = {}) {
    super("IDENTITY_PRIVACY", m, meta);
    this.name = "IdentityPrivacyError";
  }
}
export class IdentityTransitionError extends IdentityError {
  constructor(m: string, meta: Record<string, unknown> = {}) {
    super("IDENTITY_TRANSITION", m, meta);
    this.name = "IdentityTransitionError";
  }
}
