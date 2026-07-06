/**
 * AI Core — Typed error hierarchy.
 * Internal errors are wrapped before ever crossing back to the UI.
 */

export class AIError extends Error {
  code: string;
  status: number;
  cause?: unknown;
  constructor(code: string, message: string, status = 500, cause?: unknown) {
    super(message);
    this.name = "AIError";
    this.code = code;
    this.status = status;
    this.cause = cause;
  }
}

export class AIRateLimitError extends AIError {
  constructor(message = "Rate limit exceeded") {
    super("rate_limited", message, 429);
  }
}

export class AICreditsError extends AIError {
  constructor(message = "AI credits exhausted") {
    super("credits_exhausted", message, 402);
  }
}

export class AIUnauthorizedError extends AIError {
  constructor(message = "Authentication required") {
    super("unauthorized", message, 401);
  }
}

export class AIValidationError extends AIError {
  constructor(message: string) {
    super("invalid_input", message, 400);
  }
}

export class AISafetyError extends AIError {
  constructor(message: string) {
    super("safety_blocked", message, 400);
  }
}

export class AIProviderError extends AIError {
  constructor(message: string, cause?: unknown) {
    super("provider_error", message, 502, cause);
  }
}

export class AIStructuredOutputError extends AIError {
  constructor(message: string, public rawText?: string) {
    super("structured_output_failed", message, 500);
  }
}

export function toPublicError(err: unknown): { code: string; message: string; status: number } {
  if (err instanceof AIError) return { code: err.code, message: err.message, status: err.status };
  return { code: "internal_error", message: "Something went wrong", status: 500 };
}
