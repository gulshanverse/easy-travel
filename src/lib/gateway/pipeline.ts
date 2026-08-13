/** Provider Gateway (P-1.4) — the single request execution pipeline.
 *
 *  EVERY provider request passes through these stages, in this order:
 *   validation → capability validation → authorization → credential resolution
 *   → budget → rate limit → concurrency → cache lookup → idempotency
 *   → provider resolution (done by the manager) → timeout → execution
 *   → normalization → metrics → events → audit → cache write
 *
 *  No provider may bypass the pipeline: adapters are reachable only from here.
 */
import { applyAuthentication, CredentialResolver } from "./credentials";
import { GatewayCache, IdempotencyManager, type IdempotencyRecord } from "./caching";
import { negotiate, validateInput, validateOutput } from "./capabilities";
import {
  ProviderGatewayError,
  ProviderInvalidRequestError,
  ProviderSecurityViolationError,
  normalizeProviderFailure,
} from "./errors";
import { cacheKeyFor, requestFingerprint } from "./ids";
import { NormalizationRegistry, type NormalizedEnvelope } from "./normalization";
import {
  createGatewayEvent,
  GatewayEventBus,
  ProviderMetrics,
  noopGatewayTelemetry,
  type GatewayTelemetrySink,
} from "./observability";
import type { GatewayConfiguration } from "./policies";
import type { GatewayPorts } from "./ports";
import type { ProviderEntry } from "./registry";
import {
  BudgetController,
  budgetScope,
  CircuitBreaker,
  ConcurrencyLimiter,
  RateLimiter,
  RetryBudget,
  createTimeoutBudget,
  decideRetry,
  remainingMs,
  withTimeout,
  type RateLimitCheck,
} from "./resilience";
import { byteSize, minimize } from "./security";
import type { ProviderRequest, ProviderResponse } from "./types";

export interface AuthorizationPort {
  /** Deny-by-default hook for caller authorization (IAM / IPCF governance). */
  authorize(input: {
    capability: string;
    operation: string;
    userId?: string;
    tenantId?: string;
    correlationId: string;
  }): Promise<boolean> | boolean;
}

export interface PipelineDeps {
  readonly config: GatewayConfiguration;
  readonly cache: GatewayCache;
  readonly idempotency: IdempotencyManager;
  readonly credentials: CredentialResolver;
  readonly rateLimiter: RateLimiter;
  readonly concurrency: ConcurrencyLimiter;
  readonly budget: BudgetController;
  readonly metrics: ProviderMetrics;
  readonly events: GatewayEventBus;
  readonly normalization: NormalizationRegistry;
  readonly telemetry?: GatewayTelemetrySink;
  readonly authorization?: AuthorizationPort;
  readonly ports?: GatewayPorts;
}

export interface PipelineOutcome {
  readonly response: ProviderResponse<NormalizedEnvelope>;
  readonly attempts: number;
}

/** Executes one provider attempt end-to-end (retries included). */
export class GatewayPipeline {
  private readonly circuits = new Map<string, CircuitBreaker>();

  constructor(private readonly deps: PipelineDeps) {}

  circuit(entry: ProviderEntry): CircuitBreaker {
    let cb = this.circuits.get(entry.provider.id);
    if (!cb) {
      cb = new CircuitBreaker(entry.provider.policy.circuit);
      this.circuits.set(entry.provider.id, cb);
    }
    return cb;
  }

  circuitSnapshot(providerId: string) {
    return this.circuits.get(providerId)?.snapshot();
  }

  resetCircuits(): void {
    this.circuits.clear();
  }

