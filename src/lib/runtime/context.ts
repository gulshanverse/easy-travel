/**
 * Runtime Core — ExecutionContext.
 *
 * Every capability and runtime service executes against an ExecutionContext.
 * The context is a frozen, deterministic snapshot of everything a capability
 * may read from at execution time: identifiers (request / session / user /
 * journey / correlation / causation), locale, timezone, and the seven typed
 * sub-contexts required by EBP-001 (budget, memory, goal, trust, preference,
 * capability, tool). Runtime metadata is attached last for observability.
 */

import { newCausationId, newCorrelationId, newRequestId, newSpanId, newTraceId } from "./ids";

export interface BudgetContext {
  /** Currency code (ISO 4217). */
  currency: string;
  /** Overall budget in the smallest denomination (e.g. cents). */
  totalMinor?: number;
  /** Remaining budget in the smallest denomination. */
  remainingMinor?: number;
  /** Optional per-category caps. */
  categoryCapsMinor?: Readonly<Record<string, number>>;
  /** Soft warning threshold (0..1). */
  warningRatio?: number;
}

export interface MemoryContextRef {
  /** Namespace scoping memory reads/writes for this request. */
  namespace: string;
  /** Recent memory ids attached to the context (opaque to runtime). */
  attachedIds: readonly string[];
  /** Whether write-through memory is allowed for the current call. */
  writesEnabled: boolean;
}

export interface GoalContext {
  /** Active goal identifiers (opaque). */
  goalIds: readonly string[];
  /** Primary goal in scope. */
  primaryGoalId?: string;
  /** Free-form goal metadata surfaced to prompts. */
  hints?: Readonly<Record<string, unknown>>;
}

export interface TrustContext {
  /** Trust score 0..1 (higher = more autonomy granted to AI). */
  score: number;
  /** Explicit scopes the caller has consented to. */
  scopes: readonly string[];
  /** Whether the user opted-in to data retention. */
  retentionOptIn: boolean;
}

export interface PreferenceContext {
  values: Readonly<Record<string, unknown>>;
}

export interface CapabilityContext {
  /** Capabilities allowed for this request (empty = unrestricted). */
  allow: readonly string[];
  /** Capabilities explicitly denied. */
  deny: readonly string[];
}

export interface ToolContext {
  /** Tool identifiers the runtime may invoke. */
  allow: readonly string[];
  /** Tools the runtime may not invoke. */
  deny: readonly string[];
}

export interface TracingMetadata {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  baggage?: Readonly<Record<string, string>>;
}

export interface RuntimeMetadata {
  environment: "development" | "test" | "preview" | "production";
  region?: string;
  version: string;
  startedAt: number;
  flags?: Readonly<Record<string, boolean>>;
  attributes?: Readonly<Record<string, unknown>>;
}

export interface ExecutionContext {
  readonly requestId: string;
  readonly sessionId?: string;
  readonly userId?: string;
  readonly journeyId?: string;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly timestamp: number;
  readonly locale: string;
  readonly timezone: string;
  readonly budget: BudgetContext;
  readonly memory: MemoryContextRef;
  readonly goal: GoalContext;
  readonly trust: TrustContext;
  readonly preference: PreferenceContext;
  readonly capability: CapabilityContext;
  readonly tool: ToolContext;
  readonly tracing: TracingMetadata;
  readonly metadata: RuntimeMetadata;
  readonly signal: AbortSignal;
}

export interface ExecutionContextInit {
  requestId?: string;
  sessionId?: string;
  userId?: string;
  journeyId?: string;
  correlationId?: string;
  causationId?: string;
  timestamp?: number;
  locale?: string;
  timezone?: string;
  budget?: Partial<BudgetContext>;
  memory?: Partial<MemoryContextRef>;
  goal?: Partial<GoalContext>;
  trust?: Partial<TrustContext>;
  preference?: Partial<PreferenceContext>;
  capability?: Partial<CapabilityContext>;
  tool?: Partial<ToolContext>;
  tracing?: Partial<TracingMetadata>;
  metadata?: Partial<RuntimeMetadata>;
  signal?: AbortSignal;
}

export const DEFAULT_BUDGET: BudgetContext = Object.freeze({ currency: "USD" });
export const DEFAULT_MEMORY: MemoryContextRef = Object.freeze({
  namespace: "default",
  attachedIds: Object.freeze([]) as readonly string[],
  writesEnabled: false,
});
export const DEFAULT_GOAL: GoalContext = Object.freeze({
  goalIds: Object.freeze([]) as readonly string[],
});
export const DEFAULT_TRUST: TrustContext = Object.freeze({
  score: 0.5,
  scopes: Object.freeze([]) as readonly string[],
  retentionOptIn: false,
});
export const DEFAULT_PREFERENCE: PreferenceContext = Object.freeze({ values: Object.freeze({}) });
export const DEFAULT_CAPABILITY: CapabilityContext = Object.freeze({
  allow: Object.freeze([]) as readonly string[],
  deny: Object.freeze([]) as readonly string[],
});
export const DEFAULT_TOOL: ToolContext = Object.freeze({
  allow: Object.freeze([]) as readonly string[],
  deny: Object.freeze([]) as readonly string[],
});

