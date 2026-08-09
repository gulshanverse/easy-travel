/**
 * NCP — error hierarchy. Provider and persistence errors are normalised
 * into these before they escape the package.
 */

export class NotificationError extends Error {
  constructor(
    message: string,
    readonly details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotificationConfigError extends NotificationError {}
export class NotificationValidationError extends NotificationError {}

export class UnknownTemplateError extends NotificationError {
  constructor(templateId: string, locale?: string) {
    super(`unknown template: ${templateId}${locale ? ` (${locale})` : ""}`, { templateId, locale });
  }
}

export class TemplateRenderError extends NotificationError {}
export class MissingVariableError extends TemplateRenderError {
  constructor(templateId: string, variable: string) {
    super(`template ${templateId} requires variable "${variable}"`, { templateId, variable });
  }
}

export class UnknownNotificationError extends NotificationError {
  constructor(id: string) {
    super(`unknown notification: ${id}`, { id });
  }
}

export class UnknownDeliveryError extends NotificationError {
  constructor(id: string) {
    super(`unknown delivery: ${id}`, { id });
  }
}

export class UnknownRecipientError extends NotificationError {
  constructor(userId: string) {
    super(`unknown recipient: ${userId}`, { userId });
  }
}

export class ChannelUnavailableError extends NotificationError {}
export class RateLimitExceededError extends NotificationError {}
export class DeliveryFailedError extends NotificationError {}
export class TransientDeliveryError extends DeliveryFailedError {}
export class PermanentDeliveryError extends DeliveryFailedError {}
export class NotificationAccessDeniedError extends NotificationError {
  constructor(userId: string, notificationId: string) {
    super("notification access denied", { userId, notificationId });
  }
}
export class InvalidLifecycleTransitionError extends NotificationError {
  constructor(from: string, to: string) {
    super(`invalid notification transition ${from} -> ${to}`, { from, to });
  }
}
