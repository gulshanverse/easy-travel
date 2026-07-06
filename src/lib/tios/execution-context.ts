/**
 * TIOS Execution Context (Milestone 5.3).
 * Universal request object passed to every capability, workflow, tool, and
 * AI call. Extends the existing DecisionContext so all downstream layers
 * remain source-compatible.
 */
import type { ContextGraphSnapshot, DecisionContext } from "./types";

export interface TracingMetadata {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  baggage?: Record<string, string>;
}

export interface SecurityContext {
  authenticated: boolean;
  roles: string[];
  scopes: string[];
  classification: "public" | "internal" | "confidential" | "restricted";
  ipHash?: string;
}

export type Environment = "development" | "preview" | "production" | "test";

export interface ExecutionContext extends DecisionContext {
  correlationId: string;
  journeyId?: string;
  workflowId?: string;
  capabilityId?: string;
  sessionId?: string;
  timezone?: string;
  region?: string;
  language?: string;
  priority: "low" | "normal" | "high" | "critical";
  deadline?: number;                    // epoch ms
  signal: AbortSignal;
  environment: Environment;
  tracing: TracingMetadata;
  security: SecurityContext;
}

export interface ExecutionContextInit {
  requestId?: string;
  correlationId?: string;
  journeyId?: string;
  workflowId?: string;
  capabilityId?: string;
  userId?: string | null;
  sessionId?: string;
  locale?: string;
  timezone?: string;
  currency?: string;
  region?: string;
  language?: string;
  priority?: ExecutionContext["priority"];
  deadline?: number;
  signal?: AbortSignal;
  environment?: Environment;
  tracing?: Partial<TracingMetadata>;
  security?: Partial<SecurityContext>;
  graph?: ContextGraphSnapshot;
  flags?: Record<string, boolean>;
  metadata?: Record<string, unknown>;
}

function randomId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Create a fully-populated ExecutionContext with sensible defaults. */
export function createExecutionContext(init: ExecutionContextInit = {}): ExecutionContext {
  const requestId = init.requestId ?? randomId("req");
  const correlationId = init.correlationId ?? requestId;
  const traceId = init.tracing?.traceId ?? randomId("trace");
  return {
    requestId,
    correlationId,
    journeyId: init.journeyId,
    workflowId: init.workflowId,
    capabilityId: init.capabilityId,
    userId: init.userId ?? null,
    tripId: init.journeyId ?? null,
    sessionId: init.sessionId,
    locale: init.locale ?? "en",
    timezone: init.timezone,
    currency: init.currency ?? "USD",
    region: init.region,
    language: init.language ?? init.locale ?? "en",
    priority: init.priority ?? "normal",
    deadline: init.deadline,
    signal: init.signal ?? new AbortController().signal,
    environment: init.environment ?? "production",
    now: Date.now(),
    graph: init.graph ?? { nodes: [], edges: [] },
    flags: init.flags ?? {},
    metadata: init.metadata,
    tracing: {
      traceId,
      spanId: init.tracing?.spanId ?? randomId("span"),
      parentSpanId: init.tracing?.parentSpanId,
      baggage: init.tracing?.baggage,
    },
    security: {
      authenticated: init.security?.authenticated ?? false,
      roles: init.security?.roles ?? [],
      scopes: init.security?.scopes ?? [],
      classification: init.security?.classification ?? "internal",
      ipHash: init.security?.ipHash,
    },
  };
}

/** Derive a child context for nested capability/workflow calls. */
export function childContext(
  parent: ExecutionContext,
  overrides: Partial<ExecutionContextInit> = {},
): ExecutionContext {
  return createExecutionContext({
    ...parent,
    ...overrides,
    correlationId: parent.correlationId,
    tracing: {
      traceId: parent.tracing.traceId,
      parentSpanId: parent.tracing.spanId,
      spanId: randomId("span"),
      baggage: parent.tracing.baggage,
    },
    security: parent.security,
    graph: parent.graph,
  });
}
