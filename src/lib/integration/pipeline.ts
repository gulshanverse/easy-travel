/** IPCF — deterministic request pipeline.
 *
 * Request
 *   → Validation
 *   → Authentication Hook
 *   → Transformation (request)
 *   → Policy Evaluation
 *   → Execution Hook (stub / injected adapter)
 *   → Transformation (response)
 *   → Normalization
 *   → Response
 *
 * The execution hook is the ONLY external seam. IPCF ships a deterministic
 * stub executor. Real network transport is registered separately.
 */
import { AuthenticationRegistry, anonymousDescriptor } from "./auth";
import {
  IntegrationExecutionError, IntegrationTimeoutError, IntegrationValidationError,
} from "./errors";
import {
  assertBudget, CircuitBreaker, ConcurrencyLimiter, RateLimiter,
  requireCapability, requireVersionCompatible,
} from "./governance";
import { normalizeResponse } from "./normalization";
import type {
  Connector, ConnectorExecutor, ConnectorExecutorContext, ConnectorRawResult,
  ConnectorRequest, ConnectorResponse,
} from "./types";
import type { IntegrationPolicies } from "./policies";
import type { IntegrationTelemetrySink } from "./telemetry";
import { validateRequest } from "./validation";

export type RequestTransformer = (req: ConnectorRequest, c: Connector) => ConnectorRequest;
export type ResponseTransformer = <T = unknown>(raw: ConnectorRawResult<T>, req: ConnectorRequest, c: Connector) => ConnectorRawResult<T>;

export interface PipelineHooks {
  readonly requestTransformers: Map<string, RequestTransformer>;
  readonly responseTransformers: Map<string, ResponseTransformer>;
  readonly executors: Map<string, ConnectorExecutor>;
  readonly defaultExecutor: ConnectorExecutor;
}

export function createPipelineHooks(defaultExecutor?: ConnectorExecutor): PipelineHooks {
  const stub: ConnectorExecutor = async (ctx: ConnectorExecutorContext) => {
    // Deterministic no-op success — never touches the network.
    return {
      ok: true,
      data: {
        stub: true,
        connectorId: ctx.connector.id,
        capabilityId: ctx.request.capabilityId,
        correlationId: ctx.request.correlationId,
        attempt: ctx.attempt,
      },
    } satisfies ConnectorRawResult;
  };
  return {
    requestTransformers: new Map(),
    responseTransformers: new Map(),
    executors: new Map(),
    defaultExecutor: defaultExecutor ?? stub,
  };
}

export interface PipelineDeps {
  readonly hooks: PipelineHooks;
  readonly auth: AuthenticationRegistry;
  readonly rateLimiter: RateLimiter;
  readonly concurrency: ConcurrencyLimiter;
  readonly circuit: CircuitBreaker;
  readonly policies: IntegrationPolicies;
  readonly telemetry: IntegrationTelemetrySink;
  readonly defaultTimeoutMs: number;
}

export interface PipelineOutcome<T = unknown> {
  readonly response: ConnectorResponse<T>;
  readonly attempts: number;
  readonly latencyMs: number;
  readonly transformationApplied: boolean;
  readonly circuitState: "closed" | "open" | "half-open";
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  if (ms <= 0) return p;
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new IntegrationTimeoutError(`${label} timed out after ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

export async function runPipeline<T = unknown>(
  connector: Connector,
  request: ConnectorRequest,
  deps: PipelineDeps,
  signal?: AbortSignal,
): Promise<PipelineOutcome<T>> {
  const started = Date.now();
  const span = deps.telemetry.startSpan("integration.pipeline", {
    connectorId: connector.id,
    capabilityId: request.capabilityId,
    correlationId: request.correlationId,
  });

  try {
    // Validation
    validateRequest(request);
    if (request.connectorId !== connector.id) {
      throw new IntegrationValidationError(`request.connectorId ${request.connectorId} does not match connector ${connector.id}`);
    }
    const capability = requireCapability(connector, request.capabilityId);
    if (deps.policies.enforceVersionCompatibility) {
      requireVersionCompatible(capability.version);
    }

    // Authentication
    let authApplied = false;
    if (deps.policies.requireAuthentication) {
      const auth = connector.definition.manifest.authentication;
      if (auth.kind === "anonymous" && !deps.policies.allowAnonymousConnectors) {
        throw new IntegrationValidationError(`anonymous auth denied by policy for ${connector.id}`);
      }
      await deps.auth.apply(auth, { connectorId: connector.id, at: Date.now() });
      authApplied = true;
    } else {
      anonymousDescriptor();
    }

    // Transformation (request)
    let workingRequest = request;
    let transformationApplied = false;
    const reqName = connector.definition.transformation?.requestName;
    if (reqName) {
      const t = deps.hooks.requestTransformers.get(reqName);
      if (t) {
        workingRequest = t(workingRequest, connector);
        transformationApplied = true;
      }
    }

    // Policy evaluation
    if (deps.policies.enforceRateLimits) deps.rateLimiter.check(connector.id, connector.definition.policy);
    deps.concurrency.acquire(connector.id, connector.definition.policy);
    let attempts = 0;
    let circuitStateAtExecution: "closed" | "open" | "half-open" = "closed";
    try {
      if (deps.policies.enforceCircuitBreaker) {
        const snap = deps.circuit.ensureClosed(connector.id, connector.definition.policy);
        circuitStateAtExecution = snap.state;
      }

      // Execution
      const executor = deps.hooks.executors.get(connector.id) ?? deps.hooks.defaultExecutor;
      const timeoutMs = workingRequest.timeoutMs ?? deps.defaultTimeoutMs;
      attempts = 1;
      const ctx: ConnectorExecutorContext = { connector, request: workingRequest, signal, attempt: attempts };
      let raw: ConnectorRawResult<T>;
      try {
        raw = (await withTimeout(executor(ctx) as Promise<ConnectorRawResult<T>>, timeoutMs, "executor")) as ConnectorRawResult<T>;
      } catch (e) {
        if (e instanceof IntegrationTimeoutError) throw e;
        throw new IntegrationExecutionError((e as Error).message);
      }

      // Transformation (response)
      const resName = connector.definition.transformation?.responseName;
      if (resName) {
        const t = deps.hooks.responseTransformers.get(resName);
        if (t) {
          raw = t<T>(raw, workingRequest, connector);
          transformationApplied = true;
        }
      }

      // Budget guard
      assertBudget(connector.definition.policy, Date.now() - started);

      // Circuit accounting
      if (deps.policies.enforceCircuitBreaker) {
        if (raw.ok) deps.circuit.recordSuccess(connector.id);
        else deps.circuit.recordFailure(connector.id, connector.definition.policy);
      }

      // Normalization
      const response = normalizeResponse<T>(raw, {
        request: workingRequest,
        connectorVersion: connector.version.version,
        latencyMs: Date.now() - started,
        attempts,
        circuitState: circuitStateAtExecution,
        transformationApplied,
      });

      span.end("ok");
      void authApplied;
      return {
        response, attempts,
        latencyMs: response.diagnostics.latencyMs,
        transformationApplied,
        circuitState: circuitStateAtExecution,
      };
    } finally {
      deps.concurrency.release(connector.id);
    }
  } catch (e) {
    if (deps.policies.enforceCircuitBreaker) {
      try { deps.circuit.recordFailure(connector.id, connector.definition.policy); } catch { /* ignore */ }
    }
    span.end("error", e as Error);
    throw e;
  }
}