function freezeCtx(ctx: ExecutionContext): ExecutionContext {
  Object.freeze(ctx.budget);
  Object.freeze(ctx.memory);
  Object.freeze(ctx.goal);
  Object.freeze(ctx.trust);
  Object.freeze(ctx.preference);
  Object.freeze(ctx.capability);
  Object.freeze(ctx.tool);
  Object.freeze(ctx.tracing);
  Object.freeze(ctx.metadata);
  return Object.freeze(ctx);
}

/** Create a fully populated, immutable ExecutionContext. */
export function createExecutionContext(init: ExecutionContextInit = {}): ExecutionContext {
  const requestId = init.requestId ?? newRequestId();
  const correlationId = init.correlationId ?? newCorrelationId();
  const tracing: TracingMetadata = {
    traceId: init.tracing?.traceId ?? newTraceId(),
    spanId: init.tracing?.spanId ?? newSpanId(),
    parentSpanId: init.tracing?.parentSpanId,
    baggage: init.tracing?.baggage ? Object.freeze({ ...init.tracing.baggage }) : undefined,
  };
  const metadata: RuntimeMetadata = {
    environment: init.metadata?.environment ?? "production",
    region: init.metadata?.region,
    version: init.metadata?.version ?? "0.0.0",
    startedAt: init.metadata?.startedAt ?? Date.now(),
    flags: init.metadata?.flags ? Object.freeze({ ...init.metadata.flags }) : undefined,
    attributes: init.metadata?.attributes
      ? Object.freeze({ ...init.metadata.attributes })
      : undefined,
  };
  const ctx: ExecutionContext = {
    requestId,
    sessionId: init.sessionId,
    userId: init.userId,
    journeyId: init.journeyId,
    correlationId,
    causationId: init.causationId,
    timestamp: init.timestamp ?? Date.now(),
    locale: init.locale ?? "en-US",
    timezone: init.timezone ?? "UTC",
    budget: { ...DEFAULT_BUDGET, ...(init.budget ?? {}) },
    memory: { ...DEFAULT_MEMORY, ...(init.memory ?? {}) },
    goal: { ...DEFAULT_GOAL, ...(init.goal ?? {}) },
    trust: { ...DEFAULT_TRUST, ...(init.trust ?? {}) },
    preference: { ...DEFAULT_PREFERENCE, ...(init.preference ?? {}) },
    capability: { ...DEFAULT_CAPABILITY, ...(init.capability ?? {}) },
    tool: { ...DEFAULT_TOOL, ...(init.tool ?? {}) },
    tracing,
    metadata,
    signal: init.signal ?? new AbortController().signal,
  };
  return freezeCtx(ctx);
}

/**
 * Derive a child context for nested capability/tool calls. Correlation and
 * trace ids propagate; span id is regenerated and causation id points at the
 * parent request.
 */
export function childContext(
  parent: ExecutionContext,
  overrides: ExecutionContextInit = {},
): ExecutionContext {
  return createExecutionContext({
    ...overrides,
    requestId: overrides.requestId ?? newRequestId(),
    sessionId: overrides.sessionId ?? parent.sessionId,
    userId: overrides.userId ?? parent.userId,
    journeyId: overrides.journeyId ?? parent.journeyId,
    correlationId: parent.correlationId,
    causationId: overrides.causationId ?? parent.requestId,
    locale: overrides.locale ?? parent.locale,
    timezone: overrides.timezone ?? parent.timezone,
    budget: { ...parent.budget, ...(overrides.budget ?? {}) },
    memory: { ...parent.memory, ...(overrides.memory ?? {}) },
    goal: { ...parent.goal, ...(overrides.goal ?? {}) },
    trust: { ...parent.trust, ...(overrides.trust ?? {}) },
    preference: { ...parent.preference, ...(overrides.preference ?? {}) },
    capability: { ...parent.capability, ...(overrides.capability ?? {}) },
    tool: { ...parent.tool, ...(overrides.tool ?? {}) },
    tracing: {
      traceId: parent.tracing.traceId,
      parentSpanId: parent.tracing.spanId,
      spanId: overrides.tracing?.spanId ?? newSpanId(),
      baggage: overrides.tracing?.baggage ?? parent.tracing.baggage,
    },
    metadata: { ...parent.metadata, ...(overrides.metadata ?? {}) },
    signal: overrides.signal ?? parent.signal,
  });
}
