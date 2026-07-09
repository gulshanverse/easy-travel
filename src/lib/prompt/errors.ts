/**
 * Prompt Orchestration Runtime — Error hierarchy.
 * Every error carries a stable `code` for observability and a `stage`
 * pointing at the lifecycle step that produced it.
 */
import type { PromptStage } from "./types";

export class PromptError extends Error {
  readonly code: string;
  readonly stage?: PromptStage;
  readonly details?: Record<string, unknown>;
  readonly recoverable: boolean;

  constructor(
    message: string,
    opts: {
      code: string;
      stage?: PromptStage;
      details?: Record<string, unknown>;
      recoverable?: boolean;
      cause?: unknown;
    },
  ) {
    super(message, opts.cause ? { cause: opts.cause } : undefined);
    this.name = new.target.name;
    this.code = opts.code;
    this.stage = opts.stage;
    this.details = opts.details;
    this.recoverable = opts.recoverable ?? false;
  }
}

export class CompilationError extends PromptError {
  constructor(message: string, details?: Record<string, unknown>, cause?: unknown) {
    super(message, { code: "PROMPT_COMPILATION_ERROR", stage: "compilation", details, cause });
  }
}

export class ValidationError extends PromptError {
  readonly issues: string[];
  constructor(issues: string[], stage: PromptStage = "validation", details?: Record<string, unknown>) {
    super(`Prompt validation failed: ${issues.join("; ")}`, {
      code: "PROMPT_VALIDATION_ERROR",
      stage,
      details: { ...details, issues },
      recoverable: true,
    });
    this.issues = issues;
  }
}

export class StreamingError extends PromptError {
  constructor(message: string, details?: Record<string, unknown>, cause?: unknown) {
    super(message, { code: "PROMPT_STREAMING_ERROR", stage: "streaming", details, cause, recoverable: true });
  }
}

export class BudgetExceededError extends PromptError {
  constructor(usedTokens: number, hard: number) {
    super(`Prompt exceeded hard budget: ${usedTokens} > ${hard}`, {
      code: "PROMPT_BUDGET_EXCEEDED",
      stage: "budget_enforcement",
      details: { usedTokens, hard },
    });
  }
}

export class ContextOverflowError extends PromptError {
  constructor(details: Record<string, unknown>) {
    super("Context overflow after trimming and compression", {
      code: "PROMPT_CONTEXT_OVERFLOW",
      stage: "context_assembly",
      details,
    });
  }
}

export class TemplateError extends PromptError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, { code: "PROMPT_TEMPLATE_ERROR", details });
  }
}

export class VersionConflictError extends PromptError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, { code: "PROMPT_VERSION_CONFLICT", details });
  }
}

export class RetryExceededError extends PromptError {
  constructor(attempts: number, lastError: unknown) {
    super(`Retries exhausted after ${attempts} attempts`, {
      code: "PROMPT_RETRY_EXCEEDED",
      stage: "execution",
      details: { attempts },
      cause: lastError,
    });
  }
}

export class CancellationError extends PromptError {
  constructor(stage?: PromptStage) {
    super("Prompt run cancelled", { code: "PROMPT_CANCELLED", stage, recoverable: false });
  }
}

export class RegistryError extends PromptError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, { code: "PROMPT_REGISTRY_ERROR", details });
  }
}