  async run(
    entry: ProviderEntry,
    request: ProviderRequest,
    ctx: { fallbackUsed: boolean },
  ): Promise<PipelineOutcome> {
    const d = this.deps;
    const provider = entry.provider;
    const telemetry = d.telemetry ?? noopGatewayTelemetry;
    const startedAt = Date.now();
    const span = telemetry.span({
      name: "gateway.request",
      providerId: provider.id,
      capability: request.capability,
      correlationId: request.correlationId,
      attributes: { operation: request.operation, fallback: ctx.fallbackUsed },
    });
    d.metrics.record(provider.id, "requests");
    d.events.publish(
      createGatewayEvent({
        name: "ProviderRequestStarted",
        correlationId: request.correlationId,
        ...(request.causationId ? { causationId: request.causationId } : {}),
        providerId: provider.id,
        capabilityId: request.capability,
        metadata: { operation: request.operation, fallback: ctx.fallbackUsed },
      }),
    );

    try {
      /* 1. Request validation ------------------------------------- */
      if (!request.capability || !request.operation)
        throw new ProviderInvalidRequestError("capability and operation are required");
      const environment = request.environment ?? provider.environment;
      const requestBytes = byteSize(request.payload);
      const maxReq = Math.min(d.config.maxRequestBytes, provider.limits.maxRequestBytes);
      if (requestBytes > maxReq)
        throw new ProviderSecurityViolationError(
          `request payload ${requestBytes}B exceeds limit ${maxReq}B`,
          { providerId: provider.id, capability: request.capability },
        );
      if (d.config.sandboxOnly && provider.type === "live")
        throw new ProviderSecurityViolationError(
          `live providers are disabled in ${d.config.environment}`,
          { providerId: provider.id },
        );

      /* 2. Capability validation ---------------------------------- */
      const cap = negotiate(provider, request.capability, request.operation, environment);
      validateInput(cap, request.payload);

      /* 3. Authorization ------------------------------------------ */
      if (d.authorization) {
        const allowed = await d.authorization.authorize({
          capability: request.capability,
          operation: request.operation,
          ...(request.userId ? { userId: request.userId } : {}),
          ...(request.tenantId ? { tenantId: request.tenantId } : {}),
          correlationId: request.correlationId,
        });
        if (!allowed)
          throw new ProviderSecurityViolationError("caller is not authorized for this capability", {
            providerId: provider.id,
            capability: request.capability,
          });
      }
      if (d.ports?.integration) {
        const viaIpcf = await d.ports.integration.authorize(
          request.capability,
          request.correlationId,
        );
        if (!viaIpcf)
          throw new ProviderSecurityViolationError(
            "provider gateway must be invoked through IPCF governance",
            { providerId: provider.id, capability: request.capability },
          );
      }

      /* 4. Data minimization -------------------------------------- */
      const payload = d.config.enforceDataMinimization
        ? minimize(
            request.payload,
            cap.inputFields.map((f) => (f.endsWith("?") ? f.slice(0, -1) : f)),
          )
        : request.payload;

      /* 5. Credential resolution ---------------------------------- */
      let auth = applyAuthentication(provider.auth, null);
      if (cap.requiresAuth || provider.auth !== "none") {
        if (!provider.credentialRef) {
          if (cap.requiresAuth) {
            d.metrics.record(provider.id, "credentialFailures");
            throw normalizeProviderFailure(
              { code: "credential", message: `no credential reference for ${provider.id}` },
              { providerId: provider.id, capability: cap.id },
            );
          }
        } else {
          try {
            const cred = await d.credentials.resolve(provider.credentialRef);
            auth = applyAuthentication(provider.auth, cred);
          } catch (e) {
            d.metrics.record(provider.id, "credentialFailures");
            throw e;
          }
        }
      }

      /* 6. Budget -------------------------------------------------- */
      const scope = budgetScope({
        providerId: provider.id,
        capability: cap.id,
        ...(request.userId ? { userId: request.userId } : {}),
      });
      const estimatedCost = provider.pricing.costPerRequest;
      if (d.config.enforceBudget) {
        try {
          d.budget.authorize(scope, provider.policy.budget, estimatedCost);
        } catch (e) {
          d.metrics.record(provider.id, "budgetRejections");
          throw e;
        }
      }

      /* 7. Rate limits (provider / capability / credential / user / tenant) */
      if (d.config.enforceRateLimits) {
        const checks: RateLimitCheck[] = [
          {
            dimension: "provider",
            key: provider.id,
            limit: provider.limits.requestsPerMinute,
            windowMs: 60_000,
          },
          {
            dimension: "capability",
            key: `${provider.id}:${cap.id}`,
            limit: cap.limits.requestsPerMinute ?? 0,
            windowMs: 60_000,
          },
          {
            dimension: "credential",
            key: provider.credentialRef?.ref ?? "-",
            limit: provider.credentialRef ? provider.limits.requestsPerMinute : 0,
            windowMs: 60_000,
          },
          {
            dimension: "user",
            key: request.userId ?? "-",
            limit: request.userId ? provider.limits.requestsPerMinute : 0,
            windowMs: 60_000,
          },
          {
            dimension: "tenant",
            key: request.tenantId ?? "-",
            limit: request.tenantId ? provider.limits.requestsPerMinute : 0,
            windowMs: 60_000,
          },
        ];
        try {
          await d.rateLimiter.check(checks, { providerId: provider.id });
        } catch (e) {
          d.metrics.record(provider.id, "rateLimited");
          d.events.publish(
            createGatewayEvent({
              name: "ProviderRateLimited",
              correlationId: request.correlationId,
              providerId: provider.id,
              capabilityId: cap.id,
            }),
          );
          throw e;
        }
      }

      /* 8. Cache lookup -------------------------------------------- */
      const cacheKey = cacheKeyFor({
        providerId: provider.id,
        capability: cap.id,
        operation: request.operation,
        payload,
      });
      const cacheable = cap.cacheable && cap.idempotent && d.config.enforceCaching;
      const cached = await d.cache.lookup<NormalizedEnvelope>(
        cacheKey,
        provider.policy.cache,
        cacheable,
      );
      d.metrics.record(provider.id, cached.hit ? "cacheHits" : "cacheMisses");
      if (cached.hit && !cached.stale && cached.value) {
        span.end("ok", { cached: true });
        const response = this.respond(provider.id, cap.id, cached.value, {
          attempts: 0,
          latencyMs: Date.now() - startedAt,
          cached: true,
          replayed: false,
          fallbackUsed: ctx.fallbackUsed,
          cost: 0,
          correlationId: request.correlationId,
          fingerprint: requestFingerprint({
            capability: cap.id,
            operation: request.operation,
            payload,
          }),
        });
        d.metrics.record(provider.id, "successes");
        return { response, attempts: 0 };
      }

      /* 9. Idempotency --------------------------------------------- */
      let idemRecord: IdempotencyRecord | undefined;
      if (request.idempotencyKey && d.config.enforceIdempotency) {
        const key = d.idempotency.scopedKey({
          idempotencyKey: request.idempotencyKey,
          capability: cap.id,
          operation: request.operation,
          ...(request.userId ? { userId: request.userId } : {}),
          ...(request.tenantId ? { tenantId: request.tenantId } : {}),
        });
        const begun = await d.idempotency.begin({
          key,
          fingerprint: requestFingerprint({
            capability: cap.id,
            operation: request.operation,
            payload,
          }),
          operation: request.operation,
        });
        idemRecord = begun.record;
        if (begun.replay) {
          const replayValue =
            (begun.record.result as NormalizedEnvelope | undefined) ??
            d.normalization.normalize(provider.category, cap.id, { results: [] });
          span.end("ok", { replayed: true });
          d.metrics.record(provider.id, "successes");
          return {
            attempts: 0,
            response: this.respond(provider.id, cap.id, replayValue, {
              attempts: 0,
              latencyMs: Date.now() - startedAt,
              cached: false,
              replayed: true,
              fallbackUsed: ctx.fallbackUsed,
              cost: 0,
              correlationId: request.correlationId,
              fingerprint: begun.record.fingerprint,
            }),
          };
        }
      }

      /* 10. Concurrency -------------------------------------------- */
      const release = d.config.enforceConcurrency
        ? await d.concurrency.acquire(provider.id, provider.limits.concurrency)
        : () => undefined;

      /* 11. Timeout + execution + retry ----------------------------- */
      const budgetWindow = createTimeoutBudget({
        connectionTimeoutMs: provider.limits.connectionTimeoutMs,
        requestTimeoutMs: provider.limits.requestTimeoutMs,
        totalDeadlineMs: request.deadlineMs ?? provider.limits.totalDeadlineMs,
      });
      const retryBudget = new RetryBudget(provider.policy.retry.retryBudget);
      const circuit = this.circuit(entry);
      let attempts = 0;
      let raw: unknown;

      try {
        for (;;) {
          attempts++;
          if (d.config.enforceCircuitBreaker) {
            const before = circuit.snapshot().state;
            try {
              circuit.assert(provider.id);
            } catch (e) {
              if (before !== "open") d.metrics.record(provider.id, "circuitOpens");
              throw e;
            }
          }
          try {
            const perAttempt = Math.max(
              1,
              Math.min(budgetWindow.providerTimeoutMs, remainingMs(budgetWindow)),
            );
            raw = await withTimeout(
              (signal) =>
                entry.adapter.execute({
                  capability: cap.id,
                  operation: request.operation,
                  payload,
                  correlationId: request.correlationId,
                  auth,
                  signal,
                  timeoutMs: perAttempt,
                }),
              perAttempt,
              { providerId: provider.id, capability: cap.id },
            );
            if (d.config.enforceCircuitBreaker) circuit.onSuccess();
            break;
          } catch (rawError) {
            const err =
              rawError instanceof ProviderGatewayError
                ? rawError
                : normalizeProviderFailure(
                    { message: (rawError as Error)?.message ?? "provider failure" },
                    { providerId: provider.id, capability: cap.id },
                  );
            if (err.code === "provider_timeout") d.metrics.record(provider.id, "timeouts");
            if (err.code === "provider_rate_limited") d.metrics.record(provider.id, "rateLimited");
            if (d.config.enforceCircuitBreaker) {
              const state = circuit.onFailure();
              if (state === "open" && circuit.snapshot().failures >= provider.policy.circuit.failureThreshold) {
                d.metrics.record(provider.id, "circuitOpens");
                d.events.publish(
                  createGatewayEvent({
                    name: "ProviderCircuitOpened",
                    correlationId: request.correlationId,
                    providerId: provider.id,
                    capabilityId: cap.id,
                  }),
                );
              }
            }
            const decision = decideRetry({
              error: err,
              attempt: attempts,
              policy: provider.policy.retry,
              idempotent: cap.idempotent,
              hasIdempotencyKey: Boolean(request.idempotencyKey),
              budget: retryBudget,
            });
            if (!decision.retry || remainingMs(budgetWindow) <= 0) throw err;
            d.metrics.record(provider.id, "retries");
            d.events.publish(
              createGatewayEvent({
                name: "ProviderRetryStarted",
                correlationId: request.correlationId,
                providerId: provider.id,
                capabilityId: cap.id,
                metadata: { attempt: attempts, delayMs: decision.delayMs, reason: decision.reason },
              }),
            );
            if (decision.delayMs > 0)
              await new Promise((r) => setTimeout(r, Math.min(decision.delayMs, 25)));
          }
        }
      } catch (e) {
        release();
        if (idemRecord) await d.idempotency.fail(idemRecord);
        throw e;
      }
      release();

      /* 12. Response size guard + normalization --------------------- */
      const responseBytes = byteSize(raw);
      const maxRes = Math.min(d.config.maxResponseBytes, provider.limits.maxResponseBytes);
      if (responseBytes > maxRes)
        throw new ProviderSecurityViolationError(
          `provider response ${responseBytes}B exceeds limit ${maxRes}B`,
          { providerId: provider.id, capability: cap.id },
        );
      const normalized = d.normalization.normalize(provider.category, cap.id, raw);
      validateOutput(cap, { results: normalized.items });

      /* 13. Cost settlement ----------------------------------------- */
      const actualCost = entry.adapter.actualCost?.(raw) ?? estimatedCost;
      if (d.config.enforceBudget) d.budget.settle(scope, estimatedCost, actualCost);

      /* 14. Metrics + events ---------------------------------------- */
      const latencyMs = Date.now() - startedAt;
      d.metrics.observeLatency(provider.id, latencyMs);
      d.metrics.record(provider.id, "successes");
      if (ctx.fallbackUsed) d.metrics.record(provider.id, "fallbacks");
      const event = createGatewayEvent({
        name: "ProviderRequestCompleted",
        correlationId: request.correlationId,
        providerId: provider.id,
        capabilityId: cap.id,
        metadata: {
          attempts,
          latencyMs,
          items: normalized.items.length,
          cost: actualCost,
          fallback: ctx.fallbackUsed,
        },
      });
      d.events.publish(event);
      await d.ports?.eventStore?.append({
        stream: `provider:${provider.id}`,
        eventType: event.name,
        payload: event.metadata,
      });

      /* 15. Idempotency completion + cache write -------------------- */
      if (idemRecord) await d.idempotency.complete(idemRecord, normalized);
      await d.cache.store(cacheKey, normalized, provider.policy.cache, cacheable);

      span.end("ok", { attempts, latencyMs });
      return {
        attempts,
        response: this.respond(provider.id, cap.id, normalized, {
          attempts,
          latencyMs,
          cached: false,
          replayed: false,
          fallbackUsed: ctx.fallbackUsed,
          cost: actualCost,
          correlationId: request.correlationId,
          fingerprint: requestFingerprint({
            capability: cap.id,
            operation: request.operation,
            payload,
          }),
        }),
      };
    } catch (error) {
      const err =
        error instanceof ProviderGatewayError
          ? error
          : normalizeProviderFailure(
              { message: (error as Error)?.message ?? "gateway failure" },
              { providerId: provider.id, capability: request.capability },
            );
      d.metrics.record(provider.id, "failures");
      const event = createGatewayEvent({
        name: "ProviderRequestFailed",
        correlationId: request.correlationId,
        providerId: provider.id,
        capabilityId: request.capability,
        metadata: { code: err.code, retryable: err.retryable, message: err.message },
      });
      d.events.publish(event);
      await d.ports?.eventStore?.append({
        stream: `provider:${provider.id}`,
        eventType: event.name,
        payload: event.metadata,
      });
      span.end("error", { code: err.code });
      throw err;
    }
  }

  private respond(
    providerId: string,
    capability: string,
    data: NormalizedEnvelope,
    meta: Omit<ProviderResponse["meta"], "providerId" | "capability">,
  ): ProviderResponse<NormalizedEnvelope> {
    return Object.freeze({
      ok: true,
      data,
      meta: Object.freeze({ providerId, capability, ...meta }),
    });
  }
}
