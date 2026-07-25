/** IPCF — deterministic response normalization. */
import { newResponseId } from "./ids";
import type {
  ConnectorRawResult, ConnectorRequest, NormalizedDiagnostics, NormalizedError,
  NormalizedMetadata, NormalizedResponse,
} from "./types";

export interface NormalizationContext {
  readonly request: ConnectorRequest;
  readonly connectorVersion: string;
  readonly latencyMs: number;
  readonly attempts: number;
  readonly circuitState: "closed" | "open" | "half-open";
  readonly transformationApplied: boolean;
}

const freeze = <T>(v: T): T => Object.freeze(v) as T;

export function normalizeError(err: unknown): NormalizedError {
  if (err && typeof err === "object") {
    const e = err as { code?: string; message?: string; retryable?: boolean; cause?: Record<string, unknown> };
    return freeze({
      code: e.code ?? "unknown_error",
      message: e.message ?? String(err),
      retryable: e.retryable ?? false,
      cause: e.cause ? freeze({ ...e.cause }) : undefined,
    });
  }
  return freeze({ code: "unknown_error", message: String(err), retryable: false });
}

export function normalizeResponse<T>(raw: ConnectorRawResult<T>, ctx: NormalizationContext): NormalizedResponse<T> {
  const metadata: NormalizedMetadata = freeze({
    connectorId: ctx.request.connectorId,
    capabilityId: ctx.request.capabilityId,
    correlationId: ctx.request.correlationId,
    causationId: ctx.request.causationId,
    version: ctx.connectorVersion,
    at: Date.now(),
  });
  const diagnostics: NormalizedDiagnostics = freeze({
    latencyMs: ctx.latencyMs,
    attempts: ctx.attempts,
    retried: ctx.attempts > 1,
    circuitState: ctx.circuitState,
    transformationApplied: ctx.transformationApplied,
  });
  const base = {
    id: newResponseId(),
    ok: raw.ok,
    metadata, diagnostics,
    pagination: raw.pagination ? freeze({ ...raw.pagination }) : undefined,
    rateLimit: raw.rateLimit ? freeze({ ...raw.rateLimit }) : undefined,
  } as const;
  if (raw.ok) {
    return freeze({ ...base, data: raw.data });
  }
  return freeze({ ...base, error: raw.error ? normalizeError(raw.error) : normalizeError("unknown") });
}
