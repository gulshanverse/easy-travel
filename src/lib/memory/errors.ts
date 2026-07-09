/**
 * Memory Engine — Typed error hierarchy (EDS-001 v2.0 §11.2, EBP §7).
 */

export class MemoryError extends Error {
  code: string;
  status: number;
  cause?: unknown;
  constructor(code: string, message: string, status = 500, cause?: unknown) {
    super(message);
    this.name = "MemoryError";
    this.code = code;
    this.status = status;
    this.cause = cause;
  }
}

export class MemoryValidationError extends MemoryError {
  constructor(message: string, cause?: unknown) {
    super("memory/invalid", message, 400, cause);
  }
}

export class MemoryNotFoundError extends MemoryError {
  constructor(memoryId: string) {
    super("memory/not_found", `Memory ${memoryId} not found`, 404);
  }
}

export class MemoryAccessError extends MemoryError {
  constructor(message = "Access denied") {
    super("memory/forbidden", message, 403);
  }
}

export class MemoryConflictError extends MemoryError {
  constructor(message: string) {
    super("memory/conflict", message, 409);
  }
}

export class MemoryContradictionError extends MemoryError {
  constructor(message: string) {
    super("memory/contradiction", message, 409);
  }
}

export class MemoryStorageError extends MemoryError {
  constructor(message: string, cause?: unknown) {
    super("memory/storage_error", message, 500, cause);
  }
}

export class MemoryTimeoutError extends MemoryError {
  constructor(stage: string) {
    super("memory/timeout", `Timeout at stage ${stage}`, 504);
  }
}

export class MemoryBudgetExceededError extends MemoryError {
  constructor(message: string) {
    super("memory/budget_exceeded", message, 400);
  }
}

export class MemoryPolicyError extends MemoryError {
  constructor(message: string) {
    super("memory/policy_violation", message, 403);
  }
}

export function toPublicMemoryError(err: unknown): { code: string; message: string; status: number } {
  if (err instanceof MemoryError) return { code: err.code, message: err.message, status: err.status };
  return { code: "internal_error", message: "Memory engine error", status: 500 };
}
